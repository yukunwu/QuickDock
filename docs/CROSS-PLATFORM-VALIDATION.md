# 三平台交付与验证（2026-11-05）

本轮在现有 QuickDock 上扩展平台层，保留十一类工具、计算稿纸历史、Dock 搜索与翻译、独立窗口和草稿保存。x64 指 amd64/x86_64，arm 指 64 位 arm64/aarch64；不包含 32 位 ARM/x86。

## 产物与安装

所有交付包在 `bin/releases/`，哈希见同目录 `SHA256SUMS.txt`。

| 系统 | arm64 | x64 | 运行条件 |
| --- | --- | --- | --- |
| macOS | `QuickDock-0.1.0-macos-arm64.zip` | `QuickDock-0.1.0-macos-x64.zip` | macOS 13+；解压 .app 打开，ad-hoc 签名，尚无 Developer ID／公证 |
| Windows | `QuickDock-0.1.0-windows-arm64.zip` | `QuickDock-0.1.0-windows-x64.zip` | Windows 10/11，Microsoft Edge WebView2 Evergreen Runtime；解压运行 QuickDock.exe |
| Debian／Ubuntu | `QuickDock-0.1.0-linux-arm64.deb` | `QuickDock-0.1.0-linux-x64.deb` | GTK3、WebKitGTK 4.1、GIO、xdg-utils、DBus、X11 库 |
| Fedora／Red Hat 系 | `QuickDock-0.1.0-linux-arm64.rpm` | `QuickDock-0.1.0-linux-x64.rpm` | 同上，仓库须提供 gtk3 和 webkit2gtk4.1；不是所有历史 RHEL 版本都有该依赖 |

```sh
# Debian 系，按机器架构选择包
sudo apt install ./QuickDock-0.1.0-linux-x64.deb
# RPM 系
sudo dnf install ./QuickDock-0.1.0-linux-x64.rpm
quickdock
```

Debian 12、Ubuntu 24.04、Fedora 43 已实际安装。Ubuntu 22.04、其他 Fedora／RHEL／Rocky／Alma 版本没有逐个测试，先确认官方仓库的 WebKitGTK 4.1 依赖可满足。Windows 当前交付便携 ZIP，不是 MSI／安装向导，也未做代码签名。构建没有把系统 WebView 打包进去。

## 平台实现

- macOS 保留 AppKit 元数据、图标与 NSWorkspace 启动。
- Windows 通过系统 PowerShell 读取开始菜单／桌面 `.lnk` 和 Get-StartApps，ShellExecuteW 打开；指令脚本固定，用户输入不拼进 shell；鼠标显示器／工作区通过 Win32 定位。
- Linux 按 XDG 优先级读取本地化 desktop entry，处理 Hidden／NoDisplay／OnlyShowIn／NotShowIn／TryExec；用户同名 entry 遮蔽系统入口，包含 Flatpak／Snap 导出。GIO 处理 Exec 字段和 DBus 激活，HTTP(S) 默认浏览器由 xdg-open 打开。
- Windows 翻译使用独立 WebView2，Linux 使用独立 WebKitGTK 4.1。远程页面没有 Wails 绑定，草稿消息限制来源 Google、大小及语言。Linux 网页仅占正文区域，避免遮住本地返回栏；销毁时断开信号、销毁 overlay/webview 并释放 manager。显示器库只加载一次。
- macOS 默认 Option+Space，Windows／Linux 默认 Ctrl+Alt+Space，避免常见 Alt+Space 系统菜单冲突。旧配置快捷键保留，不自动覆盖。
- Windows／Linux 页面快捷键显示 Ctrl。各平台 `os.UserConfigDir()` 保存配置：macOS Application Support、Windows AppData/Roaming、Linux XDG_CONFIG_HOME（默认 ~/.config）。

## 实测矩阵

