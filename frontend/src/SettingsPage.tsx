import { errorText, t, t as translate, useLocale } from "./i18n";
import ShortcutPicker from "./ShortcutPicker";
import { languages } from "./i18n";
import { Suspense, lazy, useState, useEffect } from "react";
import * as bridge from "./bridge";
import {
  Monitor,
  Sun,
  Moon,
  RefreshCw,
  Zap,
  Download,
  Upload,
} from "lucide-react";
import { loadWorldClocks, storeWorldClocks } from "./tools/worldClocks";
import {
  tools,
  launcherActions,
  type Settings,
  type Snapshot,
} from "./catalog";
const UpdatePanel = lazy(() => import("./UpdatePanel"));
const BookmarkEditor = lazy(() => import("./BookmarkEditor"));
export default function SettingsPage({
  data,
  busy,
  save,
  refresh,
  notify,
}: {
  data: Snapshot;
  busy: boolean;
  save: (s: Settings) => Promise<void>;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  useLocale();
  return (
    <div className="settings-page scroll">
      <h1>{t("偏好设置")}</h1>
      <p className="muted">{t("语言、外观与键盘操作")}</p>
      {data.error && (
        <div className="inline-warning">{errorText(data.error)}</div>
      )}
      <section className="settings-section">
        <h3>{t("通用")}</h3>
        <div className="setting-row">
          <div>
            <strong>{t("界面语言")}</strong>
          </div>
          <select
            aria-label={t("界面语言")}
            value={data.settings.language || "system"}
            disabled={busy}
            onChange={(e) =>
              void save({
                ...data.settings,
                language: e.target.value as Settings["language"],
              }).catch(() => {})
            }
          >
            <option value="system">{t("跟随系统")}</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {
                  {
                    "zh-CN": "简体中文",
                    "zh-TW": "繁體中文",
                    en: "English",
                    ja: "日本語",
                    es: "Español",
                  }[l]
                }
              </option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t("外观")}</strong>
          </div>
          <div className="segmented">
            {[
              { id: "system" as const, icon: Monitor, label: t("系统") },
              { id: "light" as const, icon: Sun, label: t("浅色") },
              { id: "dark" as const, icon: Moon, label: t("深色") },
            ].map((t) => (
              <button
                disabled={busy}
                key={t.id}
                onClick={() =>
                  void save({ ...data.settings, theme: t.id }).catch(() => {})
                }
                className={data.settings.theme === t.id ? "active" : ""}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t("全局唤起快捷键")}</strong>
            <p>{t("再次按下相同快捷键可隐藏")}</p>
            {/Linux/.test(navigator.platform) && (
              <p>
                {t(
                  "Wayland 桌面若不支持全局快捷键，请在系统键盘设置中绑定 quickdock --toggle。",
                )}
              </p>
            )}
          </div>
          <ShortcutPicker
            value={data.settings.shortcut}
            busy={busy}
            save={(shortcut) => save({ ...data.settings, shortcut })}
          />
        </div>
        <LoginItemRow notify={notify} />
        <div className="setting-row">
          <div>
            <strong>{t("应用索引")}</strong>
            <p>
              {t("已发现")} {data.apps.length} {t("个应用")}
              {data.indexing ? " " + t("· 正在刷新…") : ""}
            </p>
          </div>
          <button
            className="secondary"
            disabled={data.indexing}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} />
            {t("刷新索引")}
          </button>
        </div>
      </section>
      <section className="settings-section">
        <h3>
          {t("工具与快捷入口")}{" "}
          <span>{tools.length + launcherActions.length}</span>
        </h3>
        <p className="muted">{t("关闭后隐藏对应工具或 Dock 联网快捷入口。")}</p>
        <div className="tool-switches">
          {[...tools, ...launcherActions].map((t) => (
            <div key={t.id} className="tool-switch">
              <span className={`item-icon ${t.color}`}>
                <t.icon size={17} />
              </span>
              <span>{t.name}</span>
              <button
                role="switch"
                aria-label={translate("启用{tool}", { tool: t.name })}
                aria-checked={!data.settings.disabledTools.includes(t.id)}
                disabled={busy}
                className={`switch ${data.settings.disabledTools.includes(t.id) ? "" : "on"}`}
                onClick={() =>
                  void save({
                    ...data.settings,
                    disabledTools: data.settings.disabledTools.includes(t.id)
                      ? data.settings.disabledTools.filter((id) => id !== t.id)
                      : [...data.settings.disabledTools, t.id],
                  }).catch(() => {})
                }
              >
                <span />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h3>{t("常用网址")}</h3>
        <Suspense fallback={<p>{t("正在加载…")}</p>}>
          <BookmarkEditor
            settings={data.settings}
            saveSettings={save}
            notify={notify}
          />
        </Suspense>
      </section>
      <BackupSection data={data} save={save} notify={notify} />
      <Suspense fallback={<p>{t("正在加载更新…")}</p>}>
        <UpdatePanel />
      </Suspense>
      <div className="settings-about">
        <span className="brand-mark">
          <Zap size={16} />
        </span>
        <div>
          <strong>QuickDock</strong>
          <p>{t("应用启动与日常工具")}</p>
        </div>
        <span>{t("工具数据保存在本机")}</span>
      </div>
    </div>
  );
}

function LoginItemRow({ notify }: { notify: (s: string) => void }) {
  useLocale();
  const [item, setItem] = useState<bridge.LoginItem | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const load = () =>
      void bridge
        .loginItem()
        .then(setItem)
        .catch(() => setItem(null));
    load();
    // Approval happens in System Settings; re-read when the user comes back.
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);
  const on = !!item && (item.enabled || item.needsApproval);
  return (
    <div className="setting-row">
      <div>
        <strong>{t("开机自动启动")}</strong>
        <p>
          {!item?.supported
            ? bridge.native
              ? t(
                  "当前安装方式不支持开机启动，请先将 QuickDock 移到应用程序文件夹",
                )
              : t("请在桌面版中设置开机启动")
            : item.needsApproval
              ? t("需要在系统设置的“登录项”中允许 QuickDock")
              : t("登录后在后台启动，不弹出窗口")}
        </p>
        {item?.needsApproval && (
          <button
            className="secondary setting-inline-action"
            onClick={() => void bridge.openLoginItemSettings()}
          >
            {t("打开登录项设置")}
          </button>
        )}
      </div>
      <button
        role="switch"
        aria-label={t("开机自动启动")}
        aria-checked={on}
        disabled={busy || !item?.supported}
        className={`switch ${on ? "on" : ""}`}
        onClick={() => {
          setBusy(true);
          bridge
            .setLaunchAtLogin(!on)
            .then((next) => {
              setItem(next);
              notify(
                next.needsApproval
                  ? t("需要在系统设置的“登录项”中允许 QuickDock")
                  : next.enabled
                    ? t("已开启开机自动启动")
                    : t("已关闭开机自动启动"),
              );
            })
            .catch((e) => notify(errorText(e)))
            .finally(() => setBusy(false));
        }}
      >
        <span />
      </button>
    </div>
  );
}

// Backups carry preferences only: usage counts and histories stay here.
function BackupSection({
  data,
  save,
  notify,
}: {
  data: Snapshot;
  save: (s: Settings) => Promise<void>;
  notify: (s: string) => void;
}) {
  useLocale();
  const [pending, setPending] = useState<bridge.ConfigExport | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const apply = (config: bridge.ConfigExport) =>
    run(async () => {
      // Recording the clipboard stays an opt-in on each machine.
      const settings = {
        ...config.settings,
        version: data.settings.version,
        clipboardHistory: data.settings.clipboardHistory,
      };
      let shortcutKept = false;
      try {
        await save(settings);
      } catch (e) {
        // A shortcut from another platform or already taken must not block
        // the rest of the backup; any other failure is reported as is.
        if (
          settings.shortcut === data.settings.shortcut ||
          !(await bridge.snapshot()).shortcutError
        )
          throw e;
        await save({ ...settings, shortcut: data.settings.shortcut });
        shortcutKept = true;
      }
      storeWorldClocks(config.worldClocks);
      setPending(null);
      notify(
        shortcutKept
          ? t("配置已导入，快捷键无法使用，已保留当前快捷键")
          : t("配置已导入"),
      );
    });
  return (
    <section className="settings-section">
      <h3>{t("备份与迁移")}</h3>
      <p className="muted">
        {t(
          "导出语言、外观、快捷键、工具开关、常用网址和世界时钟；使用记录与各类历史不会导出。",
        )}
      </p>
      <div className="setting-row">
        <div>
          <strong>{t("配置文件")}</strong>
          <p>{t("可在另一台电脑上导入")}</p>
        </div>
        <span className="backup-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const saved = await bridge.exportConfig({
                  version: 1,
                  app: "QuickDock",
                  exportedAt: Date.now(),
                  settings: { ...data.settings, clipboardHistory: undefined },
                  worldClocks: loadWorldClocks(),
                });
                if (saved) notify(t("配置已导出"));
              })
            }
          >
            <Download size={14} />
            {t("导出配置")}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => setPending(await bridge.importConfig()))
            }
          >
            <Upload size={14} />
            {t("导入配置")}
          </button>
        </span>
      </div>
      {pending && (
        <div className="setting-row backup-confirm" role="alert">
          <div>
            <strong>{t("确认导入？")}</strong>
            <p>
              {t(
                "将覆盖当前设置，并替换为 {bookmarks} 个常用网址、{clocks} 个世界时钟。",
                {
                  bookmarks: pending.settings.bookmarks.length,
                  clocks: pending.worldClocks.length,
                },
              )}
            </p>
          </div>
          <span className="backup-actions">
            <button className="secondary" onClick={() => setPending(null)}>
              {t("取消")}
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void apply(pending)}
            >
              {t("确认导入")}
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
