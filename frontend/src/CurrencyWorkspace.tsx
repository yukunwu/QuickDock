import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Copy, RotateCw, Wifi } from "lucide-react";
import { t, errorText, useLocale } from "./i18n";
import { drafts } from "./toolSession";
import type { Draft } from "./tools/compute";
import { exchangeRates } from "./bridge";
import {
  currencyName,
  favoriteCurrencies,
  formatMoney,
  parseAmount,
  plainMoney,
  rate,
  rateText,
  type Rates,
} from "./tools/currency";
import ToolHeader, { copyText } from "./ToolHeader";
const code = (value: string | undefined, fallback: string) =>
  value && /^[A-Z]{3}$/.test(value) ? value : fallback;
export default function CurrencyWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  const language = useLocale();
  const [state, setState] = useState<Draft>(() => {
    const old = drafts.get("currency");
    const draft: Draft = {
      input: old?.input ?? "100",
      mode: "",
      unit: "",
      zone: "",
      group: "",
      from: code(old?.from, "USD"),
      to: code(old?.to, "CNY"),
      count: 0,
      generated: "",
    };
    drafts.set("currency", draft);
    return draft;
  });
  const update = (value: Partial<Draft>) =>
    setState((old) => {
      const next = { ...old, ...value };
      drafts.set("currency", next);
      return next;
    });
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const load = (refresh: boolean) => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    exchangeRates(refresh)
      .then((next) => {
        if (id !== request.current) return;
        setRates(next);
        if (refresh && !next.stale) notify(t("汇率已更新"));
      })
      .catch((e) => id === request.current && setError(errorText(e)))
      .finally(() => id === request.current && setLoading(false));
  };
  useEffect(() => load(false), []);
  const input = useRef<HTMLInputElement>(null);
  const amount = useMemo(() => {
    try {
      return { value: parseAmount(state.input), error: "" };
    } catch (e) {
      return { value: null, error: errorText(e) };
    }
  }, [state.input]);
  const codes = useMemo(() => {
    if (!rates) return [];
    const all = Object.keys(rates.rates);
    const favorites = favoriteCurrencies.filter((c) => all.includes(c));
    return [...favorites, ...all.filter((c) => !favorites.includes(c)).sort()];
  }, [rates]);
  const supported = (c: string) => !!rates?.rates[c];
  const from = state.from,
    to = state.to;
  const pairRate =
    rates && supported(from) && supported(to) ? rate(rates, from, to) : null;
  const value = amount.value ?? 1;
  const converted = pairRate === null ? null : value * pairRate;
  const others = codes.filter((c) => c !== from && c !== to).slice(0, 10);
  const picker = (label: string, current: string, key: "from" | "to") => (
    <select
      aria-label={t(label)}
      value={current}
      onChange={(e) => {
        const next = e.target.value;
        // Picking the other side's currency swaps instead of making a no-op pair.
        if (next === (key === "from" ? to : from))
          update({ from: to, to: from });
        else update({ [key]: next });
      }}
    >
      {!supported(current) && <option value={current}>{current}</option>}
      {codes.map((c) => (
        <option key={c} value={c}>
          {c} · {currencyName(c, language)}
        </option>
      ))}
    </select>
  );
  const updated = rates
    ? new Date(rates.fetchedAt).toLocaleString(language, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return (
    <section className="workspace currency-workspace">
      <ToolHeader id="currency" back={back} notify={notify}>
        <button
          className="secondary"
          disabled={loading}
          onClick={() => load(true)}
          aria-label={t("刷新汇率")}
        >
          <RotateCw size={14} className={loading ? "spin" : ""} />
          {loading ? t("更新中…") : t("刷新汇率")}
        </button>
      </ToolHeader>
      <div className="currency-pair">
        <div className={`currency-field ${amount.error ? "invalid" : ""}`}>
          <input
            ref={input}
            aria-label={t("金额")}
            autoFocus
            inputMode="decimal"
            spellCheck={false}
            value={state.input}
            placeholder="1"
            onChange={(e) => update({ input: e.target.value })}
            onFocus={(e) => e.target.select()}
          />
          {picker("原币种", from, "from")}
        </div>
        <button
          className="icon-button currency-swap"
          aria-label={t("交换币种")}
          title={t("交换币种")}
          onClick={() => {
            update({ from: to, to: from });
            input.current?.focus();
          }}
        >
          <ArrowLeftRight size={16} />
        </button>
        <div className="currency-field result">
          <button
            className="currency-result"
            aria-label={t("复制换算结果")}
            disabled={converted === null || !!amount.error}
            onClick={() =>
              converted !== null &&
              copyText(plainMoney(converted, to), notify, "结果已复制")
            }
          >
            {amount.error
              ? "—"
              : converted === null
                ? "…"
                : formatMoney(converted, to, language)}
          </button>
          {picker("目标币种", to, "to")}
        </div>
      </div>
      <div className="currency-status">
        {amount.error ? (
          <span className="output-error" role="alert">
            {amount.error}
          </span>
        ) : pairRate !== null ? (
          <span>
            1 {from} = {rateText(pairRate)} {to} · 1 {to} ={" "}
            {rateText(1 / pairRate)} {from}
          </span>
        ) : rates ? (
          <span className="output-error">{t("暂不支持该货币")}</span>
        ) : null}
        {amount.value !== null &&
          !/^[\d.,\s-]+$/.test(state.input.trim()) &&
          !amount.error && (
            <span>
              = {formatMoney(amount.value, from, language)} {from}
            </span>
          )}
      </div>
      {error && !rates ? (
        <div className="editor-pane currency-empty" role="alert">
          <Wifi size={20} />
          <p>{error}</p>
          <button className="secondary" onClick={() => load(true)}>
            {t("重试")}
          </button>
        </div>
      ) : (
        <div className="editor-pane currency-table">
          <div className="editor-label">
            {t("{amount} {code} 可兑换", {
              amount: formatMoney(value, from, language),
              code: from,
            })}
            <span>{t("点击行设为目标币种")}</span>
          </div>
          <ul>
            {(rates ? others : favoriteCurrencies.slice(0, 6)).map((c) => {
              const r = rates && supported(from) ? rate(rates, from, c) : null;
              return (
                <li key={c}>
                  <button
                    className="currency-row"
                    disabled={r === null}
                    onClick={() => update({ to: c })}
                  >
                    <span className="currency-code">{c}</span>
                    <span className="currency-name">
                      {currencyName(c, language)}
                    </span>
                    <strong>
                      {r === null || amount.error
                        ? "—"
                        : formatMoney(value * r, c, language)}
                    </strong>
                    <small>{r === null ? "" : rateText(r)}</small>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t("复制 {code} 金额", { code: c })}
                    disabled={r === null || !!amount.error}
                    onClick={() =>
                      r !== null && copyText(plainMoney(value * r, c), notify)
                    }
                  >
                    <Copy size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="workspace-note currency-note">
        <span>
          {rates
            ? t("欧洲央行参考汇率 · {date} · 本机更新于 {time}", {
                date: rates.date,
                time: updated,
              })
            : loading
              ? t("正在获取汇率…")
              : ""}
        </span>
        {rates?.stale && (
          <span className="output-error">{t("离线，显示上次保存的汇率")}</span>
        )}
        <span className="currency-privacy">
          {t("仅下载汇率表，金额只在本机计算")}
        </span>
      </div>
    </section>
  );
}
