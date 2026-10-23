# PicWiz 下一阶段实现规格（V3）

2026-10-23 · **READY WITH RISKS，已完成独立产品与分域工程复审。** 本文和三个分规格是同一份实现合同。**本轮交付规格，不实现功能、安装依赖、迁移数据或开通供应商。**

## 1. 来源、选择与就绪判定

用户已选择：**D1B Headless CMS 模板库；D2A Three.js 程序化通用模型；D3A 按设备探测的浏览器视频 POC；D4C Clerk 托管 SDK，仅主动同步外观。** 它们替代上一轮提案的默认推荐，不再把 Better Auth 或 Git 编辑内容作为实施路线。

| 工作包 | 本阶段计划交付 | 明确的完成边界 |
| --- | --- | --- |
| G：Gallery | Sanity 编辑、构建时发布的六个单源 2D 模板，真实 PNG 导出与本地场景恢复 | 可独立交付，不依赖账号、3D 或视频。 |
| A：Accounts | Clerk 邮箱验证码登录，托管 PostgreSQL＋Drizzle，仅显式选择的个人外观同步 | 不上传截图、标注、模板文字、文件名或完整作品。 |
| D：3D POC | 直接 Three.js／WebGL2，一个程序化通用手机、三个视角、真实静态 PNG | 提交可复现证据及 go/no-go 结论；不承诺并入正式编辑器。 |
| V：Video POC | WebCodecs＋Mediabunny，2D 单图短视频，按实际输出探测格式 | 提交真实文件及设备矩阵；不等于交付普遍可用的 MP4 功能。 |

Sanity 是 D1B 的具体供应商默认项，邮箱验证码是 Clerk 的首期认证配置；二者为本规格的工程选择。数据库选标准托管 PostgreSQL，不启用 Supabase Auth。地区、套餐、邮件配额、资源采购与月费用上限是部署配置门槛，未建立资源、也没有被默认为零。若改变供应商、同步内容或引入云视频，须修订规格。

**基线与去重。** V2 应用提交 `0704446`，后续研究提交 `9c4e899`。已检索本地 `app/components/lib/tests/package.json` 及 `docs/future`：已有六种尺寸、六个 starter look、24 个本地预设、标注、PNG／ZIP、严格本地迁移；新增四项只有研究文档，未发现相应运行实现。仓库没有配置 Git remote；本轮未做 GitHub issue 去重，也不创建远程 issue，不声称远程 backlog 无重复。V2 的 110／57 测试记录仅为基线证据。

**就绪判定：READY WITH RISKS。** 产品R2、Gallery工程R2、Accounts工程R2、POC工程R3均无剩余确认P1/P2规格阻塞。可作为后续实施合同；视频每格式的固定发布包分配证书须先于执行，实际集成／实机／恢复及生产配置仍按各自门槛验收。实际结论和修正记录在 [review.md](review.md)，不得以文档存在或旧测试通过代替能力证明。

## 2. 权威文档与固定术语

| 文档 | 唯一负责的合同 |
| --- | --- |
| 本文 | 选择、阶段边界、共用本地迁移、隐私、跨功能并发、集成与发布门槛 |
| [gallery-spec.md](gallery-spec.md) | CMS 内容／资源 schema、六布局、应用／恢复、2D 导出、内容发布与回滚 |
| [accounts-spec.md](accounts-spec.md) | Clerk、数据库 schema、服务端授权、同步与删除生命周期、worker／事件 |
| [render-poc-spec.md](render-poc-spec.md) | Three.js／WebCodecs 适配器、内存／编码队列、探针、POC 证据及停止条件 |

本文的共用规则优先；分规格在各自领域提供精确定义。实现前以最后一次审定版本为准，禁止用旧提案里相反的默认推荐覆盖用户决定。跨文档发现矛盾时先改合同，不靠代码实现者自行选边。

- **Look**：V2 `background,padding,radius,shadow,frame,appearance`，不含尺寸、源图、标注、模板、相机或 motion。
- **Template**：任务与可编辑纯文本槽、受限布局、同一源图的视口及六尺寸重排规则；不是增加背景。
- **TemplateSceneV1**：一个当前 composition 的本地模板状态。源图、Look、输出和标注仍分别由 composition 的既有字段拥有；场景不得复制其 data URL 或形成第二份可编辑真值。
- **RenderSnapshot**：会话内冻结的完整渲染输入，可以引用上述本地数据；它不是云 DTO 或持久化格式。
- **POC job**：实验会话状态，不写入 V2 ExportJob，也不声称可在刷新后恢复。

