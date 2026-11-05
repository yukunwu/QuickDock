# QuickDock 0.1.0 验证记录

> 最新：按用户要求切换原生Google网页翻译，30逻辑／15当前浏览器场景、Go race、真实网页翻译及恢复探针通过，见 [网页翻译验证](GOOGLE-WEB-VALIDATION.md)。

> 2026-11-05：MyMemory错误语料已复现并加目标文字检查／精确候选回退／旧译文失效，30逻辑、17浏览器场景、Go race及原生短句网络通过，见 [翻译修复](ONLINE-NOTEBOOK-VALIDATION.md#2026-11-05-mymemory错误语料修复)。

> 2026-11-05：独立翻译、原生工具窗口与持久化已完成，30项逻辑／16个浏览器场景、Go race及原生两进程恢复验证见 [独立窗口验证](DETACHED-WINDOWS-VALIDATION.md)。

日期：2026-11-04。平台：本机 macOS / arm64，Go 1.27.1、Wails CLI 与 module 均为 v3.1.0（同日 GitHub latest 再核对），Node 26.10.0、pnpm 10.32.0。

> 追加：用户要求验证重负载并处理内存回收。最新26项逻辑、8个浏览器场景及系统WebKit资源复测见 [资源验证](RESOURCE-VALIDATION.md)；下文原始交付的性能数字保留其当时口径。

> 最新追加：Dock无应用匹配时的搜索／翻译快捷入口，以及计算稿纸历史已实现。含2026-11-05光标／翻译错误修正的30项逻辑、14个浏览器场景、Go race与真实翻译请求结果见 [新增功能验证](ONLINE-NOTEBOOK-VALIDATION.md)。

## 自动化通过

| 检查 | 结果与覆盖 |
| --- | --- |
| 前端类型与生产构建 | `pnpm --dir frontend build` 通过；空 CSS import 已删除；拼音词库独立 chunk、工具和设置按需加载，无原型的大包警告 |
| Vitest | 24 项通过：算式／除零／非法表达式、JSON 大整数、严格 Base64／UTF-8、URL 组件、四种 hash 已知向量、UUID、日期／时区／单位、七类单位、Unicode 文本、拼音／首字母、工具启停与排序 |
| Go race tests | 7 项通过：配置原子保存、损坏备份恢复、未来版本保护、URL 校验、扫描不进入 `.app`／去重、快捷键冲突保留旧绑定与恢复、写入失败回滚、快照隔离与使用记录持久化（部分测试覆盖多个场景） |
| Playwright / 本机 Chrome | 4 个场景通过：启动器键盘与输入法组合保护、十类真实工具、输入会话保留、网址新增／修改／别名搜索、主题／启停重载保留、独占工具页不渲染侧栏／导航、搜索性能 |
| macOS bundle | arm64 Mach-O，Go frontend assets 内嵌；Info.plist、图标、ad-hoc 签名、`codesign --verify --deep --strict` 通过 |

测试和构建命令见 README。浏览器测试使用独立上下文及预览 localStorage，不写原生配置。所有 Go 文件都经 gofmt；前端经 Prettier 格式化。

## 实际原生证据

- `.app` 实际启动成功，真实 Wails bridge 返回本机应用，截图 `screenshots/07-native-launcher.png`。
- 本机扫描得到 116 个应用，工具加上后启动面板共 126 项；图标、Bundle ID 与名称来自 AppKit。已显示“访达”“终端”“系统设置”等中文名称。一个本机失效 Qt 应用包读取失败会在设置中报告，不阻塞其余索引。
- 原生打开“活动监视器”后成功写入使用记录；不是浏览器 mock 的模拟启动。
- 实际进入 JSON 独占工作区，960×660；没有 QuickDock 的侧栏、顶部导航和底栏。原生结果保留 `9007199254740993`。
- 真实双屏脚本通过：1470×956 / 2× Retina 主屏，以及位于主屏上方的 1920×1080 / 1× 外屏。移动鼠标后唤起分别落在正确屏幕的可用区域内；同一个 Option+Space 再次按下隐藏。
- 同次脚本验证了第二次执行退出，并唤起原实例。脚本为 `scripts/native-smoke.swift`。
- 用户在测试过程保存的浅色主题及使用记录在重启后继续存在。

## 性能与资源口径

- 150 个模拟应用索引，预热后 200 次搜索：p95 约 **0.1ms**，最大约 **0.2ms**。测量的是搜索函数，包括汉字、拼音、首字母、工具和计算查询；不代表整个 UI 从输入到绘制的时延。p50 低于浏览器计时分辨率。
- 双屏脚本测得全局按键发出后，CGWindow 首次报告可见约 **26–35ms**。这包括原生显示调用，但不保证前端内容已完成稳定绘制；不把它作为完整热唤起 200ms 的严格验收。
- 空闲状态 `footprint`：主进程约 47MB、WebContent 约 39MB、GPU 约 13MB、Networking 约 5.8MB，工具报告总计约 **105MB**。原始输出见 `validation/footprint.txt`。该采样在锁屏后的空闲状态，不是重型工具工作的峰值。
- 子进程归属通过 `launchctl print pid/<QuickDock PID>` 中的 WebKit 服务实例 PID 核对，GPU／Networking 还以专属 `com.quickdock.desktop` 缓存路径交叉核对；未计入其他应用的 WebKit 进程。
- 本地 `.app` 约 **9.3MiB**。此值不含系统共享的 WebKit 框架，也不含工程的 node_modules／Go 编译缓存。

## 尚未完成的原生人工验收

最后一轮桌面验收被 **macOS 锁屏** 阻断。已核实 `CGSSessionScreenIsLocked=Yes`，安全输入由 `loginwindow` 占用，故停止模拟输入和可访问性操作，没有尝试绕过锁屏。锁屏时的快捷键脚本失败／AX 读取被拒不作为应用失败结论；smoke 脚本现在会提前识别锁屏并返回 SKIP。

仍需在解锁后的桌面完成：

1. 真实中文输入法选词／确认键，不仅是浏览器的 composition 事件模拟。
2. 原生复制结果后读回剪贴板、工具编辑后的反复隐藏／唤起与失焦保留。
3. 菜单栏打开／刷新／退出，以及系统关闭窗口事件的完整人工回归。
4. 与另一个真实进程争抢同一快捷键后的恢复。Go 测试已验证冲突事务与持久化回滚，但未完成 OS 争抢的最终交互测试。
5. 再打开若干本机应用和默认浏览器网址，验证失效路径提示；当前原生启动证据为活动监视器。
6. 最新构建的连续多次唤起、全屏 Space 场景与端到端稳定绘制时延。

这些是验收边界，不能描述成全部原生行为已经人工验收。代码、构建、十类工具与本地 `.app` 已交付，未做 Developer ID 签名、公证或发布。

## 2026-11-05 多语言与本机安装

- 33 个前端逻辑测试、macOS Go race 全量测试通过；22 个 Playwright 场景通过，含五语设置保存/重载、本地化工具错误、切换语言保留稿纸、固定 Space 修饰键选择和内存回收回归。
- 隔离原生窗口探针通过：双窗口、自动保存、关闭最后输入 flush、正常退出/重启恢复；新增英文菜单及既有工具窗口语言切换验证。探针使用临时数据，不修改用户草稿。
- PNG alpha 像素检查通过，512图含239605个完全透明像素，21621个不透明像素；ICNS与.app签名验证通过。
- 960×660 中文/西班牙语布局截图见 `screenshots/14-local-settings-zh.png`、`15-local-settings-es.png`（浏览器预览，非原生截图）；西班牙语导航允许换行。
- 本机从 Downloads 旧进程正常退出，安装至 `/Applications/QuickDock.app` 后启动，核对运行路径与构建主程序SHA256一致。保留用户设置、历史和独立草稿。版本沿用0.1.3，当前新增功能只在本机工作区/安装版，未打新tag或发布Release。
- 安装后的实体快捷键 smoke 遇桌面锁屏，按脚本返回SKIP；不能称最后构建快捷键已人工验收。原生窗口探针在此之前通过。
- 安装首轮空闲锁屏采样含专属WebKit主/GPU/Networking，physical footprint总计约119MB，主进程CPU瞬时0.0%；非操作峰值。应用磁盘约11MiB。

### Esc行为本地修正

新增3个浏览器场景通过（其余22个场景亦通过）：工具库打开工具后直接Esc回Dock/再Esc隐藏、稿纸保留、翻译页面事件返回、独立窗口Esc保存关闭/保存失败保留、输入法与repeat保护。原生窗口探针以Esc替代关闭按钮验证最后输入flush；真实Google网页探针验证独立消息回传以及输入法/repeat保护。Go race全量、Windows/Linux arm64+x64编译通过。

已更新 `/Applications/QuickDock.app`，验签通过，真实定向键盘事件验证Esc隐藏Dock、重新唤起后Esc再次隐藏通过。最后重新唤起保留供用户查看。本轮未发布标签/Release。


### Unslop UI与材质验证

33前端逻辑、25浏览器全量通过；Go race和原生独立窗口保存/重启探针通过。首轮测试因Vite热更造成模块观测与页面重载干扰，停止编辑后完整重跑25全部通过，Esc测试拦截支持Vite查询参数。浅深/西语截图目视检查与导航溢出检测通过。Wails默认Translucent出现空白已由原生截图确证，改Transparent WebView+runtime ready后AppKit Sidebar视觉材质，原生隔离Dock显示正常。安装文件主程序与构建SHA256一致、ad-hoc验签通过。细节见unslop/README.md。

最终安装版按用户当前Cmd+Space进行双屏原生回归通过：首次CGWindow可见34.6/50.3ms、同快捷键隐藏、第二实例退出并唤起原实例；非完整UI绘制延迟。测试保留用户当前快捷键设置。

### 透明背景与唤起分隔线修正

用户反馈透明度不可见后追查源码：Wails3.1默认public-API构建的WKWebView透明操作是no-op，因此此前材质截图只能证明内容显示，不能证明背景穿透。现于主窗口runtime-ready后递归定位WKWebView，受异常保护关闭drawsBackground，并清除underPageBackgroundColor；采用HUDWindow系统模糊材质。CSS底色遮罩改为浅Dock38%/深32%、浅侧栏42%/深36%，编辑区实底。

真实AppKit+WKWebView合成验证：同一前窗在红/蓝后窗之前，屏幕区域采样RGB分别(.565,.243,.181)与(.171,.268,.564)，确认背景色实际透入。仅screencapture -l的独立窗口截图不含behind-window实际合成，应以屏幕区域采样验证；只采固定测试色，不将其他桌面内容写入仓库。

搜索自动聚焦引出的2px蓝色横线已删除，保留1px中性边框；键盘控件焦点环保留。8项Esc/稿纸/历史回归与Go race通过，最终本机安装/验签/主程序哈希一致；未发布。
