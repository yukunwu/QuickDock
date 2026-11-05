import { useEffect, useState } from "react";
import { isMac } from "./platform";
import { errorText, t, useLocale } from "./i18n";
export function shortcutModifiers(shortcut: string): string[] {
  return shortcut
    .split("+")
    .map((x) => x.trim())
    .filter((x) => x && !/^space$/i.test(x))
    .map((x) => {
      const key = x.toLowerCase();
      if (["option", "alt"].includes(key)) return isMac ? "Option" : "Alt";
      if (["command", "cmd", "super", "win", "meta"].includes(key))
        return isMac ? "Cmd" : "Super";
      if (["control", "ctrl"].includes(key)) return "Ctrl";
      if (key === "shift") return "Shift";
      return "";
    })
    .filter(Boolean);
}
export default function ShortcutPicker({
  value,
  busy,
  save,
}: {
  value: string;
  busy: boolean;
  save: (value: string) => Promise<void>;
}) {
  useLocale();
  const [selected, setSelected] = useState(() => shortcutModifiers(value));
  useEffect(() => setSelected(shortcutModifiers(value)), [value]);
  const options = isMac
    ? [
        ["Option", "⌥ Option"],
        ["Cmd", "⌘ Command"],
        ["Ctrl", "⌃ Control"],
        ["Shift", "⇧ Shift"],
      ]
    : [
        ["Ctrl", "Ctrl"],
        ["Alt", "Alt"],
        ["Super", "Win"],
        ["Shift", "Shift"],
      ];
  return (
    <form
      className="shortcut-picker"
      aria-label={t("全局快捷键")}
      onSubmit={(e) => {
        e.preventDefault();
        if (selected.length)
          void save(
            options
              .filter(([key]) => selected.includes(key))
              .map(([key]) => key)
              .join("+") + "+Space",
          ).catch(() => {});
      }}
    >
      <div className="shortcut-modifiers" role="group" aria-label={t("修饰键")}>
        {options.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`secondary ${selected.includes(key) ? "active" : ""}`}
            aria-pressed={selected.includes(key)}
            disabled={busy}
            onClick={() =>
              setSelected((old) =>
                old.includes(key)
                  ? old.filter((x) => x !== key)
                  : [...old, key],
              )
            }
          >
            {label}
          </button>
        ))}
        <span>+</span>
        <kbd>Space</kbd>
        <button className="primary" disabled={busy || !selected.length}>
          {t("保存")}
        </button>
      </div>
      <small className="muted">{t("请选择至少一个修饰键，Space 固定。")}</small>
    </form>
  );
}
