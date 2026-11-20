import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ShieldCheck } from "lucide-react";
import { errorText, getLanguage, t, useLocale } from "./i18n";
import ToolHeader from "./ToolHeader";
import { useToolDraft } from "./useToolDraft";
import { cronRuns, parseCron, type CronField } from "./tools/devtools";
import { relativeTime } from "./tools/time";
const fieldLabel: Record<CronField["name"], string> = {
  minute: "分钟",
  hour: "小时",
  day: "日期",
  month: "月份",
  weekday: "星期",
};
const fieldSize: Record<CronField["name"], number> = {
  minute: 60,
  hour: 24,
  day: 31,
  month: 12,
  weekday: 7,
};
const examples = [
  "*/5 * * * *",
  "0 9 * * 1-5",
  "30 2 * * 0",
  "0 0 1 * *",
  "@hourly",
];
// 1,2,3,5 → "1–3, 5"
function ranges(values: number[]) {
  const out: string[] = [];
  for (let i = 0; i < values.length; i++) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === values[j] + 1) j++;
    out.push(
      j - i >= 2
        ? `${values[i]}–${values[j]}`
        : values.slice(i, j + 1).join(", "),
    );
    i = j;
  }
  return out.join(", ");
}
export default function CronWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  const language = useLocale();
  const [state, update] = useToolDraft("cron", {
    input: "0 9 * * 1-5",
    zone: "local",
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const utc = state.zone === "utc";
  const parsed = useMemo(() => {
    if (!state.input.trim()) return { fields: null, error: "" };
    try {
      return { fields: parseCron(state.input), error: "" };
    } catch (e) {
      return { fields: null, error: errorText(e) };
    }
  }, [state.input]);
  const runs = useMemo(
    () => (parsed.fields ? cronRuns(parsed.fields, 10, now, utc) : []),
    [parsed.fields, now, utc],
  );
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) =>
      format.format(new Date(Date.UTC(2023, 0, 1 + i, 12))),
    );
  }, [language]);
  const describe = (f: CronField) =>
    f.values.length === fieldSize[f.name]
      ? t("每个")
      : f.name === "weekday"
        ? f.values.map((v) => weekdays[v]).join(", ")
        : ranges(f.values);
  return (
    <section className="workspace devtool-workspace">
      <ToolHeader id="cron" back={back} notify={notify} />
      <div className="time-input-row">
        <div className={`time-input ${parsed.error ? "invalid" : ""}`}>
          <CalendarClock size={18} />
          <input
            autoFocus
            aria-label={t("Cron 表达式")}
            spellCheck={false}
            placeholder="*/15 9-17 * * MON-FRI"
            value={state.input}
            onChange={(e) => update({ input: e.target.value })}
          />
        </div>
        <select
          aria-label={t("时区")}
          value={state.zone}
          onChange={(e) => update({ zone: e.target.value })}
        >
          <option value="local">{t("本地时区")}</option>
          <option value="utc">UTC</option>
        </select>
      </div>
      <div className="time-status">
        {parsed.error ? (
          <span className="output-error" role="alert">
            {parsed.error}
          </span>
        ) : (
          <span>
            {t("5 段：分 时 日 月 周；日期与星期同时限定时，满足其一即触发")}
          </span>
        )}
        <span className="cron-examples">
          {examples.map((e) => (
            <button
              key={e}
              className="secondary"
              onClick={() => update({ input: e })}
            >
              {e}
            </button>
          ))}
        </span>
      </div>
      <div className="time-grid">
        <div className="editor-pane time-formats">
          <div className="editor-label">{t("字段")}</div>
          <dl>
            {parsed.fields?.map((f) => (
              <div key={f.name} className="time-row cron-field">
                <dt>{t(fieldLabel[f.name])}</dt>
                <dd>{describe(f)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="editor-pane time-formats">
          <div className="editor-label">
            {t("接下来 10 次运行")}
            <span>{utc ? "UTC" : t("本地时区")}</span>
          </div>
          <dl>
            {parsed.fields && !runs.length && (
              <div className="empty">{t("未来 5 年内不会运行")}</div>
            )}
            {runs.map((ms) => (
              <div key={ms} className="time-row cron-run">
                <dt>{relativeTime(ms, now, getLanguage())}</dt>
                <dd>
                  {new Date(ms).toLocaleString(getLanguage(), {
                    timeZone: utc ? "UTC" : undefined,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("支持名称（MON、JAN）、列表、范围、步长和 @daily 等宏。")}
      </div>
    </section>
  );
}
