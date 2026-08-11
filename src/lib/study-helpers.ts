export function readinessLabel(pct: number): string {
  if (pct >= 80) return "Redo";
  if (pct >= 40) return "Bra fart";
  return "På väg";
}

export function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateISO + "T00:00:00");
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diff;
}

export function formatSwedishDate(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" });
}