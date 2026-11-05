import { commandLabel } from "./platform";
import { useEffect, useRef } from "react";
import {
  Search,
  Settings2,
  LayoutGrid,
  X,
  CornerDownLeft,
  Command,
  ChevronDown,
} from "lucide-react";
import { type SearchResult, type Snapshot } from "./catalog";
import { ItemIcon } from "./ItemIcon";
import { native } from "./bridge";
import DockTranslation from "./DockTranslation";
export default function CompactLauncher({
  data,
  translationOpen,
  closeTranslation,
  windowVisible,
  notify,
  query,
  setQuery,
  results,
  selected,
  setSelected,
  execute,
  settings,
  library,
  expanded,
  setExpanded,
}: {
  data: Snapshot;
  translationOpen: boolean;
  closeTranslation: () => void;
  windowVisible: boolean;
  notify: (s: string) => void;
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  selected: number;
  setSelected: (n: number) => void;
  execute: (r?: SearchResult) => Promise<void>;
  settings: () => void;
  library: () => void;
  expanded: boolean;
  setExpanded: (b: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const searching = !!query.trim();
  const visible = searching
    ? results
    : expanded
      ? results
      : results.slice(0, 16);
  useEffect(() => {
    input.current?.focus();
    const focus = () => input.current?.focus();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  useEffect(() => {
    document
      .getElementById(`compact-result-${selected}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <section
      className={`compact-launcher ${searching ? "searching" : ""}`}
      aria-label="快捷启动"
    >
      <div className="compact-search">
        <Search size={23} />
        <input
          ref={input}
          aria-label="搜索应用和工具"
          placeholder="搜索应用、工具，或输入算式…"
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(e) => {
            if (
              e.nativeEvent.isComposing ||
              composing.current ||
              e.keyCode === 229
            )
              return;
            if (translationOpen) {
              if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("dock-translate-submit")?.click();
              }
              return;
            }
            const step = searching ? 1 : 8;
            if (
              ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(
                e.key,
              ) &&
              (!searching || ["ArrowDown", "ArrowUp"].includes(e.key))
            ) {
              if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && query)
                return;
              e.preventDefault();
              const delta =
                e.key === "ArrowDown"
                  ? step
                  : e.key === "ArrowUp"
                    ? -step
                    : e.key === "ArrowRight"
                      ? 1
                      : -1;
              setSelected(
                Math.max(0, Math.min(selected + delta, visible.length - 1)),
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              void execute(visible[selected]);
            }
          }}
        />
        {query && (
          <button
            className="icon-button"
            aria-label="清空搜索"
            onClick={() => {
              setQuery("");
              setSelected(0);
              input.current?.focus();
            }}
          >
            <X size={17} />
          </button>
        )}
        <button
          className="launcher-settings"
          title={`偏好设置 · ${commandLabel} ,`}
          aria-label="偏好设置"
          onClick={settings}
        >
          <Settings2 size={20} />
        </button>
      </div>
      {data.shortcutError && (
        <div className="compact-warning" role="alert">
          {data.shortcutError}
          {data.shortcutError && " · 请在设置中更换快捷键"}
        </div>
      )}
      {translationOpen ? (
        <DockTranslation
          query={query}
          visible={windowVisible}
          back={closeTranslation}
          notify={notify}
        />
      ) : (
        <div className="compact-content">
          <div className="recent-heading">
            <strong>
              {searching
                ? "搜索结果"
                : Object.keys(data.usage).length
                  ? "最近使用"
                  : "应用与工具"}
            </strong>
            <span>
              {data.indexing ? (
                "正在更新索引…"
              ) : searching ? (
                `${results.length} 项`
              ) : (
                <button onClick={() => setExpanded(!expanded)}>
                  {expanded ? "收起" : "展开"} ({results.length}){" "}
                  <ChevronDown size={11} />
                </button>
              )}
            </span>
          </div>
          {visible.length ? (
            <div
              role="listbox"
              aria-label="搜索结果"
              className={searching ? "compact-results" : "recent-grid"}
            >
              {visible.map((r, i) => (
                <button
                  id={`compact-result-${i}`}
                  role="option"
                  aria-selected={i === selected}
                  key={`${r.kind}-${r.id}`}
                  className={`${searching ? "compact-result" : "recent-item"} ${selected === i ? "selected" : ""}`}
                  onMouseMove={() => setSelected(i)}
                  onClick={() => void execute(r)}
                >
                  <ItemIcon result={r} />
                  <span className="compact-result-text">
                    <strong>{r.title}</strong>
                    {searching && <small>{r.subtitle}</small>}
                  </span>
                  {searching && (
                    <span className="compact-kind">
                      {r.kind === "app"
                        ? "应用"
                        : r.kind === "tool"
                          ? "工具"
                          : r.kind === "bookmark"
                            ? "网址"
                            : r.kind === "websearch"
                              ? "搜索"
                              : r.kind === "translation"
                                ? "翻译"
                                : "复制"}
                    </span>
                  )}
                  {searching && selected === i && <CornerDownLeft size={14} />}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">
              <Search size={24} />
              <strong>没有找到“{query}”</strong>
              <span>试试应用名称、拼音或工具关键词</span>
            </div>
          )}
        </div>
      )}
      <footer className="compact-footer">
        <span>
          <Command size={11} />
          <span>{native ? "QuickDock" : "浏览器预览 · 示例应用"}</span>
          {!searching && !translationOpen && <span className="local-dot" />}
          {!searching && !translationOpen && <span>本地处理</span>}
        </span>
        <span>
          <button onClick={library}>
            <LayoutGrid size={12} />
            全部工具
          </button>
          <kbd>{translationOpen ? "↵ 翻译" : "↵ 打开"}</kbd>
          <kbd>{translationOpen ? "esc 返回" : "esc 隐藏"}</kbd>
        </span>
      </footer>
    </section>
  );
}
