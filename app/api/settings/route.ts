import { NextResponse } from "next/server";
import { getAllSettings, setSetting, todaySpend } from "@/lib/db";

export async function GET() {
  const settings = getAllSettings();
  return NextResponse.json({ settings, todaySpend: todaySpend() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, string>;
  const allowedKeys = ["elevenlabs_voice_id", "kling_price_per_second", "daily_spend_cap"];
  for (const key of allowedKeys) {
    if (typeof body[key] === "string" && body[key].trim().length > 0) {
      setSetting(key, body[key].trim());
    }
  }
  return NextResponse.json({ settings: getAllSettings() });
}
