# 独立翻译与持久化工具窗口 · 2026-11-05

实现与操作见 [UI设计](UI-DESIGN.md#2026-11-05-独立翻译与工具窗口)。本次添加Wails原生窗口，浏览器弹窗仅用于可重复的交互验证。

## 已验证

- 30项Vitest、16个Playwright场景通过（新增2个独立窗口场景；工具库加入第二个按钮后修正旧测试选择器，并重跑3个原应用场景通过）。
- 独立翻译页可空白打开，中英文语言提示、显式发送、当前译文转移、跨重载恢复不联网、离开Dock仍可见。浏览器截图`12-detached-translation.png`已目视检查。
- 稿纸弹出携带当前内容，两页输入独立；重复弹出复用现有页面，不覆盖其中编辑；保存后重载恢复，写入失败时关闭动作被取消，保留原输入。
- Go race通过。新增独立窗口存储测试覆盖两种工具隔离、重建Service恢复、未知ID／超8MiB／未来版本拒绝、文件0600、损坏不覆盖、关闭后保留输入与尺寸但取消自动恢复标记。
- `scripts/test-native-tool-windows.sh` 使用Go overlay替换入口，编译相同生产Service、bindings和前端的隔离原生进程；使用临时数据目录，无用户配置、全局快捷键或生产单实例。原生Wails／系统WebKit实测两窗口并存、隐藏Dock不隐藏工具、重复打开复用、真实绑定自动保存、调用原生Window.Close触发关闭hook并保存最后输入、1020×720尺寸保存。正常AppKit退出后从文件核对最后输入和open标记，第二个进程恢复未关闭的翻译窗口且可继续编辑。翻译HTTP客户端设为计数桩，恢复及输入阶段0次请求。测试没有调用外部翻译，也没有操作当前用户应用会话。
- `scripts/build-macos.sh` 重新生成bindings、前端与arm64 .app，ad-hoc签名完整性及ZIP检查通过。

原生测试通过DOM事件输入与窗口API验证服务、生命周期和落盘；不把它表述为真实中文输入法、鼠标拖动或手动点击系统红色关闭钮的验收。已有真实翻译网络复测见 [联网验证](ONLINE-NOTEBOOK-VALIDATION.md)。强制结束进程不经过正常退出保存流程，自动保存间隔250ms；保存成功状态可见。

## 复现

```sh
pnpm --dir frontend test
pnpm --dir frontend test:e2e
MACOSX_DEPLOYMENT_TARGET=13.0 CGO_CFLAGS='-mmacosx-version-min=13.0' CGO_LDFLAGS='-mmacosx-version-min=13.0 -Wl,-no_warn_duplicate_libraries' go test -race ./...
./scripts/build-macos.sh
./scripts/test-native-tool-windows.sh
```

原生探针须先构建前端生产资源。所有测试数据由临时目录隔离并在退出后清理。