## 3. 短技术计划

### 页面、服务与运行位置

| 表面 | 执行位置与主要行为 | 边界 |
| --- | --- | --- |
| `/` | 服务器 HTML 壳＋现有浏览器编辑器；增加模板应用审阅、标题／细节区域、返回平面 | Canvas、源图和场景从不作为 RSC／Server Action 参数。 |
| `/templates`、`/templates/[slug]` | RSC 读取随构建发布的 manifest；普通 URL 筛选／详情；客户端才生成用户图预览 | 无 Sanity runtime 查询、无客户端 CMS 凭据；无 JS 仍能理解模板用途与限制。 |
| `/account`、登录／注册、外观与隐私子页 | 服务器验证身份／取最小 DTO，嵌套的 Clerk Provider 只覆盖账户路由 | 编辑器、图库、POC 不加载 Clerk 客户端 SDK；账户服务故障不挡本地导出。 |
| 账户 Server Actions | 显式上传所选 Look、改名、CAS 保存、删除、申请账户删除 | 每次重新验证 Clerk 身份、应用账户状态、owner、输入和幂等键。 |
| 账户 Route Handlers | 私人数据导出、签名 Clerk webhook；具体方法／路径见账户分规格 | 无图片上传、附件或公共用户数据接口；Webhook 不授予业务访问权。 |
| `/labs/render` | 单独的 Three.js／视频实验面板，客户端 lazy load；明确实验标签 | 正式部署默认 404；专用 HTTPS lab 可显式开启，不能靠隐藏 URL 当授权。 |
| `/api/health` | 无秘密的 liveness、版本与启用能力标记、关联 ID | 不声称数据库、Clerk、GPU、系统剪贴板均正常。深层诊断仅部署 CLI／受控运维。 |

保留现有 `lib/domain.ts/storage.ts/annotations.ts/canvas.ts/browser.ts/batch.ts/zip.ts` 的有效行为。新增代码按分规格的窄模块组织；服务器 persistence／Clerk adapter 导入 `server-only`，Canvas／GPU／编码代码只由 Client Components 启动。`app/layout.tsx` 不包全局 ClerkProvider，不在模块顶层启动 renderer。

### 数据与后台工作

| 数据／作业 | 所有权、持久化与生命周期 |
| --- | --- |
| 当前 Composition、StylePreset、ExportJob | 同 browser profile＋origin；本地 store v3，迁移见第 5 节；预设和历史上限仍为 24／20。 |
| TemplateRevision、CatalogRelease、公共原创资源 | CMS 内容维护者管理；已发布 revision 不可变，构建产物只读；浏览器只取同源公开资源。 |
| 应用账户、CloudPreset、同步序号、幂等回执、删除／事件记录 | 私人 owner 或受限运维主体；PostgreSQL 版本迁移；精确表、FK、唯一／check、RLS、保留期见账户分规格。 |
| Catalog build | 发布机器上拉取、校验、生成缩略图并原子发布；本阶段由维护者触发构建，不新增公网 CMS webhook。失败保留上一完整发布。 |
| 账户删除／外部事件恢复 | 持久作业系统和单独 worker，不在用户请求内等待远端删除；重试／死信／幂等／恢复见账户分规格。 |
| POC 渲染／编码 | 浏览器会话；显式开始、取消、准备完成后下载；离开／刷新释放或失效，不是服务器后台作业。 |

适配器仅有：构建时 CMS、客户端 Catalog／Scene renderer／PNG／Video encoder、服务器 Clerk／PostgreSQL／durable job；无用户对象存储、云 GPU、Remotion、ffmpeg.wasm 或自建邮件发送服务。备份存储属于受控基础设施，不是截图云存储。

## 4. 可观察产品合同

### G：模板工作流

G1. 六模板按“更新卡／细节卡”两类各三种编排；只有一个源图，细节卡可重复使用同图裁切。六种 V2 size 及 1×／2× 均有明确布局，禁止不知不觉改比例或降尺寸。

G2. `预览→暂存→确认应用`；取消、资源失败、字体未就绪、验证失败均不写 composition。保留当前源图及源图坐标标注，默认保留 size／scale；只有明确选择模板建议尺寸时才改变。确认应用只提交一个验证后的本地 envelope，并提供恢复应用前场景的动作。

