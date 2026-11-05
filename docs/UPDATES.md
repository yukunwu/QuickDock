# 自动构建、发布和更新

GitHub 仓库：https://github.com/yukunwu/QuickDock

## 自动构建

推送 online／main、提交 Pull Request 或手动运行 Actions 会执行三平台测试，构建 macOS／Windows／Linux 的 arm64 和 x64。Linux 同时打包 DEB／RPM。构建产物下载自 Actions 的 quickdock-all-platforms artifact。

发布稳定版：更新 VERSION，然后提交并推送对应的 v 标签。例如 VERSION 为 0.1.1 时推送 v0.1.1。标签与 VERSION 不符会失败。只有 macOS 构建、Linux 两架构安装启动测试、Windows 两架构原生 Go 测试全部成功后，工作流才创建 GitHub Release，一次上传十份包（包含两份 macOS DMG）和 SHA256SUMS.txt。失败的构建不会成为更新源。普通分支推送不创建公开版本。

## 应用内更新

启动 10 秒后、之后每 6 小时检查 GitHub 最新稳定版。设置页“应用更新”和托盘“检查更新”可手动检查。版本和平台从本机确定，按精确的系统／架构／包格式选择资产；不加载预发布版。检查不会下载或重启；点击“下载并安装”后下载和校验，点击“保存并重启”生效。更新状态、错误和下载进度显示在设置页。

- macOS：Wails 原生更新器下载、校验、解压，重启 helper 等原进程退出后替换完整 .app；原安装有签名时也验证新包签名。应用应放在用户可写的应用目录，不能从只读磁盘映像运行。
- Windows：同一更新器替换 QuickDock.exe，支持 x64／arm64；解压到可写目录。WebView2 Runtime 由系统提供。
- Linux：下载匹配的 DEB／RPM，SHA256 通过后用 pkexec 请求系统授权，执行 apt-get／dnf 安装，保持包管理器记录一致，不直接覆写 /usr/bin。取消授权或安装失败会保留当前运行版本，可重新检查再试；缺少 polkit 时提示手动安装。安装成功后可点击重启。

独立工具沿用正常退出保存握手，保存失败不退出。Dock 临时输入仍属会话内容，更新前需自行保存。配置、计算历史与独立工具数据不包含在应用替换中。当前检查设置默认开启，没有发送用户工具内容，只请求 GitHub 版本和对应包。

校验要求：更新源必须包含匹配资产的 SHA256，不存在、长度不对或校验不符都拒绝安装。SHA256 从同一 GitHub Release 获取，用于完整性校验；当前未配置独立发布签名密钥，不能将其当作独立于 GitHub 账号安全的签名认证。macOS 目前 ad-hoc 签名，Windows 未代码签名。

## 验证

本地新增测试覆盖六目标资产匹配、DEB/RPM选择、缺失校验拒绝、真实 Wails 下载/解压 staging、篡改拒绝和未就绪操作保护。scripts/check-release.py 校验十包哈希和 ZIP 单一顶层入口；macOS 包只能含 QuickDock.app，Windows 只能含 QuickDock.exe，避免自动更新替换失败。

系统包安装授权／Windows 与 macOS 实际更新重启仍需各桌面的交互验收；下载 staging 测试不冒充完整进程替换测试。初次安装 0.1.1 后，下一份更高稳定版才会触发升级。0.1.0 没有本轮更新能力，需先手动安装带更新器的版本。

macOS DMG 用于首次拖拽安装，含 Applications 快捷入口；构建时校验映像、只读挂载并再次验证 .app 签名和可执行文件哈希。应用内更新继续精确选择 ZIP，不会误选 DMG。
