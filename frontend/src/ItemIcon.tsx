import type { SearchResult } from "./catalog";
export function ItemIcon({
  result: r,
  large = false,
}: {
  result: SearchResult;
  large?: boolean;
}) {
  return (
    <span
      className={`item-icon ${r.color} ${large ? "large" : ""} ${r.image ? "app-image" : ""}`}
    >
      {r.image ? (
        <img src={r.image} alt="" />
      ) : (
        <r.icon size={large ? 38 : 22} />
      )}
    </span>
  );
}
