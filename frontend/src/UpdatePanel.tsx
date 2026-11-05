import { errorText, t, useLocale } from "./i18n";
import { useEffect, useState } from "react";
import * as bridge from "./bridge";
export default function UpdatePanel() {
  useLocale();
  const [info, setInfo] = useState<bridge.UpdateInfo | null>(null);
  const [error, setError] = useState("");
  const refresh = () =>
    bridge
      .updateStatus()
      .then(setInfo)
      .catch((e) => setError(errorText(e)));
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    return () => clearInterval(timer);
  }, []);
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(errorText(e).replace(/^(RuntimeError|Error):\s*/, ""));
    }
  };
  const labels: Record<string, string> = {
    idle: t("启动后及每 6 小时自动检查"),
    checking: t("正在检查更新…"),
    latest: t("已是最新版本"),
    available: t("发现新版本 {version}", { version: info?.version || "" }),
    downloading: t("正在下载 {progress}%", { progress: info?.progress || 0 }),
    installing: t("正在安装，请在系统提示中授权"),
    ready: t("更新已准备好，重启后生效"),
    error: t("更新未完成，可重新检查"),
  };
  const busy = ["checking", "downloading", "installing"].includes(
    info?.state || "",
  );
  return (
    <section className="settings-section" aria-label={t("应用更新")}>
      <h3>{t("应用更新")}</h3>
      <div className="setting-row">
        <div>
          <strong>QuickDock {info?.current || ""}</strong>
          <p role="status" aria-label={t("更新状态")}>
            {labels[info?.state || "idle"]}
          </p>
        </div>
        <div className="inline-form">
          <button
            className="secondary"
            disabled={busy || info?.state === "ready"}
            onClick={() => void run(bridge.checkForUpdates)}
          >
            {t("检查更新")}
          </button>
          {info?.state === "available" && (
            <button
              className="primary"
              onClick={() => void run(bridge.installUpdate)}
            >
              {t("下载并安装")}
            </button>
          )}
          {info?.state === "ready" && (
            <button
              className="primary"
              onClick={() => void run(bridge.restartAfterUpdate)}
            >
              {t("保存并重启")}
            </button>
          )}
        </div>
      </div>
      {(error || info?.error) && (
        <p className="inline-warning" role="alert">
          {errorText(error || info?.error)}
        </p>
      )}
      {info?.notes && (
        <details>
          <summary>{t("版本说明")}</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{info.notes}</p>
        </details>
      )}
      <p className="muted">
        {t("下载后校验 SHA256。独立工具在重启前保存；Dock 临时输入请先保存。")}
        {info?.linux
          ? t("Linux 使用系统包管理器安装，需要管理员授权。")
          : t("应用须位于可写目录；macOS 建议放入“应用程序”。")}
      </p>
    </section>
  );
}
