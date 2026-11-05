import { calculate } from "./calculator";
export type SheetLine = { result: string; error: string };
export function calculateSheet(source: string): SheetLine[] {
  const lines = source.split("\n");
  if (source.length > 20000 || lines.length > 200)
    return [{ result: "", error: "稿纸最多200行、20000字符" }];
  let previous: string | undefined;
  return lines.map((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return { result: "", error: "" };
    try {
      if (/\bans\b/i.test(line) && previous === undefined)
        throw Error("前面没有可引用的有效结果");
      const result = calculate(
        line.replace(/\bans\b/gi, `(${previous || "0"})`),
      );
      previous = result;
      return { result, error: "" };
    } catch (e) {
      previous = undefined;
      return { result: "", error: e instanceof Error ? e.message : String(e) };
    }
  });
}
export type Calculation = {
  id: string;
  createdAt: number;
  source: string;
  results: string[];
};
