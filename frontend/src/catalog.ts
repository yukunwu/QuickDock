import { t } from "./i18n";
import { defaultShortcut } from "./platform";
import {
  Calculator,
  Languages,
  Search,
  Braces,
  Clock3,
  Binary,
  Link,
  Fingerprint,
  Hash,
  Ruler,
  CaseSensitive,
  Globe,
  Command,
  Terminal,
  Compass,
  Folder,
  Code2,
  type LucideIcon,
} from "lucide-react";
export type ToolID =
  | "calculator"
  | "timestamp"
  | "json"
  | "base64"
  | "url"
  | "uuid"
  | "hash"
  | "units"
  | "text"
  | "bookmarks"
  | "translate";
export interface ToolDefinition {
  id: ToolID;
  name: string;
  subtitle: string;
  keywords: string;
  category: "开发" | "日常";
  icon: LucideIcon;
  color: string;
  version: string;
}
export const tools: ToolDefinition[] = [
  {
    id: "translate",
    get name() {
      return t("翻译");
    },
    get subtitle() {
      return t("Google网页翻译，支持独立窗口");
    },
    keywords: "translate translation fanyi fy 翻译",
    category: "日常",
    icon: Languages,
    color: "purple",
    version: "1.0.0",
  },
  {
    id: "calculator",
    get name() {
      return t("计算稿纸");
    },
    get subtitle() {
      return t("多行算式、逐行结果与历史记录");
    },
    keywords: "calc jisuanqi jsq math 计算器 jisuangaozhi 计算稿纸 jsgz",
    category: "日常",
    icon: Calculator,
    color: "orange",
    version: "1.0.0",
  },
  {
    id: "json",
    get name() {
      return t("JSON 格式化");
    },
    get subtitle() {
      return t("格式化、压缩，保留大整数");
    },
    keywords: "json format geshihua gsh",
    category: "开发",
    icon: Braces,
    color: "green",
    version: "1.0.0",
  },
  {
    id: "timestamp",
    get name() {
      return t("时间戳转换");
    },
    get subtitle() {
      return t("日期与秒、毫秒时间戳互转");
    },
    keywords: "timestamp time shijianchuo sjc",
    category: "开发",
    icon: Clock3,
    color: "blue",
    version: "1.0.0",
  },
  {
    id: "base64",
    get name() {
      return t("Base64");
    },
    get subtitle() {
      return t("文本编码与解码");
    },
    keywords: "base64 encode decode bianma",
    category: "开发",
    icon: Binary,
    color: "purple",
    version: "1.0.0",
  },
  {
    id: "url",
    get name() {
      return t("URL 编解码");
    },
    get subtitle() {
      return t("URL 组件编码与解码");
    },
    keywords: "url encode decode bianjiema",
    category: "开发",
    icon: Link,
    color: "cyan",
    version: "1.0.0",
  },
  {
    id: "uuid",
    get name() {
      return t("UUID 生成");
    },
    get subtitle() {
      return t("生成单个或批量 UUID v4");
    },
    keywords: "uuid id suiji",
    category: "开发",
    icon: Fingerprint,
    color: "pink",
    version: "1.0.0",
  },
  {
    id: "hash",
    get name() {
      return t("文本哈希");
    },
    get subtitle() {
      return t("MD5、SHA-1、SHA-256、SHA-512");
    },
    keywords: "hash md5 sha wenbenhaxi",
    category: "开发",
    icon: Hash,
    color: "yellow",
    version: "1.0.0",
  },
  {
    id: "units",
    get name() {
      return t("单位换算");
    },
    get subtitle() {
      return t("长度、质量、温度与数据容量");
    },
    keywords: "unit convert danweihuansuan dwhs",
    category: "日常",
    icon: Ruler,
    color: "blue",
    version: "1.0.0",
  },
  {
    id: "text",
    get name() {
      return t("文本处理");
    },
    get subtitle() {
      return t("大小写、去重与逐行整理");
    },
    keywords: "text wenbenchuli wbcl",
    category: "日常",
    icon: CaseSensitive,
    color: "green",
    version: "1.0.0",
  },
  {
    id: "bookmarks",
    get name() {
      return t("常用网址");
    },
    get subtitle() {
      return t("保存网址，通过名称或别名打开");
    },
    keywords: "bookmark website wangzhi wz",
    category: "日常",
    icon: Globe,
    color: "purple",
    version: "1.0.0",
  },
];
export interface AppEntry {
  id: string;
  name: string;
  path: string;
  bundleId: string;
  icon?: string;
}
export interface Bookmark {
  id: string;
  name: string;
  url: string;
  alias: string;
}
export interface Settings {
  version: number;
  language?: "system" | "zh-CN" | "zh-TW" | "en" | "ja" | "es";
  theme: "system" | "dark" | "light";
  shortcut: string;
  disabledTools: string[];
  bookmarks: Bookmark[];
}
export interface Usage {
  count: number;
  lastUsed: number;
}
export interface Snapshot {
  apps: AppEntry[];
  settings: Settings;
  usage: Record<string, Usage>;
  indexing: boolean;
  error: string;
  shortcutError: string;
}
export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  kind:
    "app" | "tool" | "bookmark" | "calculation" | "websearch" | "translation";
  icon: LucideIcon;
  color: string;
  image?: string;
  value?: string;
}
export const fallbackIcons: Record<string, LucideIcon> = {
  Finder: Folder,
  Terminal: Terminal,
  Safari: Compass,
  "Visual Studio Code": Code2,
};
export const genericAppIcon = Command;
export const defaults: Settings = {
  version: 1,
  language: "system",
  theme: "system",
  shortcut: defaultShortcut,
  disabledTools: [],
  bookmarks: [],
};
export const previewApps: AppEntry[] = [
  {
    id: "preview-finder",
    get name() {
      return t("Finder");
    },
    path: "/System/Library/CoreServices/Finder.app",
    bundleId: "com.apple.finder",
  },
  {
    id: "preview-safari",
    get name() {
      return t("Safari");
    },
    path: "/Applications/Safari.app",
    bundleId: "com.apple.Safari",
  },
  {
    id: "preview-code",
    get name() {
      return t("Visual Studio Code");
    },
    path: "/Applications/Visual Studio Code.app",
    bundleId: "com.microsoft.VSCode",
  },
  {
    id: "preview-terminal",
    get name() {
      return t("Terminal");
    },
    path: "/System/Applications/Utilities/Terminal.app",
    bundleId: "com.apple.Terminal",
  },
];

export const launcherActions = [
  {
    id: "google",
    get name() {
      return t("Google 搜索");
    },
    get subtitle() {
      return t("无应用匹配时，用默认浏览器搜索");
    },
    icon: Search,
    color: "blue",
  },
];
