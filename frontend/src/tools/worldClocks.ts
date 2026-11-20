import { defaultZones, validZone } from "./time";
// The zone list is a preference, not tool input, so it outlives the session.
// It lives in WebView storage and travels in configuration exports.
const zonesKey = "quickdock-time-zones";
export function loadWorldClocks(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(zonesKey) || "null");
    if (Array.isArray(list) && list.every((z) => typeof z === "string"))
      return list.filter(validZone).slice(0, 24);
  } catch {
    // Fall through to defaults.
  }
  return defaultZones;
}
export function storeWorldClocks(zones: string[]) {
  localStorage.setItem(
    zonesKey,
    JSON.stringify(zones.filter(validZone).slice(0, 24)),
  );
}
