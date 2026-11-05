QuickDock v0.1.4 更新界面、语言设置和键盘操作，保留已有设置、计算历史与独立工具草稿。

- 新增简体中文、日本語、English、繁體中文、Español，默认跟随系统；切换语言保留当前工具输入，原生菜单与独立窗口标题同步更新。
- 优化浅色雾白／深色石墨界面，统一字体、间距、工具图标和键帽提示。macOS Dock 与侧栏使用原生模糊和透明背景，编辑区保持实底。
- 应用及托盘图标改为透明背景闪电。
- 全局唤起快捷键支持选择修饰键，Space 固定；保留冲突检测与保存失败回滚。
- 统一 Esc：主窗口工具返回紧凑 Dock，Dock 再按 Esc 隐藏；独立工具先保存再关闭，保存失败保留窗口。内嵌 Google 翻译页面也支持 Esc。
- 移除唤起时搜索框下方整行蓝色高亮，恢复细灰分隔线。
- 单个无法读取的应用包静默跳过。

安装包由 GitHub Actions 自动编译：macOS arm64/x64 提供 DMG 和 ZIP；Windows arm64/x64 提供 ZIP；Linux arm64/x64 提供 DEB 与 RPM。自动更新在 macOS/Windows 使用 ZIP，Linux 使用系统包管理器。

验证：33 个前端逻辑测试、25 个浏览器场景、macOS Go race、原生独立窗口保存与重启回归通过；原生红蓝背景合成验证透明度，双屏快捷键与单实例回归通过。各平台 CI 还将执行原生构建和安装/启动检查。

macOS 未经 Developer ID 签名或公证；Windows 未做代码签名。透明材质目前用于 macOS，Windows/Linux 使用实底界面。macOS WebView 透明开关有受异常保护的兼容回退。

本轮 UI 参考 [unslop](https://github.com/heydamir/unslop)，作者 Damir Sokolovsky（[@heydamir](https://x.com/heydamir)），CC BY 4.0；审查和变更记录见 `docs/unslop/README.md`。