G3. 模板标题和元信息为纯文本场景槽；不进入标注数组或云 Look。更换源图清除截图标注及其历史；模板文字可以保留，细节裁切复位，并在换图前后明确显示。切回平面需确认丢弃当前模板文字／布局的范围，保留截图及标注。

G4. 导出和预览使用同一冻结场景／字体／布局合同；输出仍由实际 Canvas PNG／Clipboard API 完成。加载失败允许返回平面并保持图片。模板不改变现有标注的撤销语义；应用／恢复会失效正在进行的旧拖动，防止捕获数组在 pointerup 写回旧图或旧场景。

G5. 第一阶段模板仅支持单张下载／复制。现有 Batch export 保持 V2 平面 Look＋源图标注合同；有模板时打开批量面板，明确提示“批量目前仅应用外观和截图标注，不包含模板文字／排版”，用户确认后才开始，不把模板预览冒充 ZIP 内容。模板批量、3D 批量和批量视频均不纳入。

### A：显式外观同步

A1. 匿名用户保留全部本地流程。只有进入账户区域才加载 Clerk；Clerk 只管理身份，应用数据库仍逐查询授权。账户区与本地工作台之间使用完整文档导航，禁用边界链接预取，避免 SPA 返回后仍保留账户 SDK 的全局执行状态；不在 URL 中携带身份、Look 或图片。应用首期不使用 organization、角色、付款或头像导入。

A2. 登录成功不读取整个 local store 发往服务器、不自动搬迁、不把共享 profile 归给登录者。用户在客户端挑选本地预设、查看最小名称＋Look 预览，再显式提交。云记录保存、覆盖和删除均为显式操作，无离线持久发送队列、无背景自动上传。

A3. 云 Look “应用到本地”只使用本地 repository 更新外观，不改源图／标注／模板／尺寸；云名称只有显式另存时复制到本地预设库。客户端从本地 envelope 提取 allowlist DTO，绝不能将整个 store 交给服务器后再过滤。

A4. 过期会话停止云写入、清除账户缓存，保留本地 composition；409 给双方版本与保留副本选择；猜他人记录统一 404；限流给 Retry-After；服务故障不显示“已同步”。退出、删除账号、清空浏览器是不同范围，成功必须有对应结果。

A5. 账户页与编辑器可以共享浏览器存储，但不存在“登录后本机保密”的承诺。Clerk SDK 属于第三方受信任脚本，拥有同 origin 页面脚本的能力；本设计和网络验收保证应用不发送图片，不声称 CSP 可以从已执行 SDK 中隔离 localStorage。

A6. 注册后未启用云库的用户仍可删除 Clerk 身份并取得删除回执；此动作只持久化删除所必需的最小记录，不启用同步、不转入任何 Look。空库的 V2 预设文件导出返回 `422 preset_empty`、无附件；账户数据包仍可导出空库，新增一个预设后可正常导出兼容文件。

### D／V：实验合同

D1. GPU POC 与 Video POC 是两个独立任务。前者只做通用手机静态 PNG；后者只做 2D 单图，不含 3D 视频。正式应用中不出现未经 POC 验证的可用按钮。

D2. 所有性能和内存数字都是 [render-poc-spec.md](render-poc-spec.md) 的试验门槛，必须记录实际设备／OS／引擎／构建。无硬件支持记录 unsupported，不把 unsupported 数量记为通过，也不静默上传兜底。

D3. 视频需要在实际配置下完成编码、封装、独立解码并验证尺寸／帧数／时长；`isConfigSupported` 或 MIME 返回 true 只允许继续探针，不足以启用“MP4 可用”。没有可用视频格式时保留 PNG，降级需用户明确选择。

## 5. 本地数据迁移与回退（共同权威）

### 5.1 schema 与唯一数据所有者

新增版本迁移 `lib/migrations/003-template-scene.ts`，并冻结 V2 schema／allowlist 校验器；不得用扩展后的 v3 校验器冒充旧数据校验。**继续使用 `picwiz:store` 作为工作键**，envelope root 仍为 `version,composition,presets,jobs`，version 改为 3。composition 仅新增 `scene:TemplateSceneV1|null`；其精确模板字段由 Gallery 分规格定义，不存模型、纹理、VideoFrame、Blob 或 object URL。

