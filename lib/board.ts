export type ScaleLine = {
  label: string;
  text: string;
};

export type BoardMove = {
  type: "move";
  reps: string;
  name: string;
  scales: ScaleLine[];
};

export type BoardNote = {
  type: "note";
  text: string;
};

export type BoardLine = BoardMove | BoardNote;

export type LoadRow = {
  label: string;
  value: string;
};

export type BoardSummary = {
  equipment: string[];
  loads: LoadRow[];
};

const SCALE = "Rx|Performance|Lifestyle";
const SCALE_LINE = new RegExp(`^(${SCALE})\\s*[:—–-]\\s*(.+)$`, "i");
const SLASH_PART = new RegExp(`^(.+?)\\s*\\((${SCALE})\\)\\s*$`, "i");
const LABEL = /^(Minute|Station|Round)\s+(\d+)\s*[:.)-]?\s*(.+)$/i;
const REPS =
  /^(\d+\s*[x×]\s*\d+|\d+(?:\s*[-/]\s*\d+)+|\d+(?:\.\d+)?\s*(?:sec|secs|seconds?|min|mins|minutes?|cal|cals|calories?)(?:\s*\/\s*[a-z]+|\s+each(?:\s+side)?)?|\d+(?:\.\d+)?\s*(?:km|mi|ft|yd|m)\b|\d+)\s+(.+)$/i;

function canonicalScale(label: string) {
  const lower = label.toLowerCase();
  if (lower === "rx") return "Rx";
  if (lower === "performance") return "Performance";
  if (lower === "lifestyle") return "Lifestyle";
  return label;
}

function stripBullet(line: string) {
  return line.replace(/^\s*[-*•]\s+/, "").trim();
}

function stripCue(text: string) {
  return text
    .replace(/,\s*focus on\b.*/i, "")
    .replace(/\s*[—–-]\s*not scored\b.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameMove(a: string, b: string) {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a) === norm(b);
}

function tidyReps(reps: string) {
  return reps.replace(/\s*([x×\-/])\s*/g, "$1").trim();
}

function splitReps(text: string) {
  const match = text.match(REPS);
  if (!match) return { reps: "", name: text };
  return { reps: tidyReps(match[1]), name: match[2].trim() };
}

function cleanEquipment(piece: string) {
  return piece
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:–—-]+|[\s.,;:–—-]+$/g, "")
    .trim();
}

function isNote(text: string) {
  if (/:\s*$/.test(text)) return true;
  if (/^(rest|score|then|note|cap|not scored|quality)\b/i.test(text)) return true;
  if (/^(for time|amrap|emom|every minute)\b/i.test(text)) return true;
  if (/^weight(?:ed)? vest\b/i.test(text)) return true;
  return false;
}

function parseSlash(line: string): ScaleLine[] | null {
  if (!line.includes("/")) return null;
  const parts = line.split(/\s*\/\s*/);
  if (parts.length < 2) return null;
  const parsed = parts.map((part) => {
    const match = part.trim().match(SLASH_PART);
    if (!match) return null;
    return { label: canonicalScale(match[2]), text: stripCue(match[1]) };
  });
  if (parsed.some((item) => !item)) return null;
  return parsed as ScaleLine[];
}

function moveText(move: BoardMove) {
  return [move.reps, move.name].filter(Boolean).join(" ");
}

function fromScales(scales: ScaleLine[], minute?: string): BoardMove {
  const rx = scales.find((item) => item.label === "Rx") ?? scales[0];
  const differ = scales.filter((item) => item !== rx && !sameMove(item.text, rx.text));
  if (minute) return { type: "move", reps: minute, name: rx.text, scales: differ };
  const split = splitReps(rx.text);
  return { type: "move", reps: split.reps, name: split.name, scales: differ };
}

function attachScale(lines: BoardLine[], scale: ScaleLine) {
  const last = lines[lines.length - 1];
  if (last?.type === "move" && !sameMove(scale.text, moveText(last))) {
    last.scales.push(scale);
    return;
  }
  if (last?.type === "move") return;
  const split = splitReps(scale.text);
  lines.push({ type: "move", reps: split.reps, name: split.name, scales: [] });
}

export function parseBoard(body: string): BoardLine[] {
  const lines: BoardLine[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = stripBullet(raw);
    if (!line) continue;

    const scale = line.match(SCALE_LINE);
    if (scale) {
      attachScale(lines, { label: canonicalScale(scale[1]), text: stripCue(scale[2]) });
      continue;
    }

    const minute = line.match(/^(?:Minute|Min)\s+\d+\s*[:.)-]\s*.+$/i);
    if (minute) {
      lines.push({ type: "note", text: line });
      continue;
    }

    const label = line.match(LABEL);
    const payload = stripCue(label ? label[3] : line);
    if (!payload) continue;

    const slash = parseSlash(payload);
    if (slash) {
      lines.push(fromScales(slash, label?.[2]));
      continue;
    }

    if (!label && isNote(payload)) {
      lines.push({ type: "note", text: payload });
      continue;
    }

    if (label) {
      lines.push({ type: "move", reps: label[2], name: payload, scales: [] });
      continue;
    }

    const split = splitReps(payload);
    lines.push({ type: "move", reps: split.reps, name: split.name, scales: [] });
  }
  return lines;
}

export function parseSummary(summary: string): BoardSummary {
  const equipment: string[] = [];
  const loads: LoadRow[] = [];
  const equipMatch = summary.match(/Equipment:\s*([^\n]+)/i);
  if (equipMatch) {
    const raw = equipMatch[1].split(/\bLoads\s*:/i)[0];
    for (const piece of raw.split(",")) {
      const name = cleanEquipment(piece);
      if (name) equipment.push(name);
    }
  }

  const loadsBlock = summary.match(/Loads:\s*([\s\S]*)/i)?.[1] ?? "";
  const tier = /(?:^|[\s·,;.])((?:Rx|RX|rx|Performance|performance|Lifestyle|lifestyle)|[A-Z]{1,4})\s*[:—–-]\s*/g;
  const found: { label: string; start: number; end: number }[] = [];
  for (const match of loadsBlock.matchAll(tier)) {
    const index = match.index ?? 0;
    const offset = match[0].length - match[0].replace(/^[\s·,;.]+/, "").length;
    found.push({ label: canonicalScale(match[1]), start: index + offset, end: index + match[0].length });
  }
  for (let position = 0; position < found.length; position += 1) {
    const stop = position + 1 < found.length ? found[position + 1].start : loadsBlock.length;
    const value = loadsBlock
      .slice(found[position].end, stop)
      .replace(/[\s·,;.]+$/g, "")
      .trim();
    if (value) loads.push({ label: found[position].label, value });
  }
  return { equipment, loads };
}
