// Status- och kategorivärdena speglar den centrala Feedback Hub-tjänsten
// (feedback.isaly.se), som delas av alla Isaly-appar. Håll dessa i synk
// med tjänstens enum-värden, inte med lokala gissningar.
export const STATUS_META: Record<string, { className: string }> = {
  new: { className: "bg-blue-100 text-blue-800 border-blue-200" },
  investigating: {
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  planned: {
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  in_progress: {
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  done: { className: "bg-green-100 text-green-800 border-green-200" },
  rejected: {
    className: "bg-gray-200 text-gray-700 border-gray-300",
  },
};

export const STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  investigating: "Under utredning",
  planned: "Planerad",
  in_progress: "Pågår",
  done: "Klar",
  rejected: "Avvisad",
};

export const CATEGORY_META: Record<string, { className: string }> = {
  bug: { className: "bg-red-100 text-red-800 border-red-200" },
  suggestion: { className: "bg-blue-100 text-blue-800 border-blue-200" },
  question: { className: "bg-teal-100 text-teal-800 border-teal-200" },
  other: { className: "bg-gray-100 text-gray-800 border-gray-200" },
};

export const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bugg",
  suggestion: "Förslag",
  question: "Fråga",
  other: "Annat",
};

const DEFAULT_META = { className: "bg-gray-100 text-gray-800 border-gray-200" };

export function statusMeta(status: string | null): { className: string } {
  return (status && STATUS_META[status]) || DEFAULT_META;
}

export function statusLabel(status: string | null): string {
  if (!status) return STATUS_LABELS.new;
  return STATUS_LABELS[status] ?? status;
}

export function categoryMeta(category: string | null): { className: string } {
  return (category && CATEGORY_META[category]) || DEFAULT_META;
}

export function categoryLabel(category: string | null): string {
  if (!category) return CATEGORY_LABELS.other;
  return CATEGORY_LABELS[category] ?? category;
}

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}
