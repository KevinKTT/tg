import { revalidatePath } from "next/cache";
import { coachNote, generateDay, rewriteDay, rewriteIntent } from "@/lib/ai";
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
    intent?: string;
    note?: string;
    force?: boolean;
  } | null;
  if (!body?.date || !isISODate(body.date)) {
    return Response.json({ ok: false, error: "Pick a valid date." }, { status: 400 });
  }
  const force = Boolean(body.force);
  const existing = getDay(body.date);
  if (body.mode === "rewrite") {
    if (!existing || existing.status === "rest") {
      return Response.json({ ok: false, error: "There is no workout to rewrite." }, { status: 400 });
    }
    const intent = rewriteIntent(body.intent || "");
    if (!intent) {
      return Response.json({ ok: false, error: "Pick clarify or a workout focus." }, { status: 400 });
    }
    const note = coachNote(body.note);
    if (intent === "clarify" && !note) {
      return Response.json({ ok: false, error: "Tell the coach what to fix." }, { status: 400 });
    }
    if (dayHasScores(body.date) && !force) {
      return Response.json({ ok: false, code: "scores", error: "Scores are logged on that day." }, { status: 409 });
    }
    try {
      const result = await rewriteDay({ date: body.date, intent, note });
      revalidatePath("/", "layout");
      return Response.json({ ok: true, title: result.title });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rewrite failed.";
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }
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
      focus: body.focus && body.focus !== "auto" ? body.focus : "",
    });
    revalidatePath("/", "layout");
    return Response.json({ ok: true, title: result.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
