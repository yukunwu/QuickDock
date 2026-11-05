# QuickDock UI · Unslop 审查与实现

本次按 [unslop](https://github.com/heydamir/unslop) 工作流优化现有UI，作者 Damir Sokolovsky（[@heydamir](https://x.com/heydamir)），CC BY 4.0。此文档保留方法署名；未复制第三方图片或示例代码。

方向：键盘优先的macOS快捷工具，安静、利落、准确。保留780×340 Dock、960×660工具独占窗口、真实应用图标、透明金色闪电与Esc语义。系统字体和键帽作为识别细节。

审查发现：彩色工具图标方块、宣传式副标题、重复品牌说明、低于11px的说明、杂散间距、卡片悬浮位移、浅色对比不足。沿现有macOS品牌进行调整，不增加功能或营销视觉。

九轮调整：
1. 间距：4px步进，24px页边距、16px卡片内距、12px网格；导航36px起，长语言允许换行。
2. 配色：雾白/石墨中性底、三层文字；焦点/主要操作/计算结果用蓝，金色仅闪电。
3. 图标：Lucide线宽1.5，去工具彩色方块，保留系统应用真实图标。
4. 文案：工具说明写实际操作，去掉口号和重复品牌副标题；新增文本五语齐全。
5. 字体：系统sans、编辑mono；工具名14px/600，应用名12px/600，说明12px，数字等宽。
6. 布局：工具库双列，图标与标题对齐；设置快捷键独占一行；编辑器保留整个窗口。
7. 细节：键帽、12px编辑面板圆角、统一32px按钮、可见焦点，修复网格标签三行溢出。
8. 视觉：内容即视觉，不生成装饰图。真实应用图标与计算稿纸结果是重点。
9. 动效：140ms颜色/边框反馈，去卡片上浮，支持reduced-motion。

透明度：浅Dock rgba(248,248,250,.82)，深Dock rgba(34,35,38,.84)；侧栏浅.76/深.78，编辑与结果区实底。macOS透明WebView + runtime ready后AppKit Sidebar材质，behind-window模糊。直接使用Wails MacBackdropTranslucent会出现空白，实测后改为Transparent+就绪注入。CSS reduced-transparency强制实底；Windows/Linux实底回退。本轮没有新增透明度滑块，未改变用户设置。

截图：before-*为旧界面，final-*为浏览器布局检查；native-material.png为隔离原生Dock材质验证（临时数据，无用户应用索引），native-json-workspace.png为已安装独立JSON工具窗口。原生材质截图窗口单独抓取，不能用它证明所有桌面背景的视觉混合效果。

验证：33前端逻辑、25浏览器场景、macOS Go race、原生工具保存/退出/重启探针通过。英文/西语导航无横向溢出，浅深布局目视检查。已安装/验签/启动 /Applications/QuickDock.app；当前版本仍0.1.3，本轮只本地验收，未tag/Release。

## 用户反馈后的透明度修正

早先的82%/84%遮罩偏实，且Wails默认构建没有真正关闭WKWebView不透明绘制。现将WebView本身背景清除，受异常保护使用drawsBackground开关，原生HUDWindow材质作为模糊层；遮罩调整为浅Dock38%/深32%、侧栏浅42%/深36%。红蓝测试后窗的真实屏幕合成采样已验证透色，独立窗口截屏不作为合成证明。唤起时搜索框的整行蓝色focus阴影删除，回到细中性分隔线。编辑区继续实底。