旧的 `source/style/annotations` 字段仍是唯一来源。`scene=null` 必须逐像素保持 V2 flat 渲染；`scene!=null` 从 composition 组装完整 RenderSnapshot。TemplateScene 的标题／裁切／布局不能覆盖 style 中的 size／scale，不能另存第二份源图。未加载到兼容 renderer／资源时保留 scene，显示恢复界面，不能自动归零。

V1 依现有冻结迁移先升到 V2；003 仅增加 scene=null，保留 ID、UTC 时间、源图、预设 style 和 jobs，既有 interrupted 恢复按迁移后记录比较。源图为空时 scene 可存在以编辑占位标题，但禁止 PNG 导出，直到用户导入图。新创建文档也经过同一迁移链。

### 5.2 备份、原子性与失败

- 升级前把**权威输入的原始、已验证 V1 或 V2 字符串**保存在 `picwiz:pre-v3`；不得用重新 stringify 的对象或 V2 中间表示冒充原始备份。优先权威输入为已存在的 `picwiz:store`，仅其不存在时才采用 `shinyshot:store`。已有 legacy 键原封不动保留，包括工作键本身存 V1、legacy 缺失或内容不同的场景。首次全新空工作区无旧文档时不生成虚构原始备份。
- 迁移步骤：读取三个键的 raw snapshot→验证权威工作键→构造、验证 v3→若有旧数据，先写／核验 pre-v3→再次核对相关快照→单次 setItem 写完整 v3→读回核验。localStorage 不支持跨键事务，备份成功但主写失败时保留旧工作键与备份，不声称已升级。配额失败提供私下下载原始备份、session-only、重载或显式清空。
- pre-v3 已存在且逐字节等于此次权威旧输入可幂等复用；若不同，禁止静默覆盖，展示两个版本的备份下载和恢复说明。用户明确选择替换旧备份后才重新迁移；此确认属于产品恢复 UI，不是本次编写规格需要的授权。
- 现有工作键为 corrupt／future schema 时禁止从任一旧键偷偷恢复。所有保存、adoption、preset import、本地云 Look 应用都验证当前文档并比较三个键 snapshot；`StorageEvent.key=null` 或其中任一键变化使在途读取、拖动、保存及 runner 代次失效，提示重新载入。旧 V2 页签写入时仍须由现有 snapshot 保护拒绝覆盖新版。
- “清除此设备本地数据”先取消／失效所有 pending import、编码结果和 cloud-to-local 回调，再按 `shinyshot:store→picwiz:pre-v3→picwiz:store` 删除，读回验证三键都不存在。部分失败停止保存，说明哪个步骤未完成，不重建已删内容；结束前云请求若已提交，不能声称被撤回。
- 备份封装升级为 `local-data-backup` version 2，含三个 rawOrNull 键；旧 version 1 文件继续可下载说明，不新增整工作区导入器。V2 `style-presets` version 1 文件合同不变，绝不接受 Scene／源图字段。

### 5.3 回退与保留

pre-v3 备份不自动过期，直到用户确认清空或在说明后单独删除；它可能含旧截图，Remove screenshot 只移除当前 composition，不能声称同时抹除旧备份。隐私页、恢复框和 README 必须列出三个键。

回退前私下下载当前三个键备份，再恢复 pre-v3 的原始 V1／V2 到工作键，重新载入 V2 发布；其既有冻结迁移可读取 V1。此操作丢弃后续模板编辑；旧版不理解 scene，禁止直接强行把 version 改成 2。旧 V2 清空 UI 不认识 pre-v3，回退说明必须提供手动清除此额外键的步骤。回退无须删除云记录，服务器数据库使用 expand／contract 迁移，独立回滚应用代码，禁止为回滚 drop 个人数据表。

## 6. 状态、并发、取消与副作用

| 状态机 | 允许触发者／不变量 |
| --- | --- |
| 模板应用 preview→staged→applied／cancelled | 当前页用户；暂存不落盘，取消可逆；确认后单次提交，恢复前先检查 source revision 与 workspace epoch。 |
| 账户 signed-out→signing-in→active-uninitialized／active→expired／deleting | Clerk 身份与是否显式启用云库分别建模；两种登录态都能申请删除，删除锁定后不能被旧 webhook／晚回调重建。 |
| 云记录 active→updated／tombstone | owner、CAS 版本和幂等操作；历史回执不可原地改写；过期游标必须全量重同步。 |
| POC idle→preparing→running→finalizing→ready／failed | 显式开始；原生结果未 settled 不允许第二个编码会话。 |
| POC running→stopping→cancelled | 显式取消／离开／失效；立即停止新增工作与下载，晚结果丢弃，不承诺硬终止原生 GPU／codec。 |

