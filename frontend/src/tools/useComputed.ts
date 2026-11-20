import { useEffect, useMemo, useState } from "react";
import type { ToolID } from "../catalog";
import { compute, type Computed, type Draft } from "./compute";
import { markHeavyWork } from "../toolSession";
const LARGE_INPUT = 64 * 1024;
export const PREVIEW_LIMIT = 64 * 1024;
// isolate always computes in a worker under a short deadline, for input that
// can hang the page regardless of size (catastrophic regex backtracking).
export function useComputed(id: ToolID, state: Draft, isolate = false) {
  const large = isolate || state.input.length > LARGE_INPUT;
  const small = useMemo(
    () => (large ? null : compute(id, state)),
    [id, state, large],
  );
  const [completed, setCompleted] = useState<{
    state: Draft;
    value: Computed;
  } | null>(null);
  useEffect(() => {
    setCompleted(null);
    if (!large) return;
    if (!isolate) markHeavyWork();
    let worker: Worker | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const finish = (value: Computed) => {
      if (disposed) return;
      clearTimeout(deadline);
      worker?.terminate();
      worker = undefined;
      setCompleted({ state, value });
    };
    const debounce = setTimeout(() => {
      try {
        worker = new Worker(new URL("./compute.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onmessage = ({ data }: MessageEvent<Computed>) => finish(data);
        worker.onerror = () =>
          finish({ result: "", error: "处理失败，请缩小输入后重试" });
        worker.postMessage({ id, state });
        deadline = setTimeout(
          () =>
            finish({
              result: "",
              error: isolate
                ? "匹配超时：表达式可能存在灾难性回溯"
                : "处理超时，请缩小输入后重试",
            }),
          isolate ? 3000 : 30000,
        );
      } catch (e) {
        finish({ result: "", error: String(e) });
      }
    }, 150);
    return () => {
      disposed = true;
      clearTimeout(debounce);
      clearTimeout(deadline);
      worker?.terminate();
    };
  }, [id, state, large, isolate]);
  const current =
    small || (completed?.state === state ? completed.value : null);
  return { ...(current || { result: "", error: "" }), pending: !current };
}
