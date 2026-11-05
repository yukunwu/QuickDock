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
    name: "翻译",
    subtitle: "Google网页翻译，支持独立窗口",
    keywords: "translate translation fanyi fy 翻译",
    category: "日常",
    icon: Languages,
    color: "purple",
    version: "1.0.0",
  },
  {
    id: "calculator",
    name: "计算稿纸",
    subtitle: "多行算式、逐行结果与历史记录",
    keywords: "calc jisuanqi jsq math 计算器 jisuangaozhi 计算稿纸 jsgz",
    category: "日常",
    icon: Calculator,
    color: "orange",
    version: "1.0.0",
  },
  {
    id: "json",
    name: "JSON 格式化",
    subtitle: "复杂的数据，一目了然",
    keywords: "json format geshihua gsh",
    category: "开发",
    icon: Braces,
    color: "green",
    version: "1.0.0",
  },
  {
    id: "timestamp",
    name: "时间戳转换",
    subtitle: "时间与数字，自由转换",
    keywords: "timestamp time shijianchuo sjc",
    category: "开发",
    icon: Clock3,
    color: "blue",
    version: "1.0.0",
  },
  {
    id: "base64",
    name: "Base64",
    subtitle: "文本编码与解码",
    keywords: "base64 encode decode bianma",
    category: "开发",
    icon: Binary,
    color: "purple",
    version: "1.0.0",
  },
  {
    id: "url",
    name: "URL 编解码",
    subtitle: "轻松处理 URL 特殊字符",
    keywords: "url encode decode bianjiema",
    category: "开发",
    icon: Link,
    color: "cyan",
    version: "1.0.0",
  },
  {
    id: "uuid",
    name: "UUID 生成",
    subtitle: "为每个想法，生成唯一标识",
    keywords: "uuid id suiji",
    category: "开发",
    icon: Fingerprint,
    color: "pink",
    version: "1.0.0",
  },
  {
    id: "hash",
    name: "文本哈希",
    subtitle: "快速计算文本摘要",
    keywords: "hash md5 sha wenbenhaxi",
    category: "开发",
    icon: Hash,
    color: "yellow",
    version: "1.0.0",
  },
  {
    id: "units",
    name: "单位换算",
    subtitle: "从千米到字节，准确换算",
    keywords: "unit convert danweihuansuan dwhs",
    category: "日常",
    icon: Ruler,
    color: "blue",
    version: "1.0.0",
  },
  {
    id: "text",
    name: "文本处理",
    subtitle: "整理文字，专注内容",
    keywords: "text wenbenchuli wbcl",
    category: "日常",
    icon: CaseSensitive,
    color: "green",
    version: "1.0.0",
  },
  {
    id: "bookmarks",
    name: "常用网址",
    subtitle: "收藏的目的地，一步直达",
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
  theme: "system",
  shortcut: defaultShortcut,
  disabledTools: [],
  bookmarks: [],
};
export const previewApps: AppEntry[] = [
  {
    id: "preview-finder",
    name: "Finder",
    path: "/System/Library/CoreServices/Finder.app",
    bundleId: "com.apple.finder",
  },
  {
    id: "preview-safari",
    name: "Safari",
    path: "/Applications/Safari.app",
    bundleId: "com.apple.Safari",
  },
  {
    id: "preview-code",
    name: "Visual Studio Code",
    path: "/Applications/Visual Studio Code.app",
    bundleId: "com.microsoft.VSCode",
  },
  {
    id: "preview-terminal",
    name: "Terminal",
    path: "/System/Applications/Utilities/Terminal.app",
    bundleId: "com.apple.Terminal",
  },
];

export const launcherActions = [
  {
    id: "google",
    name: "Google 搜索",
    subtitle: "无应用匹配时，用默认浏览器搜索",
    icon: Search,
    color: "blue",
  },
];
