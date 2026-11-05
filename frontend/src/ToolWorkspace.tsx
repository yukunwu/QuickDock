import { errorText, localizedStats, t, useLocale } from "./i18n";
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
  useLocale();
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
  useLocale();
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
        aria-label={t(label)}
        value={String(state[key])}
        onChange={(e) => update({ [key]: e.target.value })}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {t(label)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="workspace">
      <div className="workspace-header">
        <button className="icon-button" aria-label={t("返回")} onClick={back}>
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
                .then(() => notify(t("结果已复制")))
                .catch((e) => notify(errorText(e)))
            }
          >
            <Copy size={14} />
            {t("复制结果")}
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
            <span className="tag">{t("本地处理")}</span>
            {id !== "uuid" && (
              <button
                className="secondary"
                onClick={() => update({ input: "" })}
              >
                {t("清空输入")}
              </button>
            )}
            {id === "calculator" && <span>+ − × ÷ ( ) · 15% = 0.15</span>}
            {id === "json" &&
              select(t("格式"), "mode", [
                ["encode", t("格式化 · 2 空格")],
                ["compact", t("压缩")],
              ])}
            {(id === "base64" || id === "url") && (
              <>
                {select(t("操作"), "mode", [
                  ["encode", t("编码")],
                  ["decode", t("解码")],
                ])}
                <span>
                  {id === "base64"
                    ? t("UTF-8 文本 · 标准 Base64")
                    : t("URL 组件语义（+ 不转为空格）")}
                </span>
              </>
            )}
            {id === "timestamp" && (
              <>
                {select(t("方向"), "mode", [
                  ["encode", t("时间戳 → 日期")],
                  ["date", t("日期 → 时间戳")],
                ])}
                {select(t("单位"), "unit", [
                  ["s", t("秒 s")],
                  ["ms", t("毫秒 ms")],
                ])}
                {select(t("时区"), "zone", [
                  ["local", t("本地时区")],
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
                  {t("当前时间")}
                </button>
              </>
            )}
            {id === "hash" &&
              select(
                t("算法"),
                "mode",
                ["MD5", "SHA1", "SHA256", "SHA512"].map((a) => [a, a]),
              )}
            {id === "text" &&
              select(t("处理"), "mode", [
                ["trim", t("逐行去空格")],
                ["upper", t("转大写")],
                ["lower", t("转小写")],
                ["empty", t("删除空行")],
                ["unique", t("逐行去重")],
                ["sort", t("自然排序")],
              ])}
            {id === "units" && (
              <>
                <label>
                  {t("类别")}{" "}
                  <select
                    aria-label={t("类别")}
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
                      <option key={g} value={g}>
                        {t(g)}
                      </option>
                    ))}
                  </select>
                </label>
                {select(
                  t("从"),
                  "from",
                  Object.keys(engine.units[state.group]).map((u) => [u, u]),
                )}
                {select(
                  t("到"),
                  "to",
                  Object.keys(engine.units[state.group]).map((u) => [u, u]),
                )}
              </>
            )}
            {id === "uuid" && (
              <>
                <label>
                  {t("数量")}{" "}
                  <input
                    aria-label={t("UUID 数量")}
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
                      notify(errorText(e));
                    }
                  }}
                >
                  {t("生成 UUID v4")}
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
                  {t("输入")}
                  <span>
                    {id === "timestamp" && state.mode === "date"
                      ? "YYYY-MM-DD HH:mm:ss"
                      : id === "text"
                        ? localizedStats(inputStats)
                        : t("即时转换")}
                  </span>
                </div>
                <textarea
                  aria-label={t("工具输入")}
                  spellCheck={false}
                  placeholder={
                    id === "timestamp" && state.mode === "date"
                      ? "2026-11-04 12:00:00"
                      : t("在这里输入…")
                  }
                  value={state.input}
                  onChange={(e) => update({ input: e.target.value })}
                />
              </div>
            )}
            <div className="editor-pane output">
              <div className="editor-label">
                {t("结果")}
                <span className={error ? "output-error" : "success"}>
                  {pending
                    ? t("处理中…")
                    : error
                      ? t("请检查输入")
                      : result.length > PREVIEW_LIMIT
                        ? t("预览前 65,536 字符 · 复制获取全文")
                        : result
                          ? t("就绪")
                          : t("等待输入")}
                </span>
              </div>
              <pre
                aria-label={t("工具结果")}
                role={error ? "alert" : undefined}
                className={error ? "output-error" : ""}
              >
                {error ? errorText(error) : result.slice(0, PREVIEW_LIMIT)}
              </pre>
            </div>
          </div>
        </>
      )}
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {id === "text"
          ? localizedStats(resultStats)
          : new URLSearchParams(location.search).has("tool")
            ? t("数据在本机处理，独立窗口自动保存输入和选项。")
            : t("数据只在本机处理，工具输入仅在本次会话保留。")}
      </div>
    </section>
  );
}
