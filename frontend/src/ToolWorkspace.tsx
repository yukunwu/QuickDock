import { useMemo, useState } from "react";
import { ArrowLeft, Copy, ShieldCheck } from "lucide-react";
import { tools, type ToolID, type Settings } from "./catalog";
import * as engine from "./tools/engines";
import * as bridge from "./bridge";
import BookmarkEditor from "./BookmarkEditor";
import ToolWindowButton from "./ToolWindowButton";
import TranslationWorkspace from "./TranslationWorkspace";
import CalculatorNotebook from "./CalculatorNotebook";
import type { Draft } from "./tools/compute";
import { PREVIEW_LIMIT, useComputed } from "./tools/useComputed";
import { drafts } from "./toolSession";
function initial(id: ToolID): Draft {
  return {
    input:
      id === "json"
        ? '{"name":"QuickDock","largeInteger":9007199254740993}'
        : id === "calculator"
          ? "(128 + 64) * 15%"
          : id === "timestamp"
            ? String(Math.floor(Date.now() / 1000))
            : id === "units"
              ? "1"
              : "",
    mode: id === "hash" ? "SHA256" : id === "text" ? "trim" : "encode",
    unit: "s",
    zone: "local",
    group: "长度",
    from: "米 m",
    to: "千米 km",
    count: 1,
    generated: id === "uuid" ? engine.uuids(1) : "",
  };
}
export default function ToolWorkspace(props: {
  id: ToolID;
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  notify: (s: string) => void;
  back: () => void;
}) {
  if (props.id === "translate")
    return <TranslationWorkspace back={props.back} notify={props.notify} />;
  if (props.id === "calculator")
    return <CalculatorNotebook back={props.back} notify={props.notify} />;
  return <Workspace key={props.id} {...props} />;
}
function Workspace({
  id,
  settings,
  saveSettings,
  notify,
  back,
}: {
  id: ToolID;
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  notify: (s: string) => void;
  back: () => void;
}) {
  const tool = tools.find((t) => t.id === id)!;
  const [state, setState] = useState(() => {
    const draft = drafts.get(id) || initial(id);
    drafts.set(id, draft);
    return draft;
  });
  const update = (value: Partial<Draft>) =>
    setState((old) => {
      const next = { ...old, ...value };
      drafts.set(id, next);
      return next;
    });
  const { result, error, pending } = useComputed(id, state);
  const inputStats = useMemo(
    () => (id === "text" ? engine.textStats(state.input) : ""),
    [id, state.input],
  );
  const resultStats = useMemo(
    () => (id === "text" ? engine.textStats(result) : ""),
    [id, result],
  );
  const select = (
    label: string,
    key: keyof Draft,
    options: [string, string][],
  ) => (
    <label>
      {label}{" "}
      <select
        aria-label={label}
        value={String(state[key])}
        onChange={(e) => update({ [key]: e.target.value })}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="workspace">
      <div className="workspace-header">
        <button className="icon-button" aria-label="返回" onClick={back}>
          <ArrowLeft size={19} />
        </button>
        <span className={`item-icon ${tool.color}`}>
          <tool.icon size={21} />
        </span>
        <div>
          <h2>{tool.name}</h2>
          <p>{tool.subtitle}</p>
        </div>
        <ToolWindowButton id={id} notify={notify} />
        {id !== "bookmarks" && (
          <button
            className="secondary"
            disabled={pending || !!error || !result}
            onClick={() =>
              void bridge
                .copy(result)
                .then(() => notify("结果已复制"))
                .catch((e) => notify(String(e)))
            }
          >
            <Copy size={14} />
            复制结果
          </button>
        )}
      </div>
      {id === "bookmarks" ? (
        <BookmarkEditor
          settings={settings}
          saveSettings={saveSettings}
          notify={notify}
        />
      ) : (
        <>
          <div className="workspace-options">
            <span className="tag">本地处理</span>
            {id !== "uuid" && (
              <button
                className="secondary"
                onClick={() => update({ input: "" })}
              >
                清空输入
              </button>
            )}
            {id === "calculator" && <span>+ − × ÷ ( ) · 15% = 0.15</span>}
            {id === "json" &&
              select("格式", "mode", [
                ["encode", "格式化 · 2 空格"],
                ["compact", "压缩"],
              ])}
            {(id === "base64" || id === "url") && (
              <>
                {select("操作", "mode", [
                  ["encode", "编码"],
                  ["decode", "解码"],
                ])}
                <span>
                  {id === "base64"
                    ? "UTF-8 文本 · 标准 Base64"
                    : "URL 组件语义（+ 不转为空格）"}
                </span>
              </>
            )}
            {id === "timestamp" && (
              <>
                {select("方向", "mode", [
                  ["encode", "时间戳 → 日期"],
                  ["date", "日期 → 时间戳"],
                ])}
                {select("单位", "unit", [
                  ["s", "秒 s"],
                  ["ms", "毫秒 ms"],
                ])}
                {select("时区", "zone", [
                  ["local", "本地时区"],
                  ["utc", "UTC"],
                ])}
                <button
                  className="secondary"
                  onClick={() =>
                    update({
                      input: String(
                        state.unit === "s"
                          ? Math.floor(Date.now() / 1000)
                          : Date.now(),
                      ),
                      mode: "encode",
                    })
                  }
                >
                  当前时间
                </button>
              </>
            )}
            {id === "hash" &&
              select(
                "算法",
                "mode",
                ["MD5", "SHA1", "SHA256", "SHA512"].map((a) => [a, a]),
              )}
            {id === "text" &&
              select("处理", "mode", [
                ["trim", "逐行去空格"],
                ["upper", "转大写"],
                ["lower", "转小写"],
                ["empty", "删除空行"],
                ["unique", "逐行去重"],
                ["sort", "自然排序"],
              ])}
            {id === "units" && (
              <>
                <label>
                  类别{" "}
                  <select
                    aria-label="类别"
                    value={state.group}
                    onChange={(e) => {
                      const keys = Object.keys(engine.units[e.target.value]);
                      update({
                        group: e.target.value,
                        from: keys[0],
                        to: keys[1],
                      });
                    }}
                  >
                    {Object.keys(engine.units).map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                {select(
                  "从",
                  "from",
                  Object.keys(engine.units[state.group]).map((u) => [u, u]),
                )}
                {select(
                  "到",
                  "to",
                  Object.keys(engine.units[state.group]).map((u) => [u, u]),
                )}
              </>
            )}
            {id === "uuid" && (
              <>
                <label>
                  数量{" "}
                  <input
                    aria-label="UUID 数量"
                    type="number"
                    min="1"
                    max="1000"
                    value={state.count}
                    onChange={(e) => update({ count: Number(e.target.value) })}
                  />
                </label>
                <button
                  className="primary"
                  onClick={() => {
                    try {
                      update({ generated: engine.uuids(state.count) });
                    } catch (e) {
                      notify(String(e));
                    }
                  }}
                >
                  生成 UUID v4
                </button>
              </>
            )}
          </div>
          <div
            className={`editor-grid ${id === "uuid" ? "single-editor" : ""}`}
          >
            {id !== "uuid" && (
              <div className="editor-pane">
                <div className="editor-label">
                  输入
                  <span>
                    {id === "timestamp" && state.mode === "date"
                      ? "YYYY-MM-DD HH:mm:ss"
                      : id === "text"
                        ? inputStats
                        : "即时转换"}
                  </span>
                </div>
                <textarea
                  aria-label="工具输入"
                  spellCheck={false}
                  placeholder={
                    id === "timestamp" && state.mode === "date"
                      ? "2026-11-04 12:00:00"
                      : "在这里输入…"
                  }
                  value={state.input}
                  onChange={(e) => update({ input: e.target.value })}
                />
              </div>
            )}
            <div className="editor-pane output">
              <div className="editor-label">
                结果
                <span className={error ? "output-error" : "success"}>
                  {pending
                    ? "处理中…"
                    : error
                      ? "请检查输入"
                      : result.length > PREVIEW_LIMIT
                        ? "预览前 65,536 字符 · 复制获取全文"
                        : result
                          ? "就绪"
                          : "等待输入"}
                </span>
              </div>
              <pre
                aria-label="工具结果"
                role={error ? "alert" : undefined}
                className={error ? "output-error" : ""}
              >
                {error || result.slice(0, PREVIEW_LIMIT)}
              </pre>
            </div>
          </div>
        </>
      )}
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {id === "text"
          ? resultStats
          : new URLSearchParams(location.search).has("tool")
            ? "数据在本机处理，独立窗口自动保存输入和选项。"
            : "数据只在本机处理，工具输入仅在本次会话保留。"}
      </div>
    </section>
  );
}
