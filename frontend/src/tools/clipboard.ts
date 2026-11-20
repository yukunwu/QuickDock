import type { ClipboardEntry } from "../bridge";
const fold = (value: string) => value.normalize("NFKC").toLowerCase();
// Pinned entries first, each group newest first.
export function orderClipboard(records: ClipboardEntry[], query: string) {
  const q = fold(query.trim());
  return records
    .filter((r) => !q || fold(r.text).includes(q))
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt,
    );
}
