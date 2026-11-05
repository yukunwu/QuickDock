import { errorText, t, t as translate, useLocale } from "./i18n";
import ShortcutPicker from "./ShortcutPicker";
import { languages } from "./i18n";
import { Suspense, lazy, useState, useEffect } from "react";
import { Monitor, Sun, Moon, RefreshCw, Zap } from "lucide-react";
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
