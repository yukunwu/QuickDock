import type { AppEntry } from "./catalog";

// Restrict conventional Chinese/English names to known application identifiers.
// A shared parent directory or vendor identifier must not make unrelated apps match.
const known: Record<string, readonly string[]> = {
  "com.apple.finder": ["Finder", "访达", "訪達"],
  "com.apple.systempreferences": [
    "System Settings",
    "System Preferences",
    "系统设置",
    "系统偏好设置",
    "系統設定",
  ],
  "com.apple.terminal": ["Terminal", "终端", "終端機"],
  "com.apple.activitymonitor": ["Activity Monitor", "活动监视器", "活動監視器"],
  "com.apple.notes": ["Notes", "备忘录", "備忘錄"],
  "com.apple.safari": ["Safari", "Safari浏览器", "Safari瀏覽器"],
  "com.apple.calculator": ["Calculator", "计算器", "計算機"],
  "com.apple.screencaptureui": ["Screenshot", "截屏", "截圖"],
  "com.apple.diskutility": ["Disk Utility", "磁盘工具", "磁碟工具程式"],
  "com.tencent.xinwechat": ["WeChat", "微信"],
  "com.tencent.qq": ["QQ", "腾讯QQ", "騰訊QQ"],
  "com.electron.lark": ["Lark", "Feishu", "飞书", "飛書"],
  "com.alibaba.dingtalkmac": ["DingTalk", "钉钉", "釘釘"],
  "com.google.chrome": ["Google Chrome", "谷歌浏览器", "谷歌瀏覽器"],
  "com.microsoft.edgemac": ["Microsoft Edge", "Edge浏览器", "Edge瀏覽器"],
  "com.microsoft.vscode": ["Visual Studio Code", "VS Code", "vscode"],
};
function entryName(path: string) {
  // Both separators are accepted even when a cached index moves across platforms.
  const last =
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || "";
  return last.replace(/\.(app|exe|lnk|desktop)$/i, "");
}
export function applicationAliases(app: AppEntry): string[] {
  const aliases = [
    ...(app.aliases || []),
    entryName(app.path),
    ...(known[app.bundleId.toLowerCase()] || []),
  ];
  // Windows stores the target executable in bundleId. Only its basename belongs
  // in search, never C:\Users\... or the generic Applications/Start Menu paths.
  if (/\.exe$/i.test(app.bundleId)) aliases.push(entryName(app.bundleId));
  return [
    ...new Set(
      aliases
        .map((value) => value.trim())
        .filter((value) => value && value !== app.name),
    ),
  ];
}
