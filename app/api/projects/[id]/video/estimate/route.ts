import { NextResponse } from "next/server";
import { getAllSettings, getProjectWithBeats, todaySpend } from "@/lib/db";
import { estimateVideoCost, roundToSupportedDuration } from "@/lib/kling";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProjectWithBeats(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.beats.length) {
    return NextResponse.json({ error: "Generate a script before estimating video cost." }, { status: 400 });
  }

  const settings = getAllSettings();
  const pricePerSecond = parseFloat(settings.kling_price_per_second) || 0;
  const dailySpendCap = parseFloat(settings.daily_spend_cap) || 0;

  const totalRoundedSeconds = project.beats.reduce(
    (sum, b) => sum + roundToSupportedDuration(b.seconds),
    0
  );
  const estimatedCost = estimateVideoCost(totalRoundedSeconds, pricePerSecond);
  const spentToday = todaySpend();
  const wouldExceedCap = dailySpendCap > 0 && spentToday + estimatedCost > dailySpendCap;

  return NextResponse.json({
    beatSeconds: project.beats.map((b) => ({
      idx: b.idx,
      estimated: b.seconds,
      billedAs: roundToSupportedDuration(b.seconds),
    })),
    totalRoundedSeconds,
    pricePerSecond,
    estimatedCost,
    dailySpendCap,
    spentToday,
    wouldExceedCap,
  });
}
