import { revalidatePath } from "next/cache";
import { generateDay } from "@/lib/ai";
import { isISODate } from "@/lib/dates";
import { dayHasScores, getDay, markRest } from "@/lib/db";
import { loadEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  loadEnv();
  const body = (await request.json().catch(() => null)) as {
    date?: string;
    mode?: string;
    focus?: string;
    force?: boolean;
  } | null;
  if (!body?.date || !isISODate(body.date)) {
    return Response.json({ ok: false, error: "Pick a valid date." }, { status: 400 });
  }
  const force = Boolean(body.force);
  const existing = getDay(body.date);
  if (existing && !force) {
    const code = dayHasScores(body.date) ? "scores" : "exists";
    const error = code === "scores" ? "Scores are logged on that day." : "That day already has a workout.";
    return Response.json({ ok: false, code, error }, { status: 409 });
  }
  if (body.mode === "rest") {
    markRest(body.date);
    revalidatePath("/", "layout");
    return Response.json({ ok: true, title: "Rest" });
  }
  try {
    const result = await generateDay({
      date: body.date,
      focus: body.focus || "mixed",
    });
    revalidatePath("/", "layout");
    return Response.json({ ok: true, title: result.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