| 环境 | 实测结果 | 边界 |
| --- | --- | --- |
| 本机 macOS arm64 | 前端 build、Go race、原生 .app 构建签名通过 | 本轮平台适配没有重复全套 macOS 手动验收；前序原生 Google 页面与窗口恢复有记录 |
| macOS x64 | Intel Mach-O 编译、打包及签名校验通过 | 无 Intel 实机运行验收 |
| Windows x64／arm64 | 两个 GUI PE 可执行文件构建与 ZIP 校验通过 | 无 Windows 实机；不能等同窗口、COM 释放或应用扫描实测 |
| pc-110 Ubuntu 24.04.5 x64 | apt 安装依赖及 .deb；普通用户、默认 WebKit 沙箱；Xvfb/Openbox 上真实窗口、45 应用索引、快捷键显隐、第二实例 --toggle 通过 | 使用隔离 X11 桌面，不向用户当前桌面注入按键 |
| Debian 12 arm64 | .deb 安装、真实 GTK/WebKit 窗口、3 应用索引、快捷键显隐、--toggle 通过 | OrbStack 容器内 Xvfb，root 测试显式禁用 WebKit 沙箱；产品不禁用 |
| Fedora 43 arm64 | dnf 安装 RPM 和依赖、真实窗口、1 应用索引、快捷键显隐、--toggle 通过 | 同上；不是 RHEL 实机验收；无托盘 watcher 的测试桌面会记录 systray 错误 |

Ubuntu 原生独立窗口探针复用生产 Service、bindings 和前端，验证两个工具同时打开、Dock 隐藏不影响工具、重复打开复用、自动保存、关闭 flush、尺寸保存、正常退出与第二进程草稿恢复。Linux 翻译探针验证真实额外 WebKit 创建、非 Google 页面消息拒绝、8 次 attach/submit/detach、草稿保存、物理点击本地返回栏并完成关闭。Google 连网在 pc-110 直连超时，所以该机器未通过实际译文联网验收；Mac 前序真实网页“我爱你→I love you”验证不能代替 Linux 网络验证。

Go core 测试在 Mac／Ubuntu x64／Debian arm64 通过；新增 Linux 启动参数测试在 Ubuntu／Debian／Fedora 通过，包含带空格／分号的 desktop 路径原样传参、无效路径拒绝及 URL 无 shell 展开。前端 30 逻辑与 15 浏览器场景通过。六种二进制的 file 架构识别、八包 zip/包管理器检查和 SHA256 校验通过。

## Wayland 的明确边界

pc-110 日常桌面是 GNOME Wayland，检查发现 **没有 org.freedesktop.portal.GlobalShortcuts 接口**。Wails 在支持该 Portal 的桌面可申请全局快捷键，最终按键由系统授权；不支持时在系统“键盘→自定义快捷键”添加命令：

```sh
quickdock --toggle
```

第一次执行启动应用，以后执行经单实例 IPC 显示／隐藏已有窗口，输入不丢失。该 IPC 路径已在隔离 X11 验证；没有擅自改 pc-110 用户系统快捷键。

Wayland 不允许普通客户端读取全局鼠标位置并随意移动顶层窗口，因此“鼠标在哪个屏幕就在哪唤起”在 macOS／Windows／Linux X11 实现，原生 Wayland 由 compositor 安排位置，不能保证一致。需要严格跟随鼠标时使用 Xorg 会话。

## 复现与证据

- `scripts/build-platforms.sh`：生成 bindings／前端，六目标编译；Linux 用 production,purego,gtk3。
- `scripts/package-platforms.py`：nfpm v2.45.2 产出 DEB/RPM；Windows ZIP；macOS .app ZIP 和签名；生成总哈希。
- `scripts/test-linux-desktop.sh /usr/bin/quickdock`：隔离 X11，等待 WebKit runtime ready 后才发按键；仅容器 root 设 QUICKDOCK_TEST_UNSANDBOXED=1。
- `scripts/test-linux-google.sh`：Go overlay 加入测试观测方法，生产包不含探针。
- `.github/workflows/build.yml`：配置构建／Linux 安装／Windows 原生 runner 测试；未上传仓库，尚无本轮云 CI 运行结果。
- `docs/validation/cross-platform/`：三 Linux 平台日志与独立窗口／翻译探针结果。

pc-110 已安装到 /usr/bin/quickdock，未终止用户桌面上现有 QuickDock 进程，因此已运行的旧实例需要保存输入后正常退出重开才会使用最终版本。隔离测试只清理自己的进程和临时目录。
