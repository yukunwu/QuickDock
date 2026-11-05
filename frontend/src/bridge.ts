import {
  defaults,
  previewApps,
  type Settings,
  type Snapshot,
  type Usage,
} from "./catalog";
export const native =
  location.protocol === "wails:" ||
  !!(window as unknown as { _wails?: { environment?: unknown } })._wails
    ?.environment;
const backend = () => import("../bindings/quickdock/service");
let demoSettings: Settings = (() => {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem("quickdock-preview") || "{}"),
    };
  } catch {
    return { ...defaults };
  }
})();
const usage: Record<string, Usage> = {};
export async function snapshot(): Promise<Snapshot> {
  if (native) return (await backend()).Snapshot();
  return {
    apps: previewApps,
    settings: demoSettings,
    usage,
    indexing: false,
    error: "",
    shortcutError: "",
  };
}
export async function saveSettings(settings: Settings): Promise<Settings> {
  if (native) return (await backend()).SaveSettings(settings);
  localStorage.setItem("quickdock-preview", JSON.stringify(settings));
  demoSettings = settings;
  return settings;
}
export async function refreshApps(): Promise<Snapshot> {
  return native ? (await backend()).RefreshApps() : snapshot();
}
export async function launch(id: string): Promise<void> {
  if (native) return (await backend()).Launch(id);
  throw new Error("浏览器预览不能启动本机应用，请在 QuickDock 桌面版中使用。");
}
export async function openBookmark(id: string): Promise<void> {
  if (native) return (await backend()).OpenBookmark(id);
  const b = demoSettings.bookmarks.find((b) => b.id === id);
  if (!b) throw new Error("网址不存在");
  const url = new URL(b.url);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("不支持的网址协议");
  window.open(url.href, "_blank", "noopener,noreferrer");
  await recordUsage(id);
}
export async function hide() {
  if (native) await (await backend()).Hide();
}
export async function setEditing(editing: boolean) {
  if (native) await (await backend()).SetEditing(editing);
}
export async function copy(text: string) {
  if (native) return (await backend()).Copy(text);
  await navigator.clipboard.writeText(text);
}
export async function recordUsage(id: string) {
  if (native) return (await backend()).RecordUsage(id);
  usage[id] = { count: (usage[id]?.count || 0) + 1, lastUsed: Date.now() };
}

export async function setView(view: string) {
  if (native) await (await backend()).SetView(view);
}

export async function isVisible(): Promise<boolean> {
  return native ? (await backend()).IsVisible() : !document.hidden;
}

import {
  googleSearchURL,
  translationPageURL,
  translationRequest,
  parseTranslation,
  type Provider,
  type Translation,
} from "./tools/online";
import { calculateSheet, type Calculation } from "./tools/notebook";
export async function openGoogleSearch(query: string) {
  const url = googleSearchURL(query);
  if (native) return (await backend()).OpenGoogleSearch(query);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  // noopener intentionally permits a null WindowProxy even when the tab opened.
  void opened;
}
export async function translate(
  text: string,
  source: string,
  target: string,
  provider: Provider,
  signal: AbortSignal,
): Promise<Translation> {
  const url = translationRequest(text, source, target, provider);
  if (native) {
    const api = await backend();
    signal.throwIfAborted();
    const call = api.Translate(text, source, target, provider);
    const cancel = () => {
      void call.cancel().catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      return await call;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  }
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(16000)]),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw Error(
      response.status === 429
        ? `${provider === "google" ? "Google" : "MyMemory"} 翻译已限流（429）`
        : "翻译请求失败，请检查网络或切换翻译源",
    );
  const raw = await response.text();
  if (raw.length > 1024 * 1024) throw Error("翻译响应异常");
  return parseTranslation(JSON.parse(raw), source, provider, text, target);
}
const historyKey = "quickdock-preview-calculations";
export async function calculations(): Promise<Calculation[]> {
  if (native) return (await backend()).Calculations();
  const raw = localStorage.getItem(historyKey);
  if (!raw) return [];
  const state = JSON.parse(raw);
  if (
    state.version !== 1 ||
    !Array.isArray(state.records) ||
    state.records.length > 100 ||
    state.records.some(
      (r: Calculation) =>
        typeof r.id !== "string" ||
        typeof r.source !== "string" ||
        typeof r.createdAt !== "number" ||
        !Array.isArray(r.results),
    )
  )
    throw Error("计算历史损坏或版本不支持，已保留原数据");
  return state.records;
}
export async function saveCalculation(
  source: string,
  results: string[],
): Promise<Calculation[]> {
  if (native) return (await backend()).SaveCalculation(source, results);
  const lines = calculateSheet(source);
  if (!lines.some((l) => l.result) || lines.some((l) => l.error))
    throw Error("请修正所有算式后保存");
  const records = await calculations();
  if (records[0]?.source === source) return records;
  const next = [
    { id: crypto.randomUUID(), createdAt: Date.now(), source, results },
    ...records,
  ].slice(0, 100);
  localStorage.setItem(
    historyKey,
    JSON.stringify({ version: 1, records: next }),
  );
  return next;
}
export async function deleteCalculation(id: string): Promise<Calculation[]> {
  if (native) return (await backend()).DeleteCalculation(id);
  const next = (await calculations()).filter((r) => r.id !== id);
  localStorage.setItem(
    historyKey,
    JSON.stringify({ version: 1, records: next }),
  );
  return next;
}
export async function clearCalculations() {
  if (native) return (await backend()).ClearCalculations();
  await calculations();
  localStorage.setItem(historyKey, JSON.stringify({ version: 1, records: [] }));
}

