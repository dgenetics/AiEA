/**
 * Parse explicit subtask lists from capture text / proposal notes.
 * Examples:
 *   Subtasks: 1. Colby chef dinner event 2. Eric Lewis "yoga of plants" event. Due today.
 *   Parts:\n- Outline deck\n- Send invite
 */

export type ParsedSubtask = {
  title: string;
  dueAt?: string | null;
};

export function parseSubtaskLines(text: string): ParsedSubtask[] {
  if (!text?.trim()) return [];

  const blob = text.trim();
  const out: ParsedSubtask[] = [];

  // "Subtasks:" / "Parts:" / "Break into:" section
  const sectionMatch = blob.match(
    /(?:subtasks?|parts?|steps?|break(?:\s+it)?\s+into)\s*[:\-]\s*([\s\S]+)/i,
  );
  const section = sectionMatch ? sectionMatch[1] : blob;

  // Numbered: 1. foo 2. bar  OR 1) foo 2) bar
  const numbered = [
    ...section.matchAll(
      /(?:^|[\s;])(?:\d+[\.\)\:]|[-*•])\s+([^\n\d]+?)(?=(?:\s+\d+[\.\)\:]|\s*[-*•]\s+|$))/gi,
    ),
  ];

  if (numbered.length >= 1) {
    for (const m of numbered) {
      const title = cleanPartTitle(m[1]);
      if (title.length > 1) out.push({ title });
    }
  }

  // If still empty, try split on " 2. " style mid-line without relying on start
  if (out.length < 2) {
    const mid = section.split(/(?=\b\d+[\.\)\:]\s+)/).map((s) => s.trim());
    const recovered: ParsedSubtask[] = [];
    for (const chunk of mid) {
      const m = chunk.match(/^\d+[\.\)\:]\s+([\s\S]+)$/);
      if (m) {
        const title = cleanPartTitle(m[1]);
        if (title.length > 1) recovered.push({ title });
      }
    }
    if (recovered.length > out.length) {
      return applySharedDue(recovered, blob);
    }
  }

  // Parenthetical list: "Water plants (kitchen, gym, spa)"
  if (out.length < 2) {
    const paren = blob.match(/\(([^)]{3,})\)/);
    if (paren) {
      const fromParen = splitCommaList(paren[1]);
      if (fromParen.length >= 2) {
        return applySharedDue(
          fromParen.map((title) => ({ title })),
          blob,
        );
      }
    }
  }

  // "add kitchen, gym, spa as subtasks" / "... as parts"
  if (out.length < 2) {
    const asList = blob.match(
      /(?:add\s+)?(.+?)\s+as\s+(?:subtasks?|parts?|steps?)\b/i,
    );
    if (asList) {
      let listBlob = asList[1]
        .replace(/^.*?(?:on\s+\w+\.?\s*)/i, "") // drop leading "once a week on sunday. "
        .replace(/^[.\s]+/, "")
        .trim();
      // Prefer content after last "add "
      const afterAdd = listBlob.match(/\badd\s+(.+)$/i);
      if (afterAdd) listBlob = afterAdd[1];
      const fromAs = splitCommaList(listBlob);
      if (fromAs.length >= 2) {
        return applySharedDue(
          fromAs.map((title) => ({ title })),
          blob,
        );
      }
    }
  }

  return applySharedDue(out, blob);
}

/** Split "a, b, c, and d" into clean titles. */
function splitCommaList(raw: string): string[] {
  return raw
    .split(/\s*,\s*|\s+and\s+/i)
    .map((s) => cleanPartTitle(s.replace(/^\s*and\s+/i, "")))
    .filter((s) => s.length > 1 && s.length < 80);
}

function cleanPartTitle(raw: string): string {
  return raw
    .replace(/\bDue\s+(today|tomorrow|this week).*$/i, "")
    .replace(/[.;,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function applySharedDue(
  parts: ParsedSubtask[],
  fullText: string,
): ParsedSubtask[] {
  if (!parts.length) return parts;
  const lower = fullText.toLowerCase();
  let dueAt: string | null = null;

  // Lazy import avoided — keep pure by inlining local noon ISO
  const now = new Date();
  const noon = (offsetDays: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, 12, 0, 0, 0);
    return d.toISOString();
  };

  if (/\bdue\s+today\b|\btoday\b/.test(lower) && /subtasks?|parts?|steps?/i.test(fullText)) {
    dueAt = noon(0);
  } else if (/\bdue\s+tomorrow\b|\btomorrow\b/.test(lower) && /subtasks?|parts?/i.test(fullText)) {
    dueAt = noon(1);
  }

  if (!dueAt) return parts;
  return parts.map((p) => ({ ...p, dueAt: p.dueAt ?? dueAt }));
}

/** Attach parsed subtasks onto a parent proposal title/notes if AI omitted them. */
export function attachSubtasksIfMissing(
  title: string,
  notes: string | undefined,
  existing: ParsedSubtask[] | undefined,
  rawCapture?: string,
): ParsedSubtask[] {
  if (existing && existing.length >= 2) return existing;

  const fromNotes = parseSubtaskLines([title, notes].filter(Boolean).join("\n"));
  if (fromNotes.length >= 2) return fromNotes;

  if (rawCapture) {
    const fromRaw = parseSubtaskLines(rawCapture);
    if (fromRaw.length >= 2) return fromRaw;
  }

  return existing ?? [];
}
