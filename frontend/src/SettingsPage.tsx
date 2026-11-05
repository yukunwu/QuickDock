import { defaultShortcut } from "./platform";
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
  const [shortcut, setShortcut] = useState(data.settings.shortcut);
  useEffect(
    () => setShortcut(data.settings.shortcut),
    [data.settings.shortcut],
  );
  return (
    <div className="settings-page scroll">
      <div className="eyebrow">MAKE IT YOURS</div>
      <h1>偏好设置</h1>
      <p className="muted">外观、快捷键与工具，按你的习惯设置。</p>
      {data.error && <div className="inline-warning">{data.error}</div>}
      <section className="settings-section">
        <h3>通用</h3>
        <div className="setting-row">
          <div>
            <strong>外观</strong>
            <p>选择你喜欢的工作氛围</p>
          </div>
          <div className="segmented">
            {[
              { id: "system" as const, icon: Monitor, label: "系统" },
              { id: "light" as const, icon: Sun, label: "浅色" },
              { id: "dark" as const, icon: Moon, label: "深色" },
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
            <strong>全局唤起快捷键</strong>
            <p>无论身在何处，即刻打开 QuickDock</p>
            {/Linux/.test(navigator.platform) && (
              <p>Wayland 桌面若不支持全局快捷键，请在系统键盘设置中绑定 quickdock --toggle。</p>
            )}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save({ ...data.settings, shortcut }).catch(() => {});
            }}
          >
            <input
              aria-label="全局快捷键"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder={defaultShortcut}
            />
            <button disabled={busy} className="secondary">
              保存
            </button>
          </form>
        </div>
        <div className="setting-row">
          <div>
            <strong>应用索引</strong>
            <p>
              已发现 {data.apps.length} 个应用
              {data.indexing ? " · 正在刷新…" : ""}
            </p>
          </div>
          <button
            className="secondary"
            disabled={data.indexing}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} />
            刷新索引
          </button>
        </div>
      </section>
      <section className="settings-section">
        <h3>
          工具与快捷入口 <span>{tools.length + launcherActions.length}</span>
        </h3>
        <p className="muted">关闭后隐藏对应工具或 Dock 联网快捷入口。</p>
        <div className="tool-switches">
          {[...tools, ...launcherActions].map((t) => (
            <div key={t.id} className="tool-switch">
              <span className={`item-icon ${t.color}`}>
                <t.icon size={17} />
              </span>
              <span>{t.name}</span>
              <button
                role="switch"
                aria-label={`启用${t.name}`}
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
        <h3>常用网址</h3>
        <Suspense fallback={<p>正在加载…</p>}>
          <BookmarkEditor
            settings={data.settings}
            saveSettings={save}
            notify={notify}
          />
        </Suspense>
      </section>
      <Suspense fallback={<p>正在加载更新…</p>}><UpdatePanel /></Suspense>
      <div className="settings-about">
        <span className="brand-mark">
          <Zap size={16} />
        </span>
        <div>
          <strong>QuickDock</strong>
          <p>Wails 3 · 为专注而生</p>
        </div>
        <span>本地优先，轻装上阵。</span>
      </div>
    </div>
  );
}
