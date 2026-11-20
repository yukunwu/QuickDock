import { useMemo, type CSSProperties } from "react";
import { Copy, Palette, ShieldCheck } from "lucide-react";
import { errorText, t, useLocale } from "./i18n";
import ToolHeader, { copyText } from "./ToolHeader";
import { useToolDraft } from "./useToolDraft";
import { contrast, formatColor, parseColor, type RGBA } from "./tools/devtools";
const white: RGBA = { r: 255, g: 255, b: 255, a: 1 },
  black: RGBA = { r: 0, g: 0, b: 0, a: 1 };
// Named and modern CSS colors (oklch(), lab()…) are resolved by drawing one
// pixel, which also maps out-of-gamut values into sRGB.
function browserColor(input: string): RGBA {
  try {
    return parseColor(input);
  } catch (e) {
    if (typeof CSS === "undefined" || !CSS.supports("color", input.trim()))
      throw e;
    const ctx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = input.trim();
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  }
}
const grade = (ratio: number) =>
  ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "—";
export default function ColorWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [state, update] = useToolDraft("color", { input: "#3b82f6" });
  const parsed = useMemo(() => {
    if (!state.input.trim()) return { color: null, error: "" };
    try {
      return { color: browserColor(state.input), error: "" };
    } catch (e) {
      return { color: null, error: errorText(e) };
    }
  }, [state.input]);
  const color = parsed.color;
  const formats = color ? formatColor(color) : null;
  return (
    <section className="workspace devtool-workspace">
      <ToolHeader id="color" back={back} notify={notify} />
      <div className="time-input-row">
        <div className={`time-input ${parsed.error ? "invalid" : ""}`}>
          <Palette size={18} />
          <input
            autoFocus
            aria-label={t("颜色")}
            spellCheck={false}
            placeholder={t("#3b82f6、rgb()、hsl()、oklch() 或颜色名")}
            value={state.input}
            onChange={(e) => update({ input: e.target.value })}
          />
        </div>
        <input
          type="color"
          className="color-picker"
          aria-label={t("取色")}
          value={formats ? formats.hex.slice(0, 7) : "#000000"}
          onChange={(e) => update({ input: e.target.value })}
        />
      </div>
      <div className="time-status">
        {parsed.error ? (
          <span className="output-error" role="alert">
            {parsed.error}
          </span>
        ) : (
          <span>{t("支持 CSS 颜色写法，超出 sRGB 的颜色会映射到最近色")}</span>
        )}
      </div>
      <div className="time-grid">
        <div className="editor-pane color-preview">
          <div
            className="color-swatch"
            style={
              {
                "--swatch": formats?.rgb || "transparent",
              } as CSSProperties
            }
          />
          {color && (
            <div className="color-contrast">
              {[
                [t("白底文字"), white],
                [t("黑底文字"), black],
              ].map(([label, base]) => {
                const ratio = contrast(color, base as RGBA);
                return (
                  <div key={label as string}>
                    <span>{label as string}</span>
                    <strong>{ratio.toFixed(2)} : 1</strong>
                    <span className="tag">{grade(ratio)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="editor-pane time-formats">
          <div className="editor-label">
            {t("常用格式")}
            <span>{t("点击复制")}</span>
          </div>
          <dl>
            {(
              [
                ["HEX", formats?.hex],
                ["RGB", formats?.rgb],
                ["HSL", formats?.hsl],
                ["OKLCH", formats?.oklch],
              ] as const
            ).map(([label, value]) => (
              <button
                key={label}
                className="time-row"
                disabled={!value}
                onClick={() => value && copyText(value, notify)}
              >
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
                <Copy size={13} />
              </button>
            ))}
          </dl>
        </div>
      </div>
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("对比度按 WCAG 2 计算：AA 需 4.5:1，大字号 3:1，AAA 需 7:1。")}
      </div>
    </section>
  );
}
