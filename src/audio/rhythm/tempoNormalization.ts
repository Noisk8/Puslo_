export function tempoCandidates(raw: number, min = 40, max = 220): number[] {
  if (!Number.isFinite(raw) || raw <= 0) return [];
  return [raw / 4, raw / 2, raw, raw * 2, raw * 4].filter((x) => x >= min && x <= max);
}
export function normalizeTempo(
  raw: number,
  previous: number | null,
  min = 40,
  max = 220,
): number | null {
  const candidates = tempoCandidates(raw, min, max);
  if (!candidates.length) return null;
  const target = previous ?? raw;
  return candidates.reduce((a, b) =>
    Math.abs(Math.log(b / target)) < Math.abs(Math.log(a / target)) ? b : a,
  );
}
