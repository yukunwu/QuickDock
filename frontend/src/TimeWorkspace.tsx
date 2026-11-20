import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Copy, Plus, ShieldCheck, X } from "lucide-react";
import { t, errorText, getLanguage, useLocale } from "./i18n";
import { drafts } from "./toolSession";
import type { Draft } from "./tools/compute";
import {
  allZones,
  commonZones,
  dayShift,
  defaultZones,
  formatZoned,
  isoWithOffset,
  localZone,
  offsetLabel,
  parseTime,
  relativeTime,
  resolveZone,
  validZone,
  zoneOffset,
  zonedParts,
} from "./tools/time";
import ToolHeader, { copyText } from "./ToolHeader";
// The zone list is a preference, not tool input, so it outlives the session.
const zonesKey = "quickdock-time-zones";
function loadZones() {
  try {
    const list = JSON.parse(localStorage.getItem(zonesKey) || "null");
    if (Array.isArray(list) && list.every((z) => typeof z === "string"))
      return list.filter(validZone).slice(0, 24);
  } catch {
    // Fall through to defaults.
  }
  return defaultZones;
}
const zoneNames = new Map(commonZones);
function zoneName(zone: string) {
  if (zone === "local") return t("本地时区");
  const known = zoneNames.get(zone);
  if (known) return t(known);
  return zone.split("/").pop()!.replace(/_/g, " ");
}
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export default function TimeWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [state, setState] = useState<Draft>(() => {
    const old = drafts.get("timestamp");
    const draft: Draft = {
      input: old?.input || "",
      mode: "",
      unit: "",
      // Older drafts stored "utc"; IANA ids are case-sensitive.
      zone:
        old?.zone === "utc"
          ? "UTC"
          : old?.zone && validZone(old.zone)
            ? old.zone
            : "local",
      group: "",
      from: "",
      to: "",
      count: 0,
      generated: "",
    };
    drafts.set("timestamp", draft);
    return draft;
  });
  const update = (value: Partial<Draft>) =>
    setState((old) => {
      const next = { ...old, ...value };
      drafts.set("timestamp", next);
      return next;
    });
  const [zones, setZones] = useState(loadZones);
  const saveZones = (next: string[]) => {
    setZones(next);
    localStorage.setItem(zonesKey, JSON.stringify(next));
  };
  const [now, setNow] = useState(Date.now());
  const live = !state.input.trim();
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);
  const parsed = useMemo(() => {
    try {
      return { value: parseTime(state.input, state.zone), error: "" };
    } catch (e) {
      return { value: null, error: errorText(e) };
    }
  }, [state.input, state.zone]);
  const ms = parsed.value?.ms ?? now;
  const input = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState("");
  const zoneOptions = useMemo(() => {
    const seen = new Set(commonZones.map(([z]) => z));
    return [
      ...commonZones.map(([z, label]) => [z, `${t(label)} · ${z}`]),
      ...allZones()
        .filter((z) => !seen.has(z))
        .map((z) => [z, z]),
    ];
  }, [getLanguage()]);
  const addZone = (value: string) => {
    const match =
      zoneOptions.find(([z, label]) => z === value || label === value)?.[0] ||
      (validZone(value.trim()) ? value.trim() : "");
    if (!match) return notify(t("未找到该时区"));
    if (zones.includes(match)) return notify(t("时区已在列表中"));
    saveZones([...zones, match]);
    setAdding("");
  };
  const kindLabel = {
    now: "当前时间",
    seconds: "秒级时间戳",
    milliseconds: "毫秒级时间戳",
    date: "日期时间",
    iso: "ISO 8601",
  };
  const local = localZone();
  const formats: [string, string][] = [
    [t("秒级时间戳"), String(Math.floor(ms / 1000))],
    [t("毫秒级时间戳"), String(ms)],
    [t("本地时间"), formatZoned(ms, "local", ms % 1000 !== 0)],
    ["ISO 8601", isoWithOffset(ms, "local")],
    ["UTC", new Date(ms).toISOString()],
    ["RFC 2822", new Date(ms).toUTCString()],
  ];
  return (
    <section className="workspace time-workspace">
      <ToolHeader id="timestamp" back={back} notify={notify} />
      <div className="time-input-row">
        <div className={`time-input ${parsed.error ? "invalid" : ""}`}>
          <Clock3 size={18} />
          <input
            ref={input}
            aria-label={t("时间输入")}
            autoFocus
            spellCheck={false}
            value={state.input}
            placeholder={t(
              "粘贴时间戳或日期，如 1700000000 或 2026-11-16 09:30",
            )}
            onChange={(e) => update({ input: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape" && state.input) {
                e.preventDefault();
                e.stopPropagation();
                update({ input: "" });
              }
            }}
          />
          {state.input && (
            <button
              className="icon-button"
              aria-label={t("清空输入")}
              onClick={() => {
                update({ input: "" });
                input.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          className="secondary"
          onClick={() => {
            update({ input: String(Math.floor(Date.now() / 1000)) });
            input.current?.focus();
          }}
        >
          {t("填入当前时间")}
        </button>
      </div>
      <div className="time-status">
        {parsed.error ? (
          <span className="output-error" role="alert">
            {parsed.error}
          </span>
        ) : (
          <span>
            {live
              ? t("显示当前时间，每秒更新")
              : t("识别为：{kind}", { kind: t(kindLabel[parsed.value!.kind]) })}
          </span>
        )}
        {(live || parsed.value?.kind === "date") && (
          <label>
            {t("日期按此时区解析")}
            <select
              aria-label={t("解析时区")}
              value={state.zone}
              onChange={(e) => update({ zone: e.target.value })}
            >
              <option value="local">
                {t("本地时区")} · {local}
              </option>
              {[...new Set([...zones, ...commonZones.map(([z]) => z)])]
                .filter((z) => z !== "local")
                .map((z) => (
                  <option key={z} value={z}>
                    {zoneName(z)} · {z}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <div className="time-grid">
        <div className="editor-pane time-formats">
          <div className="editor-label">
            {t("常用格式")}
            <span>
              {t(weekdays[zonedParts(ms, "local").weekday])} ·{" "}
              {relativeTime(ms, live ? ms : Date.now(), getLanguage())}
            </span>
          </div>
          <dl>
            {formats.map(([label, value]) => (
              <button
                key={label}
                className="time-row"
                onClick={() => copyText(value, notify)}
                disabled={!!parsed.error}
              >
                <dt>{label}</dt>
                <dd>{parsed.error ? "—" : value}</dd>
                <Copy size={13} />
              </button>
            ))}
          </dl>
        </div>
        <div className="editor-pane time-zones">
          <div className="editor-label">
            {t("世界时钟")}
            <span>{t("点击复制该时区时间")}</span>
          </div>
          <ul>
            {zones.map((zone) => {
              const offset = zoneOffset(ms, zone);
              const shift = dayShift(ms, zone, "local");
              const value = formatZoned(ms, zone);
              return (
                <li key={zone}>
                  <button
                    className="time-zone-row"
                    disabled={!!parsed.error}
                    onClick={() => copyText(isoWithOffset(ms, zone), notify)}
                  >
                    <span className="time-zone-name">
                      <strong>{zoneName(zone)}</strong>
                      <small>
                        {resolveZone(zone)} · {offsetLabel(offset)}
                      </small>
                    </span>
                    <span className="time-zone-clock">
                      <strong>
                        {parsed.error ? "—" : value.slice(11, 16)}
                      </strong>
                      <small>
                        {value.slice(0, 10)}
                        {shift !== 0 && (
                          <em>{shift > 0 ? t("次日") : t("前一日")}</em>
                        )}
                      </small>
                    </span>
                  </button>
                  {zones.length > 1 && (
                    <button
                      className="icon-button time-zone-remove"
                      aria-label={t("移除 {zone}", { zone: zoneName(zone) })}
                      onClick={() => saveZones(zones.filter((z) => z !== zone))}
                    >
                      <X size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <form
            className="time-zone-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (adding.trim()) addZone(adding);
            }}
          >
            <input
              aria-label={t("添加时区")}
              list="time-zone-options"
              value={adding}
              placeholder={t("添加城市或时区，如 东京、Europe/Paris")}
              onChange={(e) => setAdding(e.target.value)}
            />
            <datalist id="time-zone-options">
              {zoneOptions.map(([z, label]) => (
                <option key={z} value={label} />
              ))}
            </datalist>
            <button
              className="secondary"
              type="submit"
              aria-label={t("添加时区")}
              disabled={!adding.trim()}
            >
              <Plus size={14} />
            </button>
          </form>
        </div>
      </div>
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("数据只在本机处理，工具输入仅在本次会话保留。")}
      </div>
    </section>
  );
}
