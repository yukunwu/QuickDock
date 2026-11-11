# 应用拼音与英文搜索

2026-11-11，本地开发与安装验证，未发布新版本。

原搜索已经支持显示名的拼音/首字母，但中文显示名对应的英文名没有进入检索。例如微信的英文WeChat、访达的Finder、系统设置的System Settings无法可靠命中。现在在保留显示名与启动ID的同时检索别名：

- macOS收集原始CFBundleName/DisplayName、应用入口名，以及包内可读取的英语与中文InfoPlist.strings名称。少量已知应用ID补充常用双语名，涵盖系统应用、微信、Chrome、Edge、VS Code等；并非任意应用名自动翻译。
- Windows收集目标exe名称，前端兼容Windows路径分隔符；Linux保留原始和中英文desktop Name，本地化显示时不丢搜索名。
- 旧apps.json没有aliases仍兼容，用basename与已知ID即可搜索；启动/自动刷新后写入新别名。别名不改变ID、启动路径或使用记录。Snapshot深拷贝aliases避免外部修改共享状态。

匹配归一化全角字符与大小写，紧凑匹配省略空格/标点；拼音/首字母/英文单词缩写逐名称独立处理，不把两个别名拼在一起制造跨边界命中。完整显示名优先，原始英文强匹配和明确缩写先于宽泛子串，再用最近使用与频次排序。仅入口basename参与搜索，不索引用户目录、Applications/Program Files等父目录或全部bundle ID。

输入示例：微信weixin/wei xin/wx/WeChat；访达fangda/fd/Finder；备忘录beiwanglu/bwl/Notes；系统设置xtsz/system settings/systemsettings；VS Code可搜visualstudiocode/vscode/vsc。多应用共享短缩写时会有多个结果，完整名称更精确。

验证：

- 38项前端逻辑全通过，新增双语/别名/分隔/排序/空格全拼/首字母/Windows和Linux入口/无目录误命中/缓存别名更新测试。
- 31项浏览器场景全量通过，新增真实搜索列表→Enter→启动ID验证；未知应用保留Google/翻译入口。
- Orca内置浏览器实际运行当前search模块验证10种中英/拼音查询；界面输入vscode显示唯一Visual Studio Code结果。
- 全Go race通过，Linux desktop原始/双语别名与Snapshot隔离测试通过。Windows/Linux x64/ARM64交叉构建通过。
- 隔离Wails/AppKit/WebKit测试进程用本机真实应用索引验证微信、Finder、Notes、System Settings、Terminal、Activity Monitor共21种查询。Activity Monitor的am会和其他本机应用共享短缩写，已验证在匹配列表中；不要求短缩写在所有安装集合中唯一。测试不启动这些用户应用，不改用户配置。
- 150应用/200查询热搜索p95约0.2ms，最长约1.2ms；仅函数耗时，不含窗口显示及渲染。

本地macOS arm64.app已构建并验签；本轮安装后保留配置/历史/工具草稿。公开Release仍v0.1.4，本轮无tag/Release。
