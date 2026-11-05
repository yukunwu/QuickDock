import { errorText, t, useLocale } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, RotateCw, Languages } from "lucide-react";
import * as bridge from "./bridge";
import ToolWindowButton from "./ToolWindowButton";
import { setDockTranslation } from "./toolSession";
import { guessSource } from "./tools/online";
export default function DockTranslation({
  query,
  visible,
  back,
  notify,
  onQueryChange,
}: {
  query: string;
  visible: boolean;
  back: () => void;
  notify: (s: string) => void;
  onQueryChange?: (s: string) => void;
  autoRun?: boolean;
}) {
  useLocale();
  const detached =
    new URLSearchParams(location.search).get("tool") === "translate";
  const content = useRef<HTMLDivElement>(null);
  const windowID = detached ? "translate" : "launcher";
  const target = guessSource(query) === "en" ? "zh-CN" : "en";
  const [error, setError] = useState("");
  const attached = useRef(false);
  const change = async (
    action: "attach" | "submit" | "reload" | "layout" | "browser",
  ) => {
    try {
      setError("");
      await bridge.googleTranslationPage(
        windowID,
        query,
        "auto",
        target,
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
    void change(detached ? "attach" : query ? "submit" : "attach");
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
        <ToolWindowButton id="translate" notify={notify} />
        {!onQueryChange && (
          <button
            id="dock-translate-submit"
            className="primary"
            onClick={() => void change("submit")}
          >
            {t("翻译输入")}
          </button>
        )}
        <button
          className="secondary"
          aria-label={t("重新加载翻译网页")}
          onClick={() => void change("reload")}
        >
          <RotateCw size={14} />
          {t("重新加载")}
        </button>
        <button
          className="secondary"
          onClick={() =>
            bridge.native
              ? void change("browser")
              : void bridge
                  .openTranslationPage(query, "auto", target)
                  .catch((e) => notify(errorText(e)))
          }
        >
          <ExternalLink size={14} />
          {t("浏览器打开")}
        </button>
      </div>
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
      <div className="google-page-note">
        {t("Google 翻译网页 · 网络与网站验证由 Google 处理")}
      </div>
    </div>
  );
}
