import {
  errorText,
  t,
  t as translate,
  setLanguage,
  getLanguage,
  useLocale,
} from "./i18n";
import { commandLabel } from "./platform";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  Search,
  Settings2,
  LayoutGrid,
  Zap,
  ExternalLink,
  ChevronRight,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  tools,
  defaults,
  type Settings,
  type Snapshot,
  type SearchResult,
  type ToolID,
} from "./catalog";
import * as bridge from "./bridge";
import { searchEntries } from "./search";
import CompactLauncher from "./CompactLauncher";
import { restoredView, reclaimHiddenSession } from "./toolSession";
const ToolWorkspace = lazy(() => import("./ToolWorkspace"));
const SettingsPage = lazy(() => import("./SettingsPage"));
const empty: Snapshot = {
  apps: [],
  settings: defaults,
  usage: {},
  indexing: true,
  error: "",
  shortcutError: "",
};
export default function App() {
  useLocale();
  const [data, setData] = useState<Snapshot>(empty),
    [page, setPage] = useState<"launch" | "tools" | "settings">(
      restoredView?.page || "launch",
    );
  const [activeTool, setActiveTool] = useState<ToolID | null>(
      restoredView?.activeTool || null,
    ),
    [query, setQuery] = useState(restoredView?.query || ""),
    [selected, setSelected] = useState(restoredView?.selected || 0),
    [expanded, setExpanded] = useState(restoredView?.expanded || false);
  const [visible, setVisible] = useState(!restoredView);
  const [translationOpen, setTranslationOpen] = useState(
    restoredView?.translationOpen || false,
  );
  useEffect(() => {
    let active = true;
    let notified = false;
    // Complete cleanup in the native notification turn, before WebKit suspends
    // background work. Showing restores the draft and recomputes its result.
    const nativeVisibility = (event: Event) => {
      notified = true;
      flushSync(() => setVisible((event as CustomEvent<boolean>).detail));
    };
    const browserVisibility = () => {
      notified = true;
      setVisible(!document.hidden);
    };
    window.addEventListener("quickdock-visibility", nativeVisibility);
    document.addEventListener("visibilitychange", browserVisibility);
    if (bridge.native)
      void bridge
        .isVisible()
        .then((value) => {
          if (active && !notified) setVisible(value);
        })
        .catch(() => {
          /* Keep the session hidden until the next native show. */
        });
    return () => {
      active = false;
      window.removeEventListener("quickdock-visibility", nativeVisibility);
      document.removeEventListener("visibilitychange", browserVisibility);
    };
  }, []);
  const [category, setCategory] = useState(restoredView?.category || "全部"),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const reclaim = () => {
      if (!visible)
        reclaimHiddenSession({
          page,
          activeTool,
          query,
          selected,
          expanded,
          category,
          translationOpen,
        });
    };
    window.addEventListener("quickdock-idle", reclaim);
    return () => window.removeEventListener("quickdock-idle", reclaim);
  }, [
    visible,
    translationOpen,
    page,
    activeTool,
    query,
    selected,
    expanded,
    category,
  ]);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const load = useCallback(
    () =>
      bridge
        .snapshot()
        .then((value) => {
          setLanguage(value.settings.language);
          void bridge.syncUILanguage(getLanguage());
          setData(value);
        })
        .catch((e) => notify(errorText(e))),
    [notify],
  );
  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearTimeout(toastTimer.current);
    };
  }, [load]);
  useEffect(() => {
    if (!data.indexing) return;
    const timer = setInterval(() => void load(), 1000);
    return () => clearInterval(timer);
  }, [data.indexing, load]);
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);
  const compact = !activeTool && page === "launch";
  useEffect(() => {
    void bridge
      .setView(
        compact
          ? translationOpen
            ? "translation"
            : expanded
              ? "expanded"
              : "launcher"
          : "workspace",
      )
      .catch((e) => notify(errorText(e)));
  }, [compact, expanded, translationOpen, notify]);
  const navigate = (p: typeof page) => {
    setTranslationOpen(false);
    setToast("");
    setPage(p);
    setActiveTool(null);
    setQuery("");
    setSelected(0);
    setExpanded(false);
  };
  const available = tools.filter(
    (t) => !data.settings.disabledTools.includes(t.id),
  );
  const locale = getLanguage();
  const results = useMemo(
    () => searchEntries(query, data),
    [query, data, locale],
  );
  const save = async (settings: Settings) => {
    setBusy(true);
    try {
      const saved = await bridge.saveSettings(settings);
      setLanguage(saved.language);
      void bridge.syncUILanguage(getLanguage());
      setData((d) => ({ ...d, settings: saved, shortcutError: "" }));
      notify(t("设置已保存"));
    } catch (e) {
      notify(errorText(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const execute = async (r?: SearchResult) => {
    if (!r) return;
    setToast("");
    try {
      if (r.kind === "websearch") {
        await bridge.openGoogleSearch(r.value || query);
      } else if (r.kind === "translation") {
        setTranslationOpen(true);
      } else if (r.kind === "tool") {
        setTranslationOpen(false);
        setActiveTool(r.id as ToolID);
        await bridge.recordUsage(r.id);
      } else if (r.kind === "app") await bridge.launch(r.id);
      else if (r.kind === "bookmark") await bridge.openBookmark(r.id);
      else {
        await bridge.copy(r.value || "");
        notify(t("计算结果已复制"));
      }
      void load();
    } catch (e) {
      notify(errorText(e));
    }
  };
  useEffect(() => {
    const escape = () => {
      if (translationOpen || activeTool || page !== "launch")
        navigate("launch");
      else void bridge.hide().catch((e) => notify(errorText(e)));
    };
    const fn = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || e.repeat) return;
      if (e.key === "Escape") {
        e.preventDefault();
        escape();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        navigate("settings");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        void bridge.hide();
      }
    };
    const openSettings = () => navigate("settings");
    window.addEventListener("quickdock-open-settings", openSettings);
    window.addEventListener("keydown", fn);
    window.addEventListener("quickdock-escape", escape);
    return () => {
      window.removeEventListener("keydown", fn);
      window.removeEventListener("quickdock-escape", escape);
      window.removeEventListener("quickdock-open-settings", openSettings);
    };
  }, [activeTool, page, translationOpen]);
  const cards = available.filter(
    (t) =>
      (category === "全部" || t.category === category) &&
      `${t.name} ${t.keywords}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      className={`desktop macos ${bridge.native ? "native" : ""} ${compact ? "compact-desktop" : ""}`}
    >
      <div className={compact ? "launcher-shell" : "app-shell"}>
        {compact ? (
          <CompactLauncher
            data={data}
            translationOpen={translationOpen}
            closeTranslation={() => setTranslationOpen(false)}
            windowVisible={visible}
            notify={notify}
            query={query}
            setQuery={setQuery}
            results={results}
            selected={selected}
            setSelected={setSelected}
            execute={execute}
            settings={() => navigate("settings")}
            library={() => navigate("tools")}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        ) : (
          <>
            {!activeTool && (
              <aside className="sidebar">
                <div className="brand">
                  <span className="brand-mark">
                    <Zap size={21} />
                  </span>
                  <span>QuickDock</span>
                </div>

                <nav>
                  <button
                    className="nav-item"
                    onClick={() => navigate("launch")}
                  >
                    <Search size={17} />
                    {t("快捷启动")}
                  </button>
                  <button
                    className={`nav-item ${page === "tools" || activeTool ? "active" : ""}`}
                    onClick={() => navigate("tools")}
                  >
                    <LayoutGrid size={17} />
                    {t("工具库")}
                    <span className="count">{available.length}</span>
                  </button>
                  <button
                    className={`nav-item ${page === "settings" && !activeTool ? "active" : ""}`}
                    onClick={() => navigate("settings")}
                  >
                    <Settings2 size={17} />
                    {t("偏好设置")}
                  </button>
                </nav>
                <div className="sidebar-bottom">
                  <div className="local-status">
                    <span />
                    {bridge.native ? t("本地运行") : t("浏览器预览 · 示例应用")}
                  </div>
                </div>
              </aside>
            )}
            <main className="main">
              {!activeTool && (
                <header className="topbar">
                  <button
                    className="icon-button"
                    aria-label={t("返回快捷启动")}
                    onClick={() => navigate("launch")}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <div className="breadcrumb">
                    QuickDock
                    <ChevronRight size={13} />
                    <strong>
                      {activeTool
                        ? tools.find((t) => t.id === activeTool)?.name
                        : page === "settings"
                          ? t("偏好设置")
                          : t("工具库")}
                    </strong>
                  </div>
                  <span className="shortcut-pill">
                    {data.settings.shortcut
                      .replace("Option", "⌥")
                      .replace("+", " ")}
                  </span>
                </header>
              )}
              {!activeTool && data.shortcutError && (
                <div className="inline-warning" role="alert">
                  {errorText(data.shortcutError)} {t("· 请在设置中更换快捷键")}
                </div>
              )}
              {activeTool ? (
                visible ? (
                  <Suspense
                    fallback={<div className="empty">{t("正在打开工具…")}</div>}
                  >
                    <ToolWorkspace
                      id={activeTool}
                      settings={data.settings}
                      saveSettings={save}
                      notify={notify}
                      back={() => setActiveTool(null)}
                    />
                  </Suspense>
                ) : null
              ) : page === "settings" ? (
                <Suspense
                  fallback={<div className="empty">{t("正在加载设置…")}</div>}
                >
                  <SettingsPage
                    data={data}
                    busy={busy}
                    save={save}
                    notify={notify}
                    refresh={async () => {
                      try {
                        setData(await bridge.refreshApps());
                        notify(t("应用索引正在刷新"));
                      } catch (e) {
                        notify(errorText(e));
                      }
                    }}
                  />
                </Suspense>
              ) : (
                <>
                  <section className="page-heading">
                    <div>
                      <h1>{t("工具库")}</h1>
                      <p>{t("文本、计算与常用网址")}</p>
                    </div>
                  </section>
                  <div className="search-wrap">
                    <Search size={18} />
                    <input
                      aria-label={t("搜索工具")}
                      value={query}
                      placeholder={t("查找工具…")}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label={t("清空搜索")}
                        onClick={() => setQuery("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <div className="tools-area">
                    <div className="filter-row">
                      <div className="segmented">
                        {["全部", "开发", "日常"].map((c) => (
                          <button
                            key={t(c)}
                            className={category === c ? "active" : ""}
                            onClick={() => setCategory(c)}
                          >
                            {t(c)}
                          </button>
                        ))}
                      </div>
                      <span>
                        {cards.length} {t("个工具")}
                      </span>
                    </div>
                    <div className="tool-grid">
                      {cards.map((t) => (
                        <div key={t.id} className="tool-card">
                          <button
                            className="tool-card-body"
                            onClick={() =>
                              void execute({
                                id: t.id,
                                title: t.name,
                                subtitle: t.subtitle,
                                kind: "tool",
                                icon: t.icon,
                                color: t.color,
                              })
                            }
                          >
                            <div className="card-top">
                              <span className={`item-icon ${t.color}`}>
                                <t.icon size={23} />
                              </span>
                            </div>
                            <h3>{t.name}</h3>
                            <p>{t.subtitle}</p>
                          </button>
                          <button
                            className="tool-detach"
                            aria-label={translate("独立打开 {tool}", {
                              tool: t.name,
                            })}
                            onClick={() =>
                              void bridge
                                .openToolWindow(t.id)
                                .catch((e) => notify(errorText(e)))
                            }
                          >
                            <ExternalLink size={16} />
                            <span>{translate("独立打开")}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    {!cards.length && (
                      <div className="empty">
                        {t("没有匹配的工具，可在设置中启用工具。")}
                      </div>
                    )}
                  </div>
                </>
              )}
              {!activeTool && (
                <footer>
                  <span>
                    <kbd>esc</kbd>
                    {t("返回")}
                    <kbd>{commandLabel} W</kbd>
                    {t("隐藏窗口")}
                  </span>
                  <span>{t("内置工具 · 按需使用")}</span>
                </footer>
              )}
            </main>
          </>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button
              className="icon-button"
              aria-label={t("关闭提示")}
              onClick={() => setToast("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      {!bridge.native && (
        <div className="desktop-caption">
          QUICKDOCK <span>{t("随唤 · 随用")}</span>
        </div>
      )}
    </div>
  );
}
