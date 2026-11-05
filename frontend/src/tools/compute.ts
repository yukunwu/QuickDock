import type { ToolID } from "../catalog";
import * as engine from "./engines";
export type Draft = {
  input: string;
  mode: string;
  unit: string;
  zone: string;
  group: string;
  from: string;
  to: string;
  count: number;
  generated: string;
};
export type Computed = { result: string; error: string };
export function compute(id: ToolID, state: Draft): Computed {
  try {
    let result = "";
    if (id === "uuid") result = state.generated;
    else if (state.input || id === "hash") {
      switch (id) {
        case "calculator":
          result = engine.calculate(state.input);
          break;
        case "json":
          result = engine.jsonFormat(state.input, state.mode === "compact");
          break;
        case "base64":
          result = engine.base64(state.input, state.mode === "decode");
          break;
        case "url":
          result = engine.urlComponent(state.input, state.mode === "decode");
          break;
        case "timestamp":
          result = engine.timestamp(
            state.input,
            state.mode,
            state.unit,
            state.zone,
          );
          break;
        case "hash":
          result = engine.hash(state.input, state.mode);
          break;
        case "units":
          result = engine.convert(
            state.input,
            state.group,
            state.from,
            state.to,
          );
          break;
        case "text":
          result = engine.textTransform(state.input, state.mode);
          break;
      }
    }
    return { result, error: "" };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : String(e) };
  }
}
