import { useState } from "react";
import type { ToolID } from "./catalog";
import type { Draft } from "./tools/compute";
import { drafts } from "./toolSession";
const blank: Draft = {
  input: "",
  mode: "",
  unit: "",
  zone: "",
  group: "",
  from: "",
  to: "",
  count: 0,
  generated: "",
};
// Tool input lives in the session draft map, so it survives hiding the Dock
// and moves with the tool into an independent window.
export function useToolDraft(id: ToolID, initial: Partial<Draft>) {
  const [state, setState] = useState<Draft>(() => {
    const draft = { ...blank, ...initial, ...drafts.get(id) };
    drafts.set(id, draft);
    return draft;
  });
  const update = (value: Partial<Draft>) =>
    setState((old) => {
      const next = { ...old, ...value };
      drafts.set(id, next);
      return next;
    });
  return [state, update] as const;
}
