import { useMemo } from "react";
import { Copy, Hexagon, ShieldCheck } from "lucide-react";
import { errorText, t, useLocale } from "./i18n";
import ToolHeader, { copyText } from "./ToolHeader";
import { useToolDraft } from "./useToolDraft";
import { convertBase, groupDigits } from "./tools/devtools";
const names: Record<number, string> = {
  2: "二进制",
  8: "八进制",
  10: "十进制",
  16: "十六进制",
  36: "三十六进制",
};
export default function BaseWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [state, update] = useToolDraft("base", { input: "255", mode: "0" });
  const converted = useMemo(() => {
    if (!state.input.trim()) return { rows: null, error: "" };
    try {
      return { rows: convertBase(state.input, Number(state.mode)), error: "" };
    } catch (e) {
      return { rows: null, error: errorText(e) };
    }
  }, [state.input, state.mode]);
  const binary = converted.rows?.find((r) => r.base === 2)?.value || "";
  const bits = binary.replace("-", "").length;
  return (
    <section className="workspace devtool-workspace">
      <ToolHeader id="base" back={back} notify={notify} />
      <div className="time-input-row">
        <div className={`time-input ${converted.error ? "invalid" : ""}`}>
          <Hexagon size={18} />
          <input
            autoFocus
            aria-label={t("整数")}
            spellCheck={false}
            placeholder={t("输入整数，可带 0x、0o、0b 前缀")}
            value={state.input}
            onChange={(e) => update({ input: e.target.value })}
          />
        </div>
        <select
          aria-label={t("输入进制")}
          value={state.mode}
          onChange={(e) => update({ mode: e.target.value })}
        >
          <option value="0">{t("自动识别")}</option>
          {[2, 8, 10, 16, 36].map((b) => (
            <option key={b} value={b}>
              {t(names[b])}
            </option>
          ))}
        </select>
      </div>
      <div className="time-status">
        {converted.error ? (
          <span className="output-error" role="alert">
            {converted.error}
          </span>
        ) : (
          <span>
            {converted.rows
              ? t("{bits} 位 · 任意大小整数", { bits })
              : t("输入整数开始转换")}
          </span>
        )}
      </div>
      <div className="editor-pane time-formats base-results">
        <dl>
          {[2, 8, 10, 16, 36].map((base) => {
            const value = converted.rows?.find((r) => r.base === base)?.value;
            const shown = !value
              ? "—"
              : base === 2
                ? groupDigits(value, 4)
                : base === 16
                  ? groupDigits(value.toUpperCase(), 4)
                  : base === 10
                    ? groupDigits(value, 3)
                    : value;
            const copied =
              value && base === 16 ? "0x" + value.toUpperCase() : value;
            return (
              <button
                key={base}
                className="time-row"
                disabled={!value}
                onClick={() =>
                  copied && copyText(copied.replace("0x-", "-0x"), notify)
                }
              >
                <dt>
                  {t(names[base])} <small>{base}</small>
                </dt>
                <dd>{shown}</dd>
                <Copy size={13} />
              </button>
            );
          })}
        </dl>
      </div>
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("显示时按位分组，复制得到不含空格的完整数字。")}
      </div>
    </section>
  );
}
