import { useMemo } from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { errorText, t, useLocale } from "./i18n";
import ToolHeader, { copyText } from "./ToolHeader";
import { useToolDraft } from "./useToolDraft";
import { useComputed } from "./tools/useComputed";
import type { RegexResult } from "./tools/devtools";
const HIGHLIGHT_LIMIT = 64 * 1024;
const invalid = "正则表达式无效：";
// Draft fields: from = pattern, mode = flags, input = text,
// unit = "replace" when replacing, to = replacement.
export default function RegexWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [state, update] = useToolDraft("regex", {
    from: "(\\w+)@(\\w+)\\.com",
    mode: "g",
    input: "alice@example.com, bob@test.com",
    to: "$2: $1",
  });
  const empty = !state.from;
  const { result, error, pending } = useComputed("regex", state, true);
  const parsed = useMemo(
    () => (result ? (JSON.parse(result) as RegexResult) : null),
    [result],
  );
  const matches = empty ? [] : parsed?.matches || [];
  // Highlight segments; matches never overlap, zero-length ones are skipped.
  const segments = useMemo(() => {
    const text = state.input.slice(0, HIGHLIGHT_LIMIT);
    const out: { text: string; match?: number }[] = [];
    let at = 0;
    matches.forEach((m, i) => {
      if (!m.text || m.index >= text.length) return;
      out.push({ text: text.slice(at, m.index) });
      out.push({
        text: text.slice(m.index, m.index + m.text.length),
        match: i,
      });
      at = m.index + m.text.length;
    });
    out.push({ text: text.slice(at) });
    return out;
  }, [matches, state.input]);
  const replacing = state.unit === "replace";
  return (
    <section className="workspace devtool-workspace">
      <ToolHeader id="regex" back={back} notify={notify} />
      <div className={`regex-pattern ${error ? "invalid" : ""}`}>
        <span>/</span>
        <input
          autoFocus
          aria-label={t("正则表达式")}
          placeholder={t("正则表达式")}
          spellCheck={false}
          value={state.from}
          onChange={(e) => update({ from: e.target.value })}
        />
        <span>/</span>
        <input
          className="regex-flags"
          aria-label={t("标志")}
          placeholder="gimsuy"
          spellCheck={false}
          value={state.mode}
          onChange={(e) => update({ mode: e.target.value.trim() })}
        />
      </div>
      <div className="time-status">
        {error ? (
          <span className="output-error" role="alert">
            {/* The engine's own detail follows the translated prefix. */}
            {error.startsWith(invalid)
              ? t(invalid) + error.slice(invalid.length)
              : errorText(error)}
          </span>
        ) : (
          <span>
            {pending
              ? t("处理中…")
              : empty
                ? t("输入正则表达式开始匹配")
                : parsed?.truncated
                  ? t("仅显示前 1000 个匹配")
                  : t("{count} 个匹配", { count: matches.length })}
          </span>
        )}
        <label>
          <input
            type="checkbox"
            checked={replacing}
            onChange={(e) =>
              update({ unit: e.target.checked ? "replace" : "" })
            }
          />
          {t("替换")}
          {replacing && (
            <input
              className="regex-replacement"
              aria-label={t("替换为")}
              placeholder={t("替换为，可用 $1、$<name>")}
              spellCheck={false}
              value={state.to}
              onChange={(e) => update({ to: e.target.value })}
            />
          )}
        </label>
      </div>
      <div className="editor-grid">
        <div className="editor-pane">
          <div className="editor-label">
            {t("测试文本")}
            <span>{t("本地处理")}</span>
          </div>
          <textarea
            aria-label={t("测试文本")}
            spellCheck={false}
            value={state.input}
            onChange={(e) => update({ input: e.target.value })}
          />
        </div>
        <div className="editor-pane output">
          <div className="editor-label">
            {replacing ? t("替换结果") : t("匹配高亮")}
            {replacing && parsed?.replaced !== undefined && !error && (
              <button
                className="icon-button"
                aria-label={t("复制结果")}
                onClick={() => copyText(parsed.replaced!, notify, "结果已复制")}
              >
                <Copy size={13} />
              </button>
            )}
          </div>
          {replacing ? (
            <pre aria-label={t("替换结果")}>
              {empty || error ? "" : (parsed?.replaced ?? "")}
            </pre>
          ) : (
            <pre className="regex-highlight" aria-label={t("匹配高亮")}>
              {segments.map((s, i) =>
                s.match === undefined ? (
                  s.text
                ) : (
                  <mark key={i} className={s.match % 2 ? "alt" : ""}>
                    {s.text}
                  </mark>
                ),
              )}
            </pre>
          )}
          {!!matches.length && (
            <ol className="regex-matches" aria-label={t("匹配列表")}>
              {matches.slice(0, 200).map((m, i) => (
                <li key={i}>
                  <button onClick={() => copyText(m.text, notify)}>
                    <span>#{i + 1}</span>
                    <code>{m.text || "∅"}</code>
                    <small>@{m.index}</small>
                  </button>
                  {[
                    ...m.groups.map((v, g) => [`$${g + 1}`, v] as const),
                    ...Object.entries(m.named).map(
                      ([name, v]) => [`<${name}>`, v] as const,
                    ),
                  ].map(([label, value]) => (
                    <div key={label} className="regex-group">
                      <span>{label}</span>
                      <code>{value ?? "undefined"}</code>
                    </div>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("JavaScript 正则语法 · 在后台线程匹配，超时自动停止。")}
      </div>
    </section>
  );
}
