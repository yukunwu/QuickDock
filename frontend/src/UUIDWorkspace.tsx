import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { t, errorText, useLocale } from "./i18n";
import { drafts } from "./toolSession";
import type { Draft } from "./tools/compute";
import {
  formatUUID,
  formatUUIDs,
  uuids,
  type UUIDFormat,
  type UUIDVersion,
} from "./tools/engines";
import ToolHeader, { copyText } from "./ToolHeader";
const counts = [1, 5, 10, 50, 100];
const outputs: [UUIDFormat["output"], string][] = [
  ["lines", "每行一个"],
  ["json", "JSON 数组"],
  ["csv", "逗号分隔"],
  ["sql", "SQL 列表"],
];
// Draft fields: mode=version, unit=case, zone=hyphens, group=output format.
function normalize(draft: Draft | undefined): Draft {
  const version = draft?.mode === "v7" ? "v7" : "v4";
  const count =
    draft &&
    Number.isInteger(draft.count) &&
    draft.count >= 1 &&
    draft.count <= 1000
      ? draft.count
      : 1;
  return {
    input: "",
    mode: version,
    unit: draft?.unit === "upper" ? "upper" : "lower",
    zone: draft?.zone === "plain" ? "plain" : "hyphen",
    group: outputs.some(([id]) => id === draft?.group) ? draft!.group : "lines",
    from: "",
    to: "",
    count,
    generated: draft?.generated || uuids(count, version),
  };
}
export default function UUIDWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [state, setState] = useState(() => {
    const draft = normalize(drafts.get("uuid"));
    drafts.set("uuid", draft);
    return draft;
  });
  const [countText, setCountText] = useState(String(state.count));
  const update = (value: Partial<Draft>) =>
    setState((old) => {
      const next = { ...old, ...value };
      drafts.set("uuid", next);
      return next;
    });
  const generate = (count = state.count, version = state.mode) => {
    try {
      update({
        count,
        mode: version,
        generated: uuids(count, version as UUIDVersion),
      });
    } catch (e) {
      notify(errorText(e));
    }
  };
  const format: UUIDFormat = {
    upper: state.unit === "upper",
    hyphens: state.zone === "hyphen",
    output: state.group as UUIDFormat["output"],
  };
  const ids = useMemo(
    () => state.generated.split("\n").filter(Boolean),
    [state.generated],
  );
  const all = formatUUIDs(ids, format);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || (e.target as HTMLElement).tagName === "INPUT")
        return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generate();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        copyText(all, notify, "已复制全部");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const toggle = (label: string, active: boolean, change: () => void) => (
    <button
      className={active ? "active" : ""}
      aria-pressed={active}
      onClick={change}
    >
      {t(label)}
    </button>
  );
  return (
    <section className="workspace uuid-workspace">
      <ToolHeader id="uuid" back={back} notify={notify}>
        <button
          className="secondary"
          disabled={!ids.length}
          onClick={() => copyText(all, notify, "已复制全部")}
        >
          <Copy size={14} />
          {t("复制全部")}
        </button>
        <button className="primary" onClick={() => generate()} title="⌘ Enter">
          <RefreshCw size={14} />
          {t("重新生成")}
        </button>
      </ToolHeader>
      <div className="workspace-options uuid-options">
        <div className="segmented" role="group" aria-label={t("版本")}>
          {toggle("v4 随机", state.mode === "v4", () =>
            generate(state.count, "v4"),
          )}
          {toggle("v7 按时间排序", state.mode === "v7", () =>
            generate(state.count, "v7"),
          )}
        </div>
        <div className="segmented" role="group" aria-label={t("数量")}>
          {counts.map((n) => (
            <button
              key={n}
              className={state.count === n ? "active" : ""}
              aria-pressed={state.count === n}
              onClick={() => {
                setCountText(String(n));
                generate(n);
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <label>
          {t("自定义")}
          <input
            aria-label={t("UUID 数量")}
            type="number"
            min="1"
            max="1000"
            value={countText}
            onChange={(e) => {
              setCountText(e.target.value);
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 1000) generate(n);
            }}
            onBlur={() => setCountText(String(state.count))}
          />
        </label>
        <span className="uuid-options-gap" />
        <div className="segmented" role="group" aria-label={t("格式")}>
          {toggle("大写", format.upper, () =>
            update({ unit: format.upper ? "lower" : "upper" }),
          )}
          {toggle("连字符", format.hyphens, () =>
            update({ zone: format.hyphens ? "plain" : "hyphen" }),
          )}
        </div>
        <select
          aria-label={t("输出格式")}
          value={state.group}
          onChange={(e) => update({ group: e.target.value })}
        >
          {outputs.map(([id, label]) => (
            <option key={id} value={id}>
              {t(label)}
            </option>
          ))}
        </select>
      </div>
      {ids.length === 1 ? (
        <button
          className="uuid-hero editor-pane"
          aria-label={t("复制 UUID")}
          onClick={() => copyText(formatUUID(ids[0], format), notify)}
        >
          <code>{formatUUID(ids[0], format)}</code>
          <span>
            <Copy size={14} />
            {t("点击复制")}
          </span>
        </button>
      ) : (
        <div className="editor-pane uuid-list-pane">
          <div className="editor-label">
            {t("结果")}
            <span>{t("{count} 个 · 点击单行复制", { count: ids.length })}</span>
          </div>
          {format.output === "lines" ? (
            <ol className="uuid-list" aria-label={t("工具结果")}>
              {ids.map((id, i) => (
                <li key={i}>
                  <button
                    onClick={() => copyText(formatUUID(id, format), notify)}
                  >
                    <span className="uuid-index">{i + 1}</span>
                    <code>{formatUUID(id, format)}</code>
                    <Copy size={13} />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <pre aria-label={t("工具结果")}>{all}</pre>
          )}
        </div>
      )}
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("使用系统安全随机数在本机生成")} · ⌘ Enter {t("重新生成")} · ⌘ ⇧ C{" "}
        {t("复制全部")}
      </div>
    </section>
  );
}
