import { errorText, t, getLanguage, useLocale } from "./i18n";
import { commandLabel } from "./platform";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  History,
  NotebookPen,
  Trash2,
  X,
} from "lucide-react";
import ToolWindowButton from "./ToolWindowButton";
import * as bridge from "./bridge";
import { drafts } from "./toolSession";
import { calculateSheet, type Calculation } from "./tools/notebook";
const example = () => t("# 本月预算") + "\n128 + 64\nans * 15%";
export default function CalculatorNotebook({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [source, setSource] = useState(
    () => drafts.get("calculator")?.input ?? example(),
  );
  // Autosave: one history record per sheet. The record id rides in the
  // session draft so leaving and returning keeps updating the same record;
  // the baseline is text that needs no recording (initial or just loaded).
  const sessionId = useRef(drafts.get("calculator")?.generated || "");
  const baseline = useRef(source);
  const [savedAt, setSavedAt] = useState(0);
  const [records, setRecords] = useState<Calculation[]>([]),
    [historyOpen, setHistoryOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmClear, setConfirmClear] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => calculateSheet(source), [source]);
  const valid = lines.some((l) => l.result) && !lines.some((l) => l.error);
  const remember = (value: string, id = sessionId.current) => {
    setSource(value);
    sessionId.current = id;
    drafts.set("calculator", {
      input: value,
      mode: "encode",
      unit: "s",
      zone: "local",
      group: "长度",
      from: "米 m",
      to: "千米 km",
      count: 1,
      generated: id,
    });
  };
  useEffect(() => {
    let active = true;
    void bridge
      .calculations()
      .then((rows) => {
        if (active) setRecords(rows);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const latest = useRef({ source, lines, valid });
  latest.current = { source, lines, valid };
  const queue = useRef(Promise.resolve());
  const record = () => {
    const { source, lines, valid } = latest.current;
    if (!valid || source === baseline.current) return queue.current;
    baseline.current = source;
    // Serialize writes so a fast edit never races its predecessor's id.
    queue.current = queue.current.then(async () => {
      try {
        const saved = await bridge.recordCalculation(
          sessionId.current,
          source,
          lines.map((l) => l.result),
        );
        if (latest.current.source === source) remember(source, saved.id);
        else sessionId.current = saved.id;
        setRecords(saved.records);
        setSavedAt(Date.now());
        setError("");
      } catch (e) {
        baseline.current = "";
        setError(errorText(e));
      }
    });
    return queue.current;
  };
  useEffect(() => {
    if (!valid || source === baseline.current) return;
    const timer = setTimeout(() => void record(), 1500);
    return () => clearTimeout(timer);
  }, [source, valid]);
  // Leaving the notebook (back, Dock hidden, window closed) records at once.
  useEffect(() => {
    const flush = () => void record();
    window.addEventListener("pagehide", flush);
    window.addEventListener("quickdock-visibility", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("quickdock-visibility", flush);
      flush();
    };
  }, []);
  const startSheet = async (value: string, id: string) => {
    await record();
    baseline.current = value;
    remember(value, id);
    setSavedAt(0);
  };
  const remove = async (id?: string) => {
    setBusy(true);
    setError("");
    try {
      if (id) setRecords(await bridge.deleteCalculation(id));
      else {
        await bridge.clearCalculations();
        setRecords([]);
        setConfirmClear(false);
      }
      // Deleting the current sheet's record stops recording it until it
      // changes again; later edits then start a new record.
      if (!id || id === sessionId.current) {
        baseline.current = latest.current.source;
        remember(latest.current.source, "");
        setSavedAt(0);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="workspace notebook-workspace">
      <div className="workspace-header">
        <button className="icon-button" aria-label={t("返回")} onClick={back}>
          <ArrowLeft size={19} />
        </button>
        <span className="item-icon orange">
          <NotebookPen size={22} />
        </span>
        <div>
          <h2>{t("计算稿纸")}</h2>
          <p>{t("多行算式、逐行结果与历史记录")}</p>
        </div>
        <ToolWindowButton id="calculator" notify={notify} />
        <button
          className="secondary"
          onClick={() => {
            setHistoryOpen(!historyOpen);
            setConfirmClear(false);
          }}
          aria-expanded={historyOpen}
        >
          <History size={15} />
          {t("历史记录")} {records.length}
        </button>
        <span className="notebook-autosave" aria-live="polite">
          {savedAt ? (
            <>
              <Check size={13} />
              {t("已自动记录 {time}", {
                time: new Date(savedAt).toLocaleTimeString(getLanguage(), {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </>
          ) : valid && source !== baseline.current ? (
            t("编辑后自动记录")
          ) : null}
        </span>
      </div>
      <div className="workspace-options">
        <span className="tag">{t("本地计算")}</span>
        <span>{t("一行一个算式 · # 备注 · ans 上一个结果")}</span>
        <button className="secondary" onClick={() => void startSheet("", "")}>
          {t("新稿纸")}
        </button>
        <button
          className="secondary"
          disabled={!valid}
          onClick={() =>
            void bridge
              .copy(
                source
                  .split("\n")
                  .map((s, i) =>
                    lines[i]?.result ? `${s} = ${lines[i].result}` : s,
                  )
                  .join("\n"),
              )
              .then(() => notify(t("稿纸已复制")))
              .catch((e) => notify(errorText(e)))
          }
        >
          <Copy size={14} />
          {t("复制稿纸")}
        </button>
      </div>
      {error && (
        <div className="inline-warning" role="alert">
          {errorText(error)}
        </div>
      )}
      <div className="notebook-body">
        <div className="notebook-paper">
          <div className="notebook-labels">
            <span>
              {t("稿纸")}{" "}
              <small>
                {commandLabel} {t("Enter 立即记录")}
              </small>
            </span>
            <span>{t("计算结果")}</span>
          </div>
          <div className="notebook-columns">
            <textarea
              aria-label={t("工具输入")}
              spellCheck={false}
              wrap="off"
              maxLength={20000}
              value={source}
              placeholder={t("# 旅行预算") + "\n1200 + 800\nans / 2"}
              onChange={(e) => remember(e.target.value)}
              onScroll={(e) => {
                if (outputRef.current)
                  outputRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onKeyDown={(e) => {
                if (
                  !e.nativeEvent.isComposing &&
                  e.nativeEvent.keyCode !== 229 &&
                  (e.metaKey || e.ctrlKey) &&
                  e.key === "Enter"
                ) {
                  e.preventDefault();
                  if (valid)
                    void record().then(() => notify(t("已记录到历史")));
                }
              }}
            />
            <div
              className="notebook-results"
              aria-label={t("工具结果")}
              ref={outputRef}
            >
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={line.error ? "output-error" : ""}
                  title={line.error ? errorText(line.error) : line.result}
                >
                  {line.error ? errorText(line.error) : line.result || " "}
                </div>
              ))}
            </div>
          </div>
        </div>
        {historyOpen && (
          <aside className="calculation-history" aria-label={t("计算历史")}>
            <div className="history-heading">
              <strong>{t("历史计算")}</strong>
              <button
                className="icon-button"
                aria-label={t("关闭历史记录")}
                onClick={() => setHistoryOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <p>{t("自动记录在本机 · 最近100份")}</p>
            <div className="history-list">
              {!records.length ? (
                <div className="empty">
                  {t("还没有记录")}
                  <br />
                  {t("写下算式，停顿片刻会自动记录。")}
                </div>
              ) : (
                records.map((record) => (
                  <article key={record.id}>
                    <button
                      className="history-load"
                      aria-label={t("载入记录 {name}", {
                        name: record.source.split("\n")[0],
                      })}
                      onClick={() =>
                        void startSheet(record.source, record.id).then(() =>
                          notify(t("已载入稿纸")),
                        )
                      }
                    >
                      <time>
                        {new Date(record.createdAt).toLocaleString(
                          getLanguage(),
                          {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </time>
                      <strong>
                        {record.source
                          .split("\n")
                          .find((l) => l.trim())
                          ?.replace(/^#\s*/, "")}
                      </strong>
                      <span>{record.results.filter(Boolean).join(" · ")}</span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={t("删除记录 {name}", {
                        name: record.source.split("\n")[0],
                      })}
                      disabled={busy}
                      onClick={() => void remove(record.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))
              )}
            </div>
            {!!records.length && (
              <div className="history-clear">
                {confirmClear ? (
                  <>
                    <span>{t("清空全部历史？此操作不可恢复。")}</span>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      {t("确认清空历史")}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setConfirmClear(false)}
                    >
                      {t("取消")}
                    </button>
                  </>
                ) : (
                  <button
                    className="secondary"
                    onClick={() => setConfirmClear(true)}
                  >
                    {t("清空历史")}
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
      <div className="workspace-note">
        {source.split("\n").length} {t("/ 200 行 ·")} {source.length}{" "}
        {t("/ 20000 字符")}
        <span>
          {new URLSearchParams(location.search).has("tool")
            ? t("独立窗口自动保存稿纸，并自动记录到历史。")
            : t("稿纸自动记录到历史，重启后仍可载入。")}
        </span>
      </div>
    </section>
  );
}
