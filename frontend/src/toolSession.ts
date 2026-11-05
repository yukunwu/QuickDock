import type { ToolID } from "./catalog";
import type { Draft } from "./tools/compute";
import type { Provider, Translation } from "./tools/online";
export type DockTranslationDraft = {
  query: string;
  source: string;
  target: string;
  provider: Provider;
  answer: { key: string; value: Translation } | null;
};
export type ViewState = {
  page: "launch" | "tools" | "settings";
  activeTool: ToolID | null;
  query: string;
  selected: number;
  expanded: boolean;
  category: string;
  translationOpen?: boolean;
};
type SavedSession = {
  version: 1;
  view: ViewState;
  drafts: [ToolID, Draft][];
  translation?: DockTranslationDraft;
};
// History belongs to this webview session, survives an internal reload, and is
// consumed immediately. Never write tool input into settings/localStorage.
let saved = history.state?.quickdockSession as SavedSession | undefined;
if (saved?.version !== 1) saved = undefined;
export const restoredView = saved?.view;
let translationDraft = saved?.translation;
export function getDockTranslation(query: string) {
  return translationDraft?.query === query ? translationDraft : undefined;
}
export function setDockTranslation(value: DockTranslationDraft) {
  translationDraft = value;
  changed();
}
export const getTranslationDraft = () => translationDraft;
function changed() {
  queueMicrotask(() =>
    window.dispatchEvent(new Event("quickdock-draft-changed")),
  );
}
class DraftMap extends Map<ToolID, Draft> {
  set(id: ToolID, value: Draft) {
    super.set(id, value);
    changed();
    return this;
  }
}
let bookmarkDraft: unknown;
export function setBookmarkDraft(value: unknown) {
  bookmarkDraft = value;
  changed();
}
export function getBookmarkDraft() {
  return bookmarkDraft;
}
export function exportToolSession(id: ToolID) {
  return JSON.stringify({
    version: 1,
    draft: drafts.get(id),
    translation: id === "translate" ? translationDraft : undefined,
    bookmark: id === "bookmarks" ? bookmarkDraft : undefined,
  });
}
export function importToolSession(id: ToolID, raw: string) {
  const data = JSON.parse(raw);
  if (data.version !== 1) throw Error("不支持的工具草稿版本");
  if (data.draft) {
    if (
      typeof data.draft.input !== "string" ||
      typeof data.draft.generated !== "string" ||
      typeof data.draft.count !== "number" ||
      !["mode", "unit", "zone", "group", "from", "to"].every(
        (k) => typeof data.draft[k] === "string",
      )
    )
      throw Error("工具草稿损坏");
    drafts.set(id, data.draft);
  }
  if (id === "translate" && data.translation) {
    const t = data.translation;
    if (
      typeof t.query !== "string" ||
      !["google", "mymemory"].includes(t.provider) ||
      typeof t.source !== "string" ||
      typeof t.target !== "string" ||
      (t.answer &&
        (typeof t.answer.key !== "string" ||
          typeof t.answer.value?.text !== "string"))
    )
      throw Error("翻译草稿损坏");
    translationDraft = t;
  }
  if (id === "bookmarks" && data.bookmark) {
    if (
      !["id", "name", "url", "alias"].every(
        (k) => typeof data.bookmark[k] === "string",
      )
    )
      throw Error("网址草稿损坏");
    bookmarkDraft = data.bookmark;
  }
}
export const drafts = new DraftMap(saved?.drafts || []);
if (saved) {
  const { quickdockSession: _, ...other } = history.state;
  history.replaceState(other, "");
}
saved = undefined;
let heavyWork = false;
export function markHeavyWork() {
  heavyWork = true;
}
export function reclaimHiddenSession(view: ViewState) {
  if (
    !heavyWork ||
    (view.page === "settings" && !view.activeTool) ||
    view.activeTool === "bookmarks"
  )
    return;
  // A quota/serialization failure must leave the live drafts untouched.
  try {
    history.replaceState(
      {
        ...history.state,
        quickdockSession: {
          version: 1,
          view,
          drafts: [...drafts],
          translation: translationDraft,
        } satisfies SavedSession,
      },
      "",
    );
  } catch {
    return;
  }
  location.reload();
}
