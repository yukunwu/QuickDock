# Google网页翻译 · 2026-11-05

用户要求直接嵌入Google翻译网页，替换公共API翻译。当前Dock翻译和独立翻译均使用原生WKWebView直接加载https://translate.google.com/，页面自身负责输入／译文／网站验证，不用iframe，不抓取网页译文冒充API。QuickDock翻译入口不再调用MyMemory或Google无密钥接口。旧API解析代码暂保留为内部兼容与回归测试，不在当前UI使用。

## 页面与会话

QuickDock保留返回、独立窗口、重新加载、默认浏览器打开；页面区域通过实际DOM矩形定位，随窗口缩放调整，独立于本地Wails视图。Google页面WKUserContentController仅含原文／语言草稿通道，不注入Wails脚本或绑定。导航限制Google翻译／账号／同意／www域，其他用户点击链接由默认浏览器打开。子框架正常允许，未绕过Google网页安全策略或网站验证。

Dock首次点击翻译携带当前输入；后续修改顶部文字须点击“翻译输入”或Enter才提交，不自动逐键发送。独立页恢复不以本地旧API草稿覆盖网页保存内容。网页输入及语言通过受限Google来源消息保存到tool-windows/google-page.json，原子写与0600权限；无累积翻译历史，不保存抓取后的译文。网页的原文恢复依赖Google当前textarea／URL结构，后续站点改版可能需适配。cookies由系统WebKit数据存储管理。

Google网页仍可能有网络失败／人机验证或登录限制，未保证可消除所有限流；故有重新加载和浏览器继续入口。网页登录未在本轮操作。页面加载失败显示网络提示。关闭独立窗口停止加载并移除原生视图和消息通道；常驻时额外WebView会增加资源，未承诺与旧API模式相同内存。

## 验证

- 30项Vitest、15个当前Playwright场景通过；旧API翻译UI测试已由网页模式入口／独立窗口／0公共API调用断言替换，其他稿纸、设置、大文本及内存回收回归保留。
- Go race通过；旧MyMemory错误处理同时拆分额度、空译文、状态拒绝与格式问题，允许字符串状态且跳过损坏候选，不再混报为同一“额度或未返回”错误。
- scripts/test-google-web.sh编译实际原生实现的隔离探针，联网打开Google网页实测我爱你→I love you，找到页面自己的textarea，确认window._wails不存在；Google来源消息保存原文，卸载／重建恢复通过。数据目录临时隔离，不触碰用户工具内容。
- scripts/test-native-tool-windows.sh在独立临时原生进程回归普通工具两窗口、Dock隐藏隔离、重复复用、关闭flush、几何保存、正常退出及第二进程恢复。网页翻译单独由上一探针验证；不将普通工具的React草稿回归当作Google网页输入法验收。
- bindings、TypeScript／Vite、macOS arm64.app、ad-hoc签名完整性与ZIP检查通过。

本次未在正在运行的旧QuickDock里自动重启，保留用户内容。更新需正常退出并打开bin/QuickDock.app。
