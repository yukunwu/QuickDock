import { useEffect, useState } from "react";
import * as bridge from "./bridge";
export default function UpdatePanel() {
  const [info, setInfo] = useState<bridge.UpdateInfo | null>(null);
  const [error, setError] = useState("");
  const refresh = () =>
    bridge
      .updateStatus()
      .then(setInfo)
      .catch((e) => setError(String(e)));
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
      setError(String(e).replace(/^(RuntimeError|Error):\s*/, ""));
    }
  };
  const labels: Record<string, string> = {
    idle: "启动后及每 6 小时自动检查",
    checking: "正在检查更新…",
    latest: "已是最新版本",
    available: `发现新版本 ${info?.version || ""}`,
    downloading: `正在下载 ${info?.progress || 0}%`,
    installing: "正在安装，请在系统提示中授权",
    ready: "更新已准备好，重启后生效",
    error: "更新未完成，可重新检查",
  };
  const busy = ["checking", "downloading", "installing"].includes(
    info?.state || "",
  );
  return (
    <section className="settings-section" aria-label="应用更新">
      <h3>应用更新</h3>
      <div className="setting-row">
        <div>
          <strong>QuickDock {info?.current || ""}</strong>
          <p role="status" aria-label="更新状态">
            {labels[info?.state || "idle"]}
          </p>
        </div>
        <div className="inline-form">
          <button
            className="secondary"
            disabled={busy || info?.state === "ready"}
            onClick={() => void run(bridge.checkForUpdates)}
          >
            检查更新
          </button>
          {info?.state === "available" && (
            <button
              className="primary"
              onClick={() => void run(bridge.installUpdate)}
            >
              下载并安装
            </button>
          )}
          {info?.state === "ready" && (
            <button
              className="primary"
              onClick={() => void run(bridge.restartAfterUpdate)}
            >
              保存并重启
            </button>
          )}
        </div>
      </div>
      {(error || info?.error) && (
        <p className="inline-warning" role="alert">
          {error || info?.error}
        </p>
      )}
      {info?.notes && (
        <details>
          <summary>版本说明</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{info.notes}</p>
        </details>
      )}
      <p className="muted">
        下载后校验 SHA256。独立工具在重启前保存；Dock 临时输入请先保存。
        {info?.linux
          ? "Linux 使用系统包管理器安装，需要管理员授权。"
          : "应用须位于可写目录；macOS 建议放入“应用程序”。"}
      </p>
    </section>
  );
}
