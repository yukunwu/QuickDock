import { useMemo } from "react";
import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import { errorText, t, useLocale } from "./i18n";
import ToolHeader from "./ToolHeader";
import { useToolDraft } from "./useToolDraft";
import { lineDiff } from "./tools/devtools";
const ROW_LIMIT = 5000;
// Draft fields: input = original, generated = changed, mode = "trim" to
// ignore whitespace differences.
export default function DiffWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [state, update] = useToolDraft("diff", {});
  const diff = useMemo(() => {
    if (!state.input && !state.generated) return { rows: null, error: "" };
    try {
      return {
        rows: lineDiff(state.input, state.generated, state.mode === "trim"),
        error: "",
      };
    } catch (e) {
      return { rows: null, error: errorText(e) };
    }
  }, [state.input, state.generated, state.mode]);
  const added = diff.rows?.filter((r) => r.type === "add").length || 0;
  const removed = diff.rows?.filter((r) => r.type === "del").length || 0;
  return (
    <section className="workspace devtool-workspace">
      <ToolHeader id="diff" back={back} notify={notify}>
        <button
          className="secondary"
          onClick={() =>
            update({ input: state.generated, generated: state.input })
          }
        >
          <ArrowLeftRight size={14} />
          {t("交换")}
        </button>
      </ToolHeader>
      <div className="editor-grid diff-inputs">
        {(
          [
            ["input", t("原文本")],
            ["generated", t("新文本")],
          ] as const
        ).map(([key, label], i) => (
          <div className="editor-pane" key={key}>
            <div className="editor-label">{label}</div>
            <textarea
              autoFocus={i === 0}
              aria-label={label}
              spellCheck={false}
              placeholder={t("在这里输入…")}
              value={state[key]}
              onChange={(e) => update({ [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="time-status">
        {diff.error ? (
          <span className="output-error" role="alert">
            {diff.error}
          </span>
        ) : (
          <span>
            {!diff.rows
              ? t("输入两段文本，逐行比较差异")
              : added || removed
                ? t("新增 {added} 行 · 删除 {removed} 行", { added, removed })
                : t("两段文本相同")}
          </span>
        )}
        <label>
          <input
            type="checkbox"
            checked={state.mode === "trim"}
            onChange={(e) => update({ mode: e.target.checked ? "trim" : "" })}
          />
          {t("忽略空白差异")}
        </label>
      </div>
      <div className="editor-pane diff-output" aria-label={t("对比结果")}>
        {diff.rows?.slice(0, ROW_LIMIT).map((row, i) => (
          <div key={i} className={`diff-row ${row.type}`}>
            <span>{row.left ?? ""}</span>
            <span>{row.right ?? ""}</span>
            <span>
              {row.type === "add" ? "+" : row.type === "del" ? "−" : " "}
            </span>
            <code>{row.text || " "}</code>
          </div>
        ))}
        {(diff.rows?.length || 0) > ROW_LIMIT && (
          <div className="empty">{t("仅显示前 5000 行")}</div>
        )}
      </div>
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("按行比较，只在本机处理。")}
      </div>
    </section>
  );
}