const popupWindows = new Map<string, Window>();
export async function openToolWindow(
  id: import("./catalog").ToolID,
  session = "",
) {
  if (native) return (await backend()).OpenToolWindow(id, session);
  const existing = popupWindows.get(id);
  if (existing && !existing.closed) {
    existing.focus();
    return;
  }
  const old = await toolWindowState(id);
  if (session) old.session = session;
  localStorage.setItem("quickdock-preview-window-" + id, JSON.stringify(old));
  const popup = window.open(
    "/?tool=" + id,
    "quickdock-tool-" + id,
    "popup,width=960,height=660",
  );
  if (!popup) throw Error("请允许弹出工具窗口");
  popupWindows.set(id, popup);
}
export async function toolWindowState(
  id: string,
): Promise<{ session: string }> {
  if (native) return (await backend()).ToolWindowState(id);
  return JSON.parse(
    localStorage.getItem("quickdock-preview-window-" + id) ||
      '{"session":"{\\"version\\":1}"}',
  );
}
export async function saveToolWindow(id: string, session: string) {
  if (new TextEncoder().encode(session).length > 8 * 1024 * 1024)
    throw Error("独立窗口草稿超过8MiB，无法保存，请缩小输入");
  if (native) return (await backend()).SaveToolWindow(id, session);
  localStorage.setItem(
    "quickdock-preview-window-" + id,
    JSON.stringify({ session }),
  );
}
export async function closeToolWindow(id: string) {
  if (native) return (await backend()).CloseToolWindow(id);
  window.close();
}
export async function toolQuitReady(id: string) {
  if (native) return (await backend()).ToolQuitReady(id);
}

export async function openTranslationPage(
  text: string,
  source: string,
  target: string,
) {
  const url = translationPageURL(text, source, target);
  if (native)
    return (await backend()).OpenTranslationPage(text, source, target);
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function googleTranslationPage(
  windowID: string,
  text: string,
  source: string,
  target: string,
  action: string,
  rect: Record<string, number> = {},
) {
  if (native)
    return (await backend()).GoogleTranslationPage(
      windowID,
      text,
      source,
      target,
      action,
      rect,
    );
  window.dispatchEvent(
    new CustomEvent("quickdock-google-page", {
      detail: { windowID, text, source, target, action },
    }),
  );
}

export type UpdateInfo = { current: string; version: string; state: string; error: string; notes: string; progress: number; linux: boolean };
export async function updateStatus(): Promise<UpdateInfo> {
  return native ? (await backend()).UpdateStatus() : {current:"0.1.1", version:"", state:"idle", error:"", notes:"", progress:0, linux:false};
}
export async function checkForUpdates(): Promise<UpdateInfo> {
  if (!native) throw Error("请在桌面版中检查更新");
  return (await backend()).CheckForUpdates();
}
export async function installUpdate() { if (native) await (await backend()).InstallUpdate(); }
export async function restartAfterUpdate() { if (native) await (await backend()).RestartAfterUpdate(); }
