import { getBookmarkDraft, setBookmarkDraft } from "./toolSession";
import { useState } from "react";
import { Pencil, Trash2, Globe } from "lucide-react";
import type { Bookmark, Settings } from "./catalog";
import * as bridge from "./bridge";
const blank = { id: "", name: "", url: "", alias: "" };
let draft: Bookmark = { ...blank };
export default function BookmarkEditor({
  settings,
  saveSettings,
  notify,
}: {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [form, setForm] = useState(
    () => (getBookmarkDraft() as Bookmark | undefined) || draft,
  );
  const [busy, setBusy] = useState(false);
  const update = (next: Bookmark) => {
    draft = next;
    setBookmarkDraft(next);
    setForm(next);
  };
  const persist = async (bookmarks: Bookmark[]) => {
    setBusy(true);
    try {
      await saveSettings({ ...settings, bookmarks });
      return true;
    } catch (e) {
      notify(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <form
        className="bookmark-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const url = new URL(form.url);
            if (url.username || url.password)
              throw new Error("网址不能包含登录凭据");
            if (!["https:", "http:"].includes(url.protocol))
              throw new Error("网址只支持 http:// 或 https://");
            if (!form.name.trim()) throw new Error("请输入网址名称");
            const item = {
              ...form,
              id: form.id || crypto.randomUUID(),
              name: form.name.trim(),
              url: url.href,
            };
            if (
              await persist(
                form.id
                  ? settings.bookmarks.map((b) => (b.id === form.id ? item : b))
                  : [...settings.bookmarks, item],
              )
            )
              update({ ...blank });
          } catch (e) {
            notify(String(e));
          }
        }}
      >
        <input
          aria-label="网址名称"
          placeholder="名称"
          value={form.name}
          onChange={(e) => update({ ...form, name: e.target.value })}
          required
        />
        <input
          aria-label="网址地址"
          placeholder="https://example.com"
          value={form.url}
          onChange={(e) => update({ ...form, url: e.target.value })}
          required
        />
        <input
          aria-label="网址别名"
          placeholder="搜索别名"
          value={form.alias}
          onChange={(e) => update({ ...form, alias: e.target.value })}
        />
        <button className="primary" disabled={busy}>
          {form.id ? "保存" : "添加"}
        </button>
        {form.id && (
          <button
            type="button"
            className="secondary"
            onClick={() => update({ ...blank })}
          >
            取消编辑
          </button>
        )}
      </form>
      <div className="bookmark-list">
        {settings.bookmarks.map((b) => (
          <div className="bookmark-row" key={b.id}>
            <Globe size={20} />
            <div className="bookmark-info">
              <strong>{b.name}</strong>
              <p>
                {b.url}
                {b.alias && ` · ${b.alias}`}
              </p>
            </div>
            <button
              className="secondary"
              onClick={() =>
                void bridge.openBookmark(b.id).catch((e) => notify(String(e)))
              }
            >
              打开
            </button>
            <button
              className="icon-button"
              aria-label={`编辑${b.name}`}
              onClick={() => update({ ...b })}
            >
              <Pencil size={15} />
            </button>
            <button
              className="icon-button"
              disabled={busy}
              aria-label={`删除${b.name}`}
              onClick={() =>
                void persist(settings.bookmarks.filter((x) => x.id !== b.id))
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!settings.bookmarks.length && (
          <div className="empty">
            添加常用网址后，可通过名称、拼音或别名快速打开。
          </div>
        )}
      </div>
    </>
  );
}
