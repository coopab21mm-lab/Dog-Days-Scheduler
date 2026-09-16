import { NextResponse } from "next/server";
import { checkEnv } from "@/lib/env";
import { checkFfmpeg } from "@/lib/ffmpeg";

export async function GET() {
  const env = checkEnv();
  const ffmpeg = await checkFfmpeg();
  return NextResponse.json({ env, ffmpeg });
}
