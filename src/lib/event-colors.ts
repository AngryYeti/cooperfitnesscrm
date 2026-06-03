const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#ca8a04",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#0d9488",
  "#7c3aed",
  "#db2777",
  "#65a30d",
];

export function getEventColor(title: string): string {
  const trimmed = title.trim().toLowerCase();
  if (!trimmed) return PALETTE[0];

  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
