import { useSyncExternalStore } from "react";
import messages from "../../internal/i18n/messages.json";
export const languages = ["zh-CN", "ja", "en", "zh-TW", "es"] as const;
export type Language = (typeof languages)[number];
export function resolveLanguage(
  choice = "system",
  preferred: readonly string[] = typeof navigator === "undefined"
    ? ["zh-CN"]
    : navigator.languages,
): Language {
  for (const raw of choice && choice !== "system" ? [choice] : preferred) {
    const l = raw.toLowerCase();
    if (l.startsWith("zh"))
      return /(?:tw|hk|mo|hant)/.test(l) ? "zh-TW" : "zh-CN";
    if (l.startsWith("ja")) return "ja";
    if (l.startsWith("en")) return "en";
    if (l.startsWith("es")) return "es";
  }
  return "en";
}
let language: Language = resolveLanguage();
const listeners = new Set<() => void>();
export function setLanguage(choice?: string) {
  const next = resolveLanguage(choice || "system");
  if (typeof document !== "undefined") document.documentElement.lang = next;
  if (next === language) return;
  language = next;
  for (const listener of listeners) listener();
}
export const getLanguage = () => language;
export function useLocale() {
  return useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, getLanguage);
}
export function t(
  key: string,
  values?: Record<string, string | number>,
): string {
  const dictionary = language === "zh-CN" ? undefined : messages[language];
  let text = (dictionary as Record<string, string> | undefined)?.[key] || key;
  if (values)
    for (const [name, value] of Object.entries(values))
      text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export function errorText(value: unknown): string {
  const text = (
    value instanceof Error && value.name === "Error"
      ? value.message
      : String(value)
  ).replace(/^(?:RuntimeError|Error):\s*/, "");
  return t(text);
}
export function localizedStats(text: string): string {
  const match =
    /^(\d+) 个 Unicode 字符 · (\d+) 行 · (\d+) 字节 \(UTF-8\)$/.exec(text);
  return match
    ? t("{characters} 个 Unicode 字符 · {lines} 行 · {bytes} 字节 (UTF-8)", {
        characters: match[1],
        lines: match[2],
        bytes: match[3],
      })
    : text;
}
