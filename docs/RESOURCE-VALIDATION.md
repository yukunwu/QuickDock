# 内存回收与资源验证 · 2026-11-04

## 结论与范围

旧版清空并退出工具后 JavaScript 堆能回落，短测未证明泄漏；但系统 WebKit 在连续大文本操作后仍可长期保留解析和排版分配的内存。只解除 React 引用、只看 Chrome JS heap，不足以证明 macOS physical footprint 已回落。

本次完成后台计算、受限结果预览、隐藏卸载和闲置页面回收。系统 WebKit 无头实测确认：回收后 physical footprint 明显回落，5 MiB 输入仍可完整恢复。该测试使用生产前端构建、系统 WKWebView、自定义 URL scheme 和一次性网站存储，应用操作使用预览 bridge。**不是整个 Wails QuickDock 进程的真实桌面压力测试**；无窗口显示、无真实全局按键和原生剪贴板。屏幕仍锁定，未绕过锁屏。

## 实现

- 输入超过 65,536 个 UTF-16 code units 时，150ms 防抖后在独立 Worker 中计算。任务完成、报错、超时（30秒）、输入变化或工具卸载时结束 Worker，释放其解析堆。小输入使用 memo，避免焦点／快照更新引发重复计算。
- 结果 DOM 最多展示前 65,536 个 code units，界面明确提示，复制仍使用完整结果。大整数和 Unicode 转换不截断。
- 隐藏时立即卸载工具编辑器、结果和 Worker；草稿及选项继续保留。新增“清空输入”，清空后不会在返回或回收后复活旧数据。
- 用过大输入后，连续隐藏 30 秒触发页面回收。Go 定时器不依赖隐藏 WebKit 的 JS 定时器；再次显示时取消计时。仅处理重负载会话，普通启动器不重复重载。
- 回收前临时通过当前 WebView 的 history state 保存草稿和导航状态，重载时消费并清除。没有向配置文件或 localStorage 写入工具输入；退出应用不恢复这些草稿。
- 配额／序列化失败时放弃回收，保留现有输入。设置页和网址编辑页不自动重载，以免丢失未保存表单。内部重载不触发原生窗口自动显示；启动后向原生核对实际可见性。
- Base64 编码按块处理字节；Unicode／行数／UTF-8 统计用遍历，避免额外展开为整份字符数组和行数组。

回收不是强制周期 GC。它减少可达对象，并在重负载结束后释放整个旧页面。WebKit 最终交还内存有延迟，实际不会保证回到初启数值。再次打开被回收的大文本工具需要重新计算，是内存与恢复速度的明确取舍。

## Chrome 前后对照

独立 Chrome 无头上下文，5 次 1 MiB JSON、一次 5 MiB JSON、隐藏与清空。`retainedHeapMiB` 在显式诊断 GC 后取数；生产代码不调用强制 GC。它不含全部原生内存和 Worker 执行峰值，不能作为应用总内存。

| 测量 | 原版 | Worker／预览／隐藏卸载后 |
| --- | ---: | ---: |
| 5 MiB JSON 操作到结果可见 | 1120ms | 392ms |
| 该结果完成后的 JS 堆 | 30.96 MiB | 17.73 MiB |
| 隐藏后的 JS 堆 | 30.96 MiB | 11.63 MiB |
| 清空并返回后的 JS 堆 | 11.70 MiB | 11.70 MiB |

这是单轮本机对照，不是通用性能保证。对照原始数据：`validation/resources-before.json`、`validation/resources-after.json`。脚本：`frontend/e2e/resource-benchmark.mjs`。

## 系统 WebKit 实测

`footprint` 只汇总独立测试宿主及 `launchctl print pid/<宿主PID>` 归属的 WebContent、GPU、Networking，不计其他应用 WebKit。无强制 GC。测试宿主为保证无头脚本继续执行，显式使用 `inactiveSchedulingPolicy = .none`；正式应用保留系统默认调度策略。因此不把它当作原生后台能耗或实际唤起延迟的测量。

初步对照中，仅做 Worker／预览／卸载时，5轮5 MiB操作后约427MB，清空空闲20秒仍约425MB；一次页面重载后5秒约115MB。接入完整草稿恢复后，一轮约424MB降至119MB，恢复5 MiB输入并重新计算通过；清空再回收后约141MB。原始记录分别为 `validation/webkit-resources.json`、`validation/webkit-resources-reload.json`、`validation/webkit-resources-after.json`。

最终版本重复5次5 MiB工作负载，并执行5轮页面回收：

| 阶段 | 宿主＋关联 WebKit physical footprint |
| --- | ---: |
| 初始 | 73 MB |
| 第一轮回收前 | 385 MB |
| 第1～5轮回收后各空闲5秒 | 66 / 65 / 65 / 65 / 65 MB |
| 恢复草稿并重新计算的阶段采样 | 81～82 MB |

同轮关联进程合计 `ps %CPU` 最高采样161.1%（约1.61个逻辑核；不是整个机器161%），空闲样本通常0～0.2%；回收、恢复和测量边界附近有短时活动。5 MiB首次连续处理到结果完成约1.72～2.08秒，包含无头脚本的轮询，不能当成真实显示延迟。历史峰值字段不代表当前占用。多轮数据表明本次工作负载回收后没有逐轮增加，不能证明所有输入、长时间运行均无泄漏。

最终多轮回收记录为 `validation/webkit-resources-final.json`，包含阶段 footprint、宿主／关联进程 PID、约250ms一轮的 `ps` CPU/RSS样本、操作耗时。阶段采样可能错过瞬时峰值；不得把各进程各自历史峰值相加称为同时峰值。

## 回归与复现

- 26 项 Vitest：含跨块 Base64 和 CRLF／代理字符／UTF-8统计。
- 8 个 Playwright 场景：原十工具和设置回归；大结果预览受限但复制全文、Worker退出、取消后不出现旧结果、10次隐藏恢复、闲置重载不显示且草稿无损、清空后不复活、配额失败保留输入。
- Go race tests、生产前端构建、`.app` 构建与签名完整性检查。
- 真实快捷键、原生30秒隐藏计时与重载后唤起的端到端联合验收仍需解锁桌面；无头测试仅直接发出对应生命周期事件。

```sh
pnpm --dir frontend dev
# 另一个终端，Chrome JS heap诊断
cd frontend
node e2e/resource-benchmark.mjs ../docs/validation/resources-repeat.json
```

```sh
# 根目录：不控制桌面、不操作正在运行的 QuickDock
pnpm --dir frontend build
swiftc scripts/webkit-resource.swift -o /tmp/quickdock-webkit-probe
python3 scripts/measure-webkit.py docs/validation/webkit-resources-repeat.json
```

应用已在运行时，更新磁盘上的 `.app` 不会替换进程内已加载的旧代码；须退出后重开新版本。重启会结束旧会话的临时工具草稿。
