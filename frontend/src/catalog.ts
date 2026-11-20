import { t } from "./i18n";
import { defaultShortcut } from "./platform";
import {
  Calculator,
  QrCode,
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
  Coins,
  ClipboardList,
  Regex,
  KeyRound,
  Palette,
  Hexagon,
  GitCompare,
  CalendarClock,
  FileSearch,
  Lock,
  Moon,
  Power,
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
  | "translate"
  | "qrcode"
  | "currency"
  | "clipboard"
  | "regex"
  | "jwt"
  | "color"
  | "base"
  | "diff"
  | "cron";
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
    id: "qrcode",
    get name() {
      return t("二维码生成器");
    },
    get subtitle() {
      return t("将文字或网址生成二维码");
    },
    keywords: "qr qrcode erweima ewm 二维码 二維碼 QRコード código",
    category: "日常",
    icon: QrCode,
    color: "blue",
    version: "1.0.0",
  },
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
    id: "currency",
    get name() {
      return t("汇率换算");
    },
    get subtitle() {
      return t("欧洲央行每日参考汇率，支持多币种对照");
    },
    keywords:
      "currency exchange rate fx huilv hl huobi 汇率 货币 usd cny rmb jpy eur",
    category: "日常",
    icon: Coins,
    color: "yellow",
    version: "1.0.0",
  },
  {
    id: "clipboard",
    get name() {
      return t("剪贴板历史");
    },
    get subtitle() {
      return t("复制过的文本，搜索后再次粘贴");
    },
    keywords:
      "clipboard paste history jianqieban jqb cb fuzhi niantie 剪贴板 复制 粘贴",
    category: "日常",
    icon: ClipboardList,
    color: "yellow",
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
      return t("时间与时区");
    },
    get subtitle() {
      return t("时间戳、日期互转与世界时钟");
    },
    keywords:
      "timestamp time timezone zone clock shijianchuo sjc shiqu sq shijian 时间戳 时区 世界时钟",
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
      return t("批量生成 UUID v4／v7，多种格式");
    },
    keywords: "uuid guid id v4 v7 suiji",
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
    id: "regex",
    get name() {
      return t("正则测试");
    },
    get subtitle() {
      return t("匹配高亮、分组与替换预览");
    },
    keywords: "regex regexp regular expression zhengze zz 正则 匹配",
    category: "开发",
    icon: Regex,
    color: "pink",
    version: "1.0.0",
  },
  {
    id: "jwt",
    get name() {
      return t("JWT 解码");
    },
    get subtitle() {
      return t("查看头部、载荷与有效期");
    },
    keywords: "jwt token bearer jiema jm 令牌 解码",
    category: "开发",
    icon: KeyRound,
    color: "yellow",
    version: "1.0.0",
  },
  {
    id: "color",
    get name() {
      return t("颜色转换");
    },
    get subtitle() {
      return t("HEX、RGB、HSL、OKLCH 与对比度");
    },
    keywords: "color colour hex rgb hsl oklch yanse ys 颜色 取色",
    category: "开发",
    icon: Palette,
    color: "pink",
    version: "1.0.0",
  },
  {
    id: "base",
    get name() {
      return t("进制转换");
    },
    get subtitle() {
      return t("二、八、十、十六进制互转");
    },
    keywords: "base radix hex binary octal jinzhi jz 进制 二进制 十六进制",
    category: "开发",
    icon: Hexagon,
    color: "cyan",
    version: "1.0.0",
  },
  {
    id: "diff",
    get name() {
      return t("文本对比");
    },
    get subtitle() {
      return t("逐行比较两段文本的差异");
    },
    keywords: "diff compare duibi db 对比 差异 比较",
    category: "开发",
    icon: GitCompare,
    color: "green",
    version: "1.0.0",
  },
  {
    id: "cron",
    get name() {
      return t("Cron 表达式");
    },
    get subtitle() {
      return t("解析字段并预览下次运行时间");
    },
    keywords: "cron crontab schedule dingshi ds 定时 计划任务",
    category: "开发",
    icon: CalendarClock,
    color: "blue",
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
  aliases?: string[];
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
  clipboardHistory?: boolean;
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
    | "app"
    | "tool"
    | "bookmark"
    | "calculation"
    | "time"
    | "websearch"
    | "translation"
    | "file"
    | "command";
  icon: LucideIcon;
  color: string;
  image?: string;
  value?: string;
  // Selecting the row fills the search box instead, e.g. a keyword's "gh ".
  complete?: string;
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
  {
    id: "system",
    get name() {
      return t("系统命令");
    },
    get subtitle() {
      return t("锁定屏幕与睡眠");
    },
    icon: Power,
    color: "neutral",
  },
  {
    id: "files",
    get name() {
      return t("文件搜索");
    },
    get subtitle() {
      return t("在 Dock 输入 f 加空格，搜索主目录中的文件");
    },
    icon: FileSearch,
    color: "neutral",
  },
];

// Session commands run immediately from the Dock; "system" disables them.
export const systemCommands = [
  {
    id: "lock",
    get name() {
      return t("锁定屏幕");
    },
    get subtitle() {
      return t("立即锁屏，需要密码解锁");
    },
    keywords: "lock screen lockscreen suoping sp suoding 锁屏 锁定",
    icon: Lock,
  },
  {
    id: "sleep",
    get name() {
      return t("睡眠");
    },
    get subtitle() {
      return t("让电脑立即进入睡眠");
    },
    keywords: "sleep suspend shuimian sm daiji 睡眠 待机 休眠",
    icon: Moon,
  },
];