本地 writer 使用独立 `workspaceEpoch/sourceRevision/annotationRevision`，不得用预览帧更新冒充 committed revision。每个 await／pointerup 前核对；Undo、改属性、删层、换图、套模板、清空或 StorageEvent 均不得被旧快照覆盖。批量／模板／账号弹层打开时粘贴事件要么明确路由到该表面，要么不处理，不能替换隐藏的当前图。

同一页浏览器高开销导出仅允许一个协调会话：V2 单张／Batch、模板 PNG、GPU POC 和 Video POC 获取同一协调器；预览可被暂停。它不是跨浏览器页签／系统的全局内存上限。PNG 实际回调锁继续遵守 V2 语义，15 秒应用超时不能释放未 settled 原生锁；Video／GPU 的关闭和晚回调规则详见 POC 分规格。结构性输入错误在副作用前拒绝；已被服务端接受的云写入不因浏览器取消自动回滚。

## 7. 安全、隐私与运维共同要求

- 公开只读模板、匿名浏览器工作区、个人云外观是三个所有权边界；CMS 编辑者是外部内容维护人员，不是应用内管理员角色。截图不经表单、URL、RSC、日志、异常遥测、账户同步或实验报告上传。
- 服务端只接收账户分规格允许的名称＋Look／操作字段。未知键、过长文本、非有限数、任意 CSS／HTML／URL 与非规范枚举拒绝；body 在解析前有界。客户端格式验证不能代替 owner、quota、唯一名称、CAS 和数据库事务。
- Clerk BAPI 客户端必须先经实例 ID 核验，密钥／配置／客户端代次改变后重新绑定；未确认或实例不符时云操作失败关闭。只有已绑定到预期实例的真实用户 404 才能触发删除／对账清理，不能把另一 live 实例的有效密钥当成当前实例的证据。
- `server-only` repository 在所有列表、搜索、导出、保存、删除、猜 URL 和 worker 操作中明确 owner。RLS 以 transaction-local 身份上下文和最小权限角色作第二层；连接角色不拥有表、无 BYPASSRLS。表 owner／superuser 的例外不能被忽略。[PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)（2026-10-23）。
- 云配额变更锁账户行，在同一事务检查实际 active 数、唯一约束、CAS、序号及回执。不能依赖 UI、缓存计数或仅“先 count 再 insert”。死锁／序列化失败只有限重试同一幂等操作，锁顺序固定。[行锁](https://www.postgresql.org/docs/current/explicit-locking.html)、[事务隔离](https://www.postgresql.org/docs/current/transaction-iso.html)（2026-10-23）。
- Server Action 视为公开 POST 入口，每次重新授权；保留 Next Origin／Host 校验，受信代理域显式列举。Route Handler 状态变更另有同源 CSRF 校验；认证／私人 DTO 禁共享缓存。仓库安装版 Next `data-security.md` 与 `authentication.md` 为实现依据。
- `/`、Gallery 保持同源网络策略；lab 额外仅允许 `media-src 'self' blob:` 播放本地视频成品，其余仍同源。只有账户／登录路径扩展经核验的 Clerk CSP：本环境 FAPI、Cloudflare challenge 与官方必需的受限 Protect 后缀／端口模式，完整清单见账户分规格。禁止裸全域 `*` 和无依据的 SDK 域；不能把必需的受限 wildcard 误写成单一精确 host。每个响应只发一份生效 CSP，避免新旧策略叠加导致资源被交集阻断。避免跨边界预取，把第三方 SDK 引入保持在用户明确进入账户的边界。
- 所有时间为 UTC ISO-8601 或 PostgreSQL timestamptz；没有本地日历排程，不引入无意义用户时区字段。周期运维按 UTC，保留事件接收和供应商事件时间的区别。
- 日志只含 request/job/event correlation ID、版本、状态、错误码与匿名统计，不含源图、文件名、标题、Look 名称、邮箱、Cookie、JWT 或 webhook body。worker 错误／积压／重试／死信可见且有人工恢复说明。
- `.env.example` 只列变量名、用途、可公开性、默认禁用功能和本地 fake 路径；不得写真实 key。生产禁用 fake auth／测试 header，缺 Clerk／DB 时只禁用账户模块，不破坏本地工作流。数据库备份、删除 ledger、恢复演练按账户分规格完成后才能开放真实账户。

## 8. 实施顺序、测试与发布门槛

### 交付顺序

1. **合同／基础**：冻结共享 DTO、模板 scene、local 003 与无模板像素回归，建立独立测试数据库／外部 fake。
2. **G 独立实现**：Sanity schema／示例内容→有界构建→六模板审阅／编辑／PNG→迁移及回退；不等账号或 GPU。
3. **D 与 V 并行实验**：隔离 lab，使用虚构图先验证；输出证据包，不自动把 POC 合入正式功能。
4. **A 独立实现**：Clerk 测试实例／假适配器→最小账户页→数据库约束／同步→删除与恢复 worker→安全／隐私验收。
5. **分别发布**：G 与 A 各自通过 gate 后可发布；D／V 提交 go/no-go 与实际限制，由用户再决定产品化规格。不能因为 Gallery 通过就宣称 3D／视频可用。

### 自动化要求（未来实现时新增，当前未运行）

现有 `npm test` 的 V2 回归必须保留。新增一个文档化的 `npm run verify:v3` 统一命令：检查版本／typecheck／构建→启动或连接**隔离的临时测试 PostgreSQL**并迁移／seed→unit／adapter／CMS build integration→生产构建的三引擎 E2E→清理。真实 Clerk、CMS、设备凭据不作为确定性套件的必要条件；它们由单独 smoke／POC gate 验证。

测试 runner 只可创建、删除带随机测试前缀的数据库，拒绝生产 URL／共享 schema；worker 和并发用真实隔离 PostgreSQL，不用内存 Map 冒充 FK／unique／RLS／锁。版本迁移和 rollback fixtures 独立数据，禁止复用个人 browser profile。fake 只替换外部边界，不跳过业务授权。

| 必测组 | 关键断言 |
| --- | --- |
| 本地迁移／恢复 | V1→3、2→3、幂等、pre-v3 quota／冲突、未来／损坏不覆盖、三键 clear 部分失败、旧页签保存、pending import／drag／encode 晚回调；raw 备份字节保真。 |
| Gallery | 草稿不分发、非法 layout／URL／资源／许可导致发布失败、同 revision 不可改、部署原子回退；六模板×六尺寸×两倍率的真实 PNG 布局与像素断言，取消／应用／恢复不丢原图。 |
| Accounts | 两个用户的所有查询／动作／下载／猜 ID、直接 RLS、并发第24／25项、NFKC 重名、CAS、幂等重放／错 payload、过期会话、换号晚响应、无任何源图字段的真实请求。 |
| Provider／worker | 成功、拒绝、超时、退避、重投、乱序、验签／重放、worker 崩溃重领与 provider 已删／未删、备份恢复不复活账户。 |
| POC adapters | 格式探针假阳性、真实输出解码、queue／精确字节边界、取消每个 await、晚 callback、native never-settle、WebGL context loss／释放、后台暂停与资源回收。 |
| Browser／可访问性 | Chromium／Firefox／WebKit 关键路径，390px 手机视口；键盘／focus／aria-live、重叠层／文字溢出、reduced-motion、错误恢复；axe 不代替人工读屏／真机。 |

POC 自动化命令和实机证据结构在分规格中定义；unsupported、未测和失败单列。发布记录保留测试命令、退出码、构建 SHA、provider 测试模式、设备／浏览器版本、产物及未验证项；不复用 V2 的性能或系统剪贴板结论。

### 正式部署前必须填写的配置清单

维护者填入 Sanity 项目／数据集／编辑权限与静态资产许可；Clerk 测试／正式实例、验证码配置、精确 SDK 域、session 限制与删除条款；数据库／备份地区、恢复目标、监控／worker 责任人、套餐和费用告警上限。上述项在规格阶段以无秘密模板记录，开资源前必须有值；缺值不阻止本地实现和 fake 验证，但禁止标记生产账户／CMS 集成验收通过。

## 9. 变更与授权边界

本规格不授权截图云同步、完整作品同步、模板市场／UGC、多项目管理、具体品牌设备、任意模型导入、3D 视频、服务器视频或付费订阅。用户本轮要求是**先写规格**；交付后停止在规格阶段，不将一次选型自动解释为实现、部署或采购指令。
