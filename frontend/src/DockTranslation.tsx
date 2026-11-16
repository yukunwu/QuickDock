import { errorText, t, useLocale } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  History,
  RotateCw,
  Languages,
} from "lucide-react";
import TranslationHistory, {
  useTranslationHistory,
} from "./TranslationHistory";
import type { TranslationRecord } from "./bridge";
import * as bridge from "./bridge";
import ToolWindowButton from "./ToolWindowButton";
import { getDockTranslation, setDockTranslation } from "./toolSession";
import { guessSource, languages } from "./tools/online";
export default function DockTranslation({
  query,
  visible,
  back,
  notify,
  onQueryChange,
  onPickQuery,
}: {
  query: string;
  visible: boolean;
  back: () => void;
  notify: (s: string) => void;
  onQueryChange?: (s: string) => void;
  // Dock only: replaces the search text when a history entry is loaded.
  onPickQuery?: (s: string) => void;
  autoRun?: boolean;
}) {
  useLocale();
  const detached =
    new URLSearchParams(location.search).get("tool") === "translate";
  const content = useRef<HTMLDivElement>(null);
  const windowID = detached ? "translate" : "launcher";
  // null follows the text: Chinese → English, anything else → Chinese.
  const [chosen, setChosen] = useState<string | null>(() => {
    const saved = getDockTranslation(query)?.target;
    return saved && saved !== guessTarget(query) ? saved : null;
  });
  const target = chosen ?? guessTarget(query);
  const dock = !onQueryChange && !detached;
  const [error, setError] = useState("");
  const attached = useRef(false);
  const history = useTranslationHistory();
  // The Dock is narrow, so its history starts closed; tool pages show it.
  const [historyOpen, setHistoryOpen] = useState(!dock);
  const pick = (record: TranslationRecord) => {
    setChosen(
      record.target === guessTarget(record.text) ? null : record.target,
    );
    if (dock) onPickQuery?.(record.text);
    else onQueryChange?.(record.text);
    void change("submit", record.target, record.text);
  };
  const change = async (
    action: "attach" | "submit" | "reload" | "layout" | "browser" | "focus",
    to = target,
    text = query,
  ) => {
    try {
      setError("");
      await bridge.googleTranslationPage(
        windowID,
        text,
        "auto",
        to,
        action,
        (() => {
          const r = content.current!.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })(),
      );
      attached.current = true;
    } catch (e) {
      setError(errorText(e).replace(/^(?:RuntimeError|Error):\s*/, ""));
    }
  };
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (attached.current) void change("layout");
    });
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setDockTranslation({
      query,
      source: "auto",
      target,
      provider: "google",
      answer: null,
    });
  }, [query, target]);
  useEffect(() => {
    void change(detached ? "attach" : query ? "submit" : "attach").then(() => {
      if (!dock) void change("focus");
    });
    return () => {
      attached.current = false;
      void bridge
        .googleTranslationPage(windowID, "", "auto", "zh-CN", "detach")
        .catch(() => {});
    };
  }, []);
  useEffect(() => {
    const flush = () =>
      void bridge
        .googleTranslationPage(windowID, "", "auto", "zh-CN", "flush")
        .catch((e) => notify(errorText(e)));
    window.addEventListener("quickdock-google-flush", flush);
    return () => window.removeEventListener("quickdock-google-flush", flush);
  }, []);
  return (
    <div className="google-page-shell" aria-label={t("Google网页翻译")}>
      <div className="google-page-toolbar">
        <button
          className="icon-button"
          aria-label={t("返回搜索结果")}
          title={t("返回") + " · Esc"}
          onClick={() => {
            void bridge
              .googleTranslationPage(windowID, "", "auto", "zh-CN", "detach")
              .then(back)
              .catch((e) => notify(errorText(e)));
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <Languages size={18} />
        <strong>{t("Google 翻译")}</strong>
        {dock && (
          <label className="google-target">
            {t("译为")}
            <select
              aria-label={t("目标语言")}
              value={target}
              onChange={(e) => {
                const next = e.target.value;
                setChosen(next === guessTarget(query) ? null : next);
                if (query.trim()) void change("submit", next);
              }}
            >
              {languages.map(([id, label]) => (
                <option key={id} value={id}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        )}
        {dock && (
          <button
            id="dock-translate-submit"
            className="primary"
            title="Enter"
            disabled={!query.trim()}
            onClick={() => void change("submit")}
          >
            {t("翻译输入")}
          </button>
        )}
        <span className="google-page-actions">
          <button
            className="icon-button"
            aria-label={t("重新加载翻译网页")}
            title={t("重新加载")}
            onClick={() => void change("reload")}
          >
            <RotateCw size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={t("浏览器打开")}
            title={t("浏览器打开")}
            onClick={() =>
              bridge.native
                ? void change("browser")
                : void bridge
                    .openTranslationPage(query, "auto", target)
                    .catch((e) => notify(errorText(e)))
            }
          >
            <ExternalLink size={15} />
          </button>
        </span>
        <button
          className={`secondary ${historyOpen ? "active" : ""}`}
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <History size={14} />
          {t("历史")} {history.records.length || ""}
        </button>
        <ToolWindowButton id="translate" notify={notify} />
      </div>
      <div className="google-page-body">
        <div className="google-page-content" ref={content}>
          {error ? (
            <div className="inline-warning" role="alert">
              {error}
            </div>
          ) : !bridge.native ? (
            <div className="google-preview">
              <p>{t("桌面版在这里直接显示 Google 翻译网页")}</p>
              <p>{t("原生 WebView 支持页面输入、翻译及网站验证。")}</p>
              <textarea
                aria-label={t("翻译原文")}
                value={query}
                onChange={(e) => onQueryChange?.(e.target.value)}
                placeholder={t("浏览器预览不嵌入第三方网页")}
              />
            </div>
          ) : null}
        </div>
        {historyOpen && (
          <TranslationHistory
            history={history}
            pick={pick}
            close={() => setHistoryOpen(false)}
          />
        )}
      </div>
      <div className="google-page-note">
        {t("Google 翻译网页 · 网络与网站验证由 Google 处理")} ·{" "}
        {t("翻译自动记录在本机")}
      </div>
    </div>
  );
}
function guessTarget(text: string) {
  return guessSource(text) === "en" ? "zh-CN" : "en";
}
