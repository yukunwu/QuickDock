import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Pin,
  PinOff,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { errorText, getLanguage, t, useLocale } from "./i18n";
import * as bridge from "./bridge";
import type { ClipboardEntry } from "./bridge";
import type { Settings } from "./catalog";
import type { Draft } from "./tools/compute";
import { drafts } from "./toolSession";
import ToolHeader from "./ToolHeader";
import { orderClipboard } from "./tools/clipboard";
export default function ClipboardWorkspace({
  back,
  notify,
  settings,
  saveSettings,
}: {
  back: () => void;
  notify: (s: string) => void;
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
}) {
  useLocale();
  const enabled = !!settings.clipboardHistory;
  const [query, setQuery] = useState(() => {
    const old = drafts.get("clipboard");
    const draft: Draft = {
      input: old?.input ?? "",
      mode: "",
      unit: "",
      zone: "",
      group: "",
      from: "",
      to: "",
      count: 0,
      generated: "",
    };
    drafts.set("clipboard", draft);
    return draft.input;
  });
  const search = (input: string) => {
    setQuery(input);
    setSelected(0);
    const old = drafts.get("clipboard")!;
    drafts.set("clipboard", { ...old, input });
  };
  const [records, setRecords] = useState<ClipboardEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      void bridge
        .clipboardHistory()
        .then((rows) => {
          if (active) {
            setRecords(rows);
            setError("");
          }
        })
        .catch((e) => active && setError(errorText(e)));
    load();
    window.addEventListener("quickdock-clipboard-history", load);
    return () => {
      active = false;
      window.removeEventListener("quickdock-clipboard-history", load);
    };
  }, []);
  const visible = useMemo(
    () => orderClipboard(records, query),
    [records, query],
  );
  useEffect(() => {
    document
      .getElementById(`clipboard-row-${selected}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (next: boolean) =>
    run(async () => {
      await saveSettings({ ...settings, clipboardHistory: next });
      notify(next ? t("已开始记录剪贴板") : t("已暂停记录，历史仍保留"));
      input.current?.focus();
    });
  const use = (entry?: ClipboardEntry) =>
    entry &&
    run(async () => {
      await bridge.restoreClipboard(entry);
      notify(t("已复制，可直接粘贴"));
    });
  const time = (ms: number) =>
    new Date(ms).toLocaleString(getLanguage(), {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <section className="workspace clipboard-workspace">
      <ToolHeader id="clipboard" back={back} notify={notify}>
        <label className="clipboard-recording">
          {t("记录剪贴板")}
          <button
            role="switch"
            aria-label={t("记录剪贴板")}
            aria-checked={enabled}
            disabled={busy}
            className={`switch ${enabled ? "on" : ""}`}
            onClick={() => void toggle(!enabled)}
          >
            <span />
          </button>
        </label>
      </ToolHeader>
      {error && (
        <div className="inline-warning" role="alert">
          {error}
        </div>
      )}
      {!enabled && !records.length ? (
        <div className="clipboard-intro">
          <span className="item-icon yellow large">
            <ClipboardList size={30} />
          </span>
          <h3>{t("开启后，QuickDock 会在本机记录你复制的文本")}</h3>
          <ul>
            <li>{t("只记录文本，最多 200 条，单条不超过 100 KB")}</li>
            <li>{t("密码管理器标记为隐藏的内容不会记录")}</li>
            <li>{t("可随时暂停、删除单条或清空；固定的条目不会被挤掉")}</li>
          </ul>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void toggle(true)}
          >
            {t("开启剪贴板记录")}
          </button>
        </div>
      ) : (
        <>
          <div className="search-wrap clipboard-search">
            <Search size={18} />
            <input
              ref={input}
              autoFocus
              aria-label={t("搜索剪贴板")}
              placeholder={t("搜索剪贴板…")}
              value={query}
              spellCheck={false}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((n) =>
                    Math.max(
                      0,
                      Math.min(
                        n + (e.key === "ArrowDown" ? 1 : -1),
                        visible.length - 1,
                      ),
                    ),
                  );
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  void use(visible[selected]);
                }
              }}
            />
            <span>{t("{count} 项", { count: visible.length })}</span>
          </div>
          {!enabled && (
            <div className="inline-warning">{t("已暂停记录，历史仍保留")}</div>
          )}
          <div
            className="clipboard-list"
            role="listbox"
            aria-label={t("剪贴板历史")}
          >
            {!visible.length ? (
              <div className="empty">
                {records.length
                  ? t("没有找到“{query}”", { query })
                  : t("复制一段文本，它会出现在这里。")}
              </div>
            ) : (
              visible.map((entry, i) => (
                <div
                  key={entry.id}
                  id={`clipboard-row-${i}`}
                  role="option"
                  aria-selected={i === selected}
                  className={`clipboard-row ${i === selected ? "selected" : ""}`}
                  onMouseMove={() => setSelected(i)}
                >
                  <button
                    className="clipboard-use"
                    aria-label={t("复制 {text}", {
                      text: entry.text.slice(0, 40),
                    })}
                    disabled={busy}
                    onClick={() => void use(entry)}
                  >
                    <strong>{entry.text.slice(0, 600)}</strong>
                    <small>
                      {entry.pinned && <Pin size={10} />}
                      {time(entry.createdAt)} ·{" "}
                      {t("{count} 个字符", { count: [...entry.text].length })}
                    </small>
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={entry.pinned ? t("取消固定") : t("固定")}
                    title={entry.pinned ? t("取消固定") : t("固定")}
                    onClick={() =>
                      void run(async () =>
                        setRecords(
                          await bridge.pinClipboard(entry.id, !entry.pinned),
                        ),
                      )
                    }
                  >
                    {entry.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={t("删除")}
                    title={t("删除")}
                    onClick={() =>
                      void run(async () =>
                        setRecords(await bridge.deleteClipboard(entry.id)),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
          {records.some((r) => !r.pinned) && (
            <div className="history-clear">
              {confirmClear ? (
                <>
                  <span>{t("清空未固定的记录？此操作不可恢复。")}</span>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setRecords(await bridge.clearClipboard());
                        setConfirmClear(false);
                        setSelected(0);
                      })
                    }
                  >
                    {t("确认清空历史")}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setConfirmClear(false)}
                  >
                    {t("取消")}
                  </button>
                </>
              ) : (
                <button
                  className="secondary"
                  onClick={() => setConfirmClear(true)}
                >
                  {t("清空历史")}
                </button>
              )}
            </div>
          )}
        </>
      )}
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t(
          "剪贴板历史只保存在本机；↵ 复制所选条目并隐藏 Dock，回到原应用直接粘贴。",
        )}
      </div>
    </section>
  );
}
