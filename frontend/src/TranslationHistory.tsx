import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { errorText, getLanguage, t, useLocale } from "./i18n";
import * as bridge from "./bridge";
import type { TranslationRecord } from "./bridge";
import { languages } from "./tools/online";
const languageName = (id: string) =>
  id === "auto"
    ? t("自动检测")
    : t(languages.find(([code]) => code === id)?.[1] || id);
// Loads and keeps the translation history current; the page reports new
// entries through Go, which fires quickdock-translation-history.
export function useTranslationHistory() {
  const [records, setRecords] = useState<TranslationRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      void bridge
        .translationHistory()
        .then((rows) => {
          if (active) {
            setRecords(rows);
            setError("");
          }
        })
        .catch((e) => active && setError(errorText(e)));
    load();
    window.addEventListener("quickdock-translation-history", load);
    return () => {
      active = false;
      window.removeEventListener("quickdock-translation-history", load);
    };
  }, []);
  return { records, setRecords, error, setError };
}
export default function TranslationHistory({
  history,
  pick,
  close,
}: {
  history: ReturnType<typeof useTranslationHistory>;
  pick: (record: TranslationRecord) => void;
  close: () => void;
}) {
  useLocale();
  const { records, setRecords, error, setError } = history;
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const remove = async (id?: string) => {
    setBusy(true);
    try {
      if (id) setRecords(await bridge.deleteTranslation(id));
      else {
        await bridge.clearTranslations();
        setRecords([]);
        setConfirmClear(false);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside
      className="calculation-history translation-history"
      aria-label={t("翻译历史")}
    >
      <div className="history-heading">
        <strong>{t("翻译历史")}</strong>
        <button
          className="icon-button"
          aria-label={t("关闭历史记录")}
          onClick={close}
        >
          <X size={15} />
        </button>
      </div>
      <p>{t("自动记录在本机 · 最近200条")}</p>
      {error && (
        <div className="inline-warning" role="alert">
          {error}
        </div>
      )}
      <div className="history-list">
        {!records.length ? (
          <div className="empty">
            {t("还没有记录")}
            <br />
            {t("翻译过的内容会自动出现在这里。")}
          </div>
        ) : (
          records.map((record) => (
            <article key={record.id}>
              <button
                className="history-load"
                aria-label={t("载入翻译 {text}", {
                  text: record.text.slice(0, 40),
                })}
                onClick={() => pick(record)}
              >
                <time>
                  {new Date(record.createdAt).toLocaleString(getLanguage(), {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {languageName(record.source)} →{" "}
                  {languageName(record.target)}
                </time>
                <strong>{record.text}</strong>
                {record.result && <span>{record.result}</span>}
              </button>
              <button
                className="icon-button"
                aria-label={t("删除翻译 {text}", {
                  text: record.text.slice(0, 40),
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
            <button className="secondary" onClick={() => setConfirmClear(true)}>
              {t("清空历史")}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
