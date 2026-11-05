import { errorText, t, getLanguage, setLanguage, useLocale } from "./i18n";
import { commandLabel } from "./platform";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { tools, defaults, type ToolID, type Settings } from "./catalog";
import * as bridge from "./bridge";
import { exportToolSession, importToolSession } from "./toolSession";
const ToolWorkspace = lazy(() => import("./ToolWorkspace"));

export default function DetachedApp({ id }: { id: ToolID }) {
  useLocale();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [ready, setReady] = useState(false),
    [fatal, setFatal] = useState("");
  const [status, setStatus] = useState(t("正在恢复窗口…")),
    [notice, setNotice] = useState("");
  const flush = useRef<() => Promise<void>>(async () => {
    throw Error(t("正在恢复窗口，请稍候"));
  });
  const closing = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.all([bridge.toolWindowState(id), bridge.snapshot()])
      .then(([state, data]) => {
        if (!active) return;
        importToolSession(id, state.session);
        setLanguage(data.settings.language);
        void bridge.syncUILanguage(getLanguage());
        setSettings(data.settings);
        setReady(true);
        setStatus(t("工具内容自动保存在本机"));
      })
      .catch((e) => {
        if (active) {
          setFatal(errorText(e));
          setStatus(t("恢复失败，原文件未覆盖"));
          flush.current = async () => {};
        }
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const refresh = () =>
      void bridge.snapshot().then((data) => {
        setSettings(data.settings);
        setLanguage(data.settings.language);
      });
    window.addEventListener("quickdock-settings-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("quickdock-settings-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let chain: Promise<void> = Promise.resolve();
    let revision = 0;
    const save = async () => {
      clearTimeout(timer);
      if (id === "translate")
        await bridge.googleTranslationPage(
          "translate",
          "",
          "auto",
          "zh-CN",
          "flush",
        );
      const value = exportToolSession(id),
        current = revision;
      const work = chain
        .catch(() => {})
        .then(() => bridge.saveToolWindow(id, value));
      chain = work;
      return work.then(() => {
        if (current === revision) setStatus(t("已保存到本机"));
      });
    };
    flush.current = save;
    const changed = () => {
      revision++;
      setStatus(t("正在保存…"));
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          void save().catch((e) => setStatus(t("保存失败：") + errorText(e))),
        250,
      );
    };
    window.addEventListener("quickdock-draft-changed", changed);
    // Save initial values too; child effects may run before this listener exists.
    changed();
    return () => {
      clearTimeout(timer);
      window.removeEventListener("quickdock-draft-changed", changed);
    };
  }, [ready, id]);
  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    try {
      await flush.current();
      await bridge.closeToolWindow(id);
    } catch (e) {
      setStatus(t("保存失败，窗口已保留：") + errorText(e));
    } finally {
      closing.current = false;
    }
  };
  useEffect(() => {
    const onClose = () => void close();
    const onQuit = () =>
      void flush
        .current()
        .then(() => bridge.toolQuitReady(id))
        .catch((e) => setStatus(t("保存失败，退出已取消：") + errorText(e)));
    const onError = () =>
      setStatus(t("窗口位置保存失败，请检查磁盘空间与文件权限"));
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || e.repeat) return;
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "w")) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("quickdock-tool-close", onClose);
    window.addEventListener("quickdock-escape", onClose);
    window.addEventListener("quickdock-tool-quit", onQuit);
    window.addEventListener("quickdock-tool-save-error", onError);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("quickdock-tool-close", onClose);
      window.removeEventListener("quickdock-escape", onClose);
      window.removeEventListener("quickdock-tool-quit", onQuit);
      window.removeEventListener("quickdock-tool-save-error", onError);
      window.removeEventListener("keydown", key);
    };
  }, [id]);
  return (
    <div
      className={`desktop macos detached-desktop ${bridge.native ? "native" : ""}`}
    >
      <div className="app-shell detached-shell">
        <main className="main">
          {ready ? (
            <Suspense
              fallback={<div className="empty">{t("正在打开工具…")}</div>}
            >
              <ToolWorkspace
                id={id}
                settings={settings}
                saveSettings={async (s) => {
                  setSettings(await bridge.saveSettings(s));
                }}
                notify={setNotice}
                back={() => void close()}
              />
            </Suspense>
          ) : (
            <div className="empty">
              {fatal || t("正在恢复工具…")}
              {fatal && (
                <button onClick={() => void close()}>{t("关闭窗口")}</button>
              )}
            </div>
          )}
          <div className="detached-status">
            <span role="status">
              {id === "translate"
                ? t("Google网页 · 原文和语言在本机恢复")
                : status}
            </span>
            <span>
              {tools.find((t) => t.id === id)?.name} {t("· 独立窗口 ·")}{" "}
              {commandLabel} {t("W 关闭")}
            </span>
          </div>
          {notice && (
            <div className="toast" role="alert" onClick={() => setNotice("")}>
              {notice}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
