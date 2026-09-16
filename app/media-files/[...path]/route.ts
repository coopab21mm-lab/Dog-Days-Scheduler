import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_ROOT } from "@/lib/media";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".srt": "application/x-subrip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const resolved = path.normalize(path.join(MEDIA_ROOT, relative));

  // Reject any path that escapes the media root (e.g. via "..") before touching the disk.
  if (!resolved.startsWith(MEDIA_ROOT + path.sep) && resolved !== MEDIA_ROOT) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const stat = fs.statSync(resolved);
  const range = req.headers.get("range");

  if (!range) {
    const data = fs.readFileSync(resolved);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }

  // Serve the requested byte range so <video>/<audio> elements can seek.
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match?.[1] ? parseInt(match[1], 10) : 0;
  const end = match?.[2] ? parseInt(match[2], 10) : stat.size - 1;
  const chunkSize = end - start + 1;

  const buffer = Buffer.alloc(chunkSize);
  const fd = fs.openSync(resolved, "r");
  fs.readSync(fd, buffer, 0, chunkSize, start);
  fs.closeSync(fd);

  return new NextResponse(new Uint8Array(buffer), {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}
