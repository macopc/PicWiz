# V3 个人账户与显式外观同步规格

2026-10-23 · **READY WITH RISKS，独立工程R2与产品R2已通过；未实现、未安装依赖、未迁移数据库、未开通服务。** 本文仅负责账户工作包 A；共同权威为 [spec.md](spec.md)，尤其是本地 schema 3、三个存储键、workspace epoch 与发布边界。V2 应用基线为 `0704446`，研究基线为 `9c4e899`。下文「必须」是未来实施及验收合同，不是已通过的测试结果。实际修正与边界见[评审记录](review.md)。

## 1. 已选路线与范围

用户已选 **D4C：Clerk 托管身份服务及官方 SDK，邮箱验证码，只有显式选择的个人 Look 同步**。数据库默认标准托管 PostgreSQL＋Drizzle；Clerk 是唯一认证系统。D1B 构建时 CMS、D2A 静态 3D POC、D3A 浏览器 Video POC 均独立推进，不因账户增加上传或登录门槛。

1. 每账户最多 **24 个有效云预设**，每个内容仅为名称＋六字段 Look。内置六款不自动复制到云端。没有图片、标注、文件／文件名、source、模板引用／文字／布局、相机、motion、size／scale、导出作业或原始备份的云端字段或上传接口。
2. 匿名用户保留本地编辑、Gallery、PNG／剪贴板／ZIP 及获准的本地 POC。没有自动上传、背景保存、默认全选、自动覆盖、持久离线云队列或「登入即迁移」。任何账户对共享 browser profile 都不自动取得所有权。
3. 不采用 Better Auth、Supabase Auth、浏览器数据库 Data API、Clerk JWT→PostgreSQL 身份直通、organization、团队、业务角色、付款、社交登录、密码、passkey、头像上传或自建邮件服务。托管 PostgreSQL 的供应商可以另定，不能据此启用第二套认证。
4. Clerk 管验证、OTP 投递、认证邮件、会话及默认认证 UI；PicWiz 管应用用户映射、云记录授权、事务、删除请求和恢复。无自定义 OTP 表、邮件 outbox、密码重置接口或 Resend 依赖。

仓库依据已读：[AGENTS.md](../../AGENTS.md)、[README](../../README.md)、[账户研究](../future/accounts.md)、[产品设计](../future/product-design.md)、[决策单](../future/decisions.md)、[评审](../future/review.md)，以及 `lib/domain.ts`、`lib/storage.ts`、当前 `/`、`/privacy`、`/api/health`、布局／CSP 和预设／恢复／导入／竞态测试。V2 本地 Preset 保存完整 Style，但其文件格式已只导出 Look；服务器不得复用完整 Store／Style 作为云 DTO。

## 2. Clerk 配置与 SDK 边界

### 2.1 邮箱验证码和托管组件

首期用官方 `<SignIn />` 的统一登录／注册流程；不自制邮箱输入、验证码输入、challenge、发送／验证端点或低层 FAPI 流程。Dashboard 固定：邮箱必填并验证、email verification code 开启；email link、password、phone、username、social／enterprise／Web3、passkey、MFA 关闭；姓名／头像非必填；多账户同时登录关闭。组件的策略来自实例配置，隐藏按钮或 CSS 不构成禁用策略。当前官方 `<SignIn />` 默认可处理注册，见 [组件说明](https://clerk.com/docs/nextjs/reference/components/authentication/sign-in)（核验 2026-10-23）。

必须在独立测试实例检查配置及直接 FAPI 行为，确认只有 `email_code` 可用。正式实例从空的同配置用户集开始；不能把「关闭 Password」当作撤销已有密码，官方注明旧用户仍可能使用已有密码。不得导入带其他因子的旧身份后宣称 code-only。[认证选项与现存密码限制](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options)（核验 2026-10-23）。

OTP 的长度、有效期、重发与失败次数以锁定 SDK／正式实例实际行为为准。当前官方说明组件重发冷却 30 秒、当前验证码有效 10 分钟；不套用旧提案中自管 OTP 的「5 分钟／3 次／重发必使旧码失效」。错误／过期／限流由托管 UI 处理，外围始终有「继续本地编辑」。不得自行承诺消除 Clerk 内部流程的所有邮箱存在性差异；PicWiz 不增加查邮箱接口。发信请求被接受不等于送达；供应商故障不改走自建邮件。[认证选项](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options)（核验 2026-10-23）。

敏感操作使用 `useReverification()` 的**默认托管弹层**，不提供 `onNeedsReverification` 自定义流程。服务端以 `has({reverification:{level:'first_factor',afterMinutes:5}})` 检查近期第一因子；Action 返回官方 `reverificationError`，Handler 返回 `reverificationErrorResponse`。应用删除／私人导出必须通过，取消不执行。重验后的自动重试仍带原操作 ID／不可变输入，且重新检查主体／epoch；它不是自动重放旧离线草稿。此项仍然只允许邮箱码，不要求本期未提供的第二因子。[Reverification](https://clerk.com/docs/guides/secure/reverification)、[Auth 配置类型](https://clerk.com/docs/reference/backend/types/auth-object)（核验 2026-10-23）。

首期不开放完整 `<UserProfile />`；账户页只展示最小会话信息、当前会话退出、外观及隐私操作。实例关闭用户自行改邮箱和直接自助删身份，删除通过第 9 节的统一应用流程。**注册后拒绝建立云库的用户也能直接删除身份并取得回执**，不得要求先初始化／同步 Look。Dashboard 管理员仍可能修改／删除身份，必须处理相应事件。丢失邮箱访问权不凭名字、截图或本地 profile 恢复。邮箱管理及新因子绑定另立规格；管理侧变更邮箱不改变 Clerk subject／应用 UUID，也不按邮箱合并账户。[标识修改控制](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options)（核验 2026-10-23）。

### 2.2 只在账户文档加载 SDK

- `app/layout.tsx`、全局导航、编辑器、Gallery、`/labs/render` 及 `/privacy` 不导入 Clerk 的客户端入口、不包 Provider、不读取 Clerk 身份、不预取账户 UI／FAPI，不显示依赖 `useUser()` 的全局头像。
- 拟议 `app/account/layout.tsx` 在 `<body>` 内嵌套 `<ClerkProvider dynamic>`，只覆盖 `/account` 及其子路由。`/account/sign-in/[[...sign-in]]` 渲染官方 `<SignIn />`，其内部步骤属于该 catch-all；不另造 OAuth callback 或 `/api/auth/[...all]`。
- 从本地区域进入／返回账户区域使用完整文档导航；入口关闭 Next 预取。若本地有未保存 session-only 编辑，离开前给保存／私下导出备份／取消选择。返回 `/` 要真正卸载旧文档，不能只 unmount Provider 后声称第三方脚本已卸载。浏览器缓存了 SDK 文件不代表 SDK 可以继续在新编辑器文档执行。
- 进入账户区本身代表启动认证服务请求，**不代表同意同步**。在用户点「选择本地样式」前，账户 UI 不主动读取本地 workspace；读取／对照及中性预览全部在客户端。没有把 Store 传给 RSC 的步骤。

官方允许把 Provider 放在更深的组件树，只为所需页面加载。[ClerkProvider](https://clerk.com/docs/nextjs/reference/components/clerk-provider)（核验 2026-10-23）。按需加载与 full navigation 是 PicWiz 的边界，不是 Clerk 自动保证。

### 2.3 真实会话模型

接受 Clerk 标准 SDK 的短期签名 JWT：应用域 `__session` 默认约 60 秒，**JavaScript 可读、非 HttpOnly**；FAPI 域的生产 `__client` 是 HttpOnly 长期客户端凭据，用于续发短期令牌。SameSite／域范围／Secure 必须以锁定版本的 HTTPS 测试核对，不手工改 SDK Cookie 或伪装成自管不透明会话。不保存 token 到 Store、localStorage、sessionStorage、业务表、日志、Action 参数或 JSON 导出；不额外建立一层登录 Cookie。[Clerk 工作原理](https://clerk.com/docs/guides/how-clerk-works/overview)、[Cookie 说明](https://clerk.com/docs/guides/how-clerk-works/cookies)（核验 2026-10-23）。

JWT 有效期不等于整个登录有效期。上线配置表要记录所选套餐实际 session lifetime／inactivity timeout／reverification window；初期产品接受至多 7 天绝对会话寿命，若套餐允许则明确设置，不许靠定时刷新使其无限滚动。Hobby 是否满足所需控制由实际套餐验收决定。无 SDK 的编辑器不维持刷新；再次进入账户可走 Clerk 的文档导航 handshake，Action 不通过 redirect 自动重放写入。

短期验签仍有撤销可见性窗口。本规格额外要求：**每个读取私人数据／写入的服务入口都实时检查 BAPI session 与 user**，不跨请求缓存 active 结果；BAPI 故障关闭云访问，继续本地。已在撤销前通过检查并开始的事务可能完成，第 8 节明确处理迟到结果；不承诺全球瞬时撤回已执行操作。

### 2.4 BAPI 实例身份与不可变凭据代次

应用配置必须显式固定非秘密 `CLERK_EXPECTED_INSTANCE_ID`。每个服务器／worker 的不可变 `ClerkClientGeneration` 绑定：唯一 generationId、同一份 secret manager 凭据版本及 SDK client、expected instance ID、环境类型、issuer／验签配置、publishable key／FAPI host、APP_ORIGIN 和部署配置版本。不能在已验证 client 上替换 secret，也不能给新 client 复用旧的 verified 标志。任何 secret、上述配置或 client 对象重建都产生新代次；本节不允许跨代次的「BAPI 可用」全局布尔缓存。

**代次准入必须先由该 client 调用 `client.instances.get()`，只有返回的 `Instance.id === CLERK_EXPECTED_INSTANCE_ID` 才能 verified**；同时检查 environmentType 与部署环境相符。官方 `get()` 包装 `GET /instance`，Instance 的 id 是唯一实例标识；环境类型仅区分 production／development，不能区分两个 live 实例。[instances.get](https://clerk.com/docs/reference/backend/instance/get)、[Backend Instance 类型](https://clerk.com/docs/reference/backend/types/backend-instance)（核验 2026-10-23）。有效的另一 live 实例密钥可能得到成功 BAPI 响应及本 subject 的 404，故密钥前缀、401／403、环境类型、成功请求或 subject 不存在都不能替代 ID 相等检查。

- 生命周期为 `unverified→verifying→verified→expired／retired`。只在**同一进程、同一不可变代次**缓存成功核验，最长 5 分钟（单调时钟）；并发首次／到期核验合并为一次在途调用，单次截止 3 秒。到期不能用 stale-while-revalidate，必须等新核验；失败／超时／缺 id／不相等不缓存为成功、用户不存在或其他用户状态，也不写错误结果缓存；失败promise结清即移除，后续有界重试重新调用实例接口。明确 mismatch 的代次停止准入，配置修复以新代次恢复，不能把失败proof当可复用的核验结果。
- 这是整个账户模块的前置门，覆盖无映射的身份删除、普通读写／初始化、auth 的 getUser、reconcile、sweep 派发与消费、deleteUser／确认查询、webhook 后续及恢复对账。它不只阻止某个 subject：代次未核验或不符时所有使用该代次的云写入、内容清除、删除确认均失败关闭；HTTP 入口 503 `clerk_instance_unverified`，正常本地功能和已有回执的最小状态查询仍可用。signed webhook 也须先验本节绑定才能提交删除副作用，不能绕过此门。
- 每项工作捕获同一代次的 verified handle，外部响应必须携带内部 generationId；处理 getUser／deleteUser 的 404、发出删除副作用以及提交 DB 内容清除／终态前，再确认 handle 未到期、未 retired 且配置仍为当前代次。过期先用**同一个 client**复核；轮换或跨代次的晚响应丢弃后重新检查，不能凭新 client 的证明解释旧 client 的 404。session endpoint 的 404 仅为会话无效，绝不是用户已删证据。
- 凭据／配置轮换先关闭该环境云写入和删除派发，退休旧代次、排空其已开始的 DB mutation，再由新进程／worker 各自核验新代次，确认旧消费者退出后才重新开放；禁止在运行中的对象原地换 key。密钥撤销、BAPI 401／403 或实例核验故障立即废弃该代次的成功缓存，保持门关闭并告警；不得在凭据错误路径执行数据清除。暂态未核验工作保持未开始／pending，有界重试到限则 dead-letter／blocked_external；配置不符直接 blocked，均可经修复＋受控 redrive 恢复，不设置 provider confirmed／completed。

**与 issuer／publishable instance 的部署绑定是另一个必要检查。** `Instance` 返回 id／环境类型，不提供能据此推导 issuer 的字段，不能声称 id 相等已自动证明公钥配置一致。部署者须从所选 Clerk Dashboard 的同一实例独立记录 expected ID、publishable key、FAPI host、issuer、环境和 webhook endpoint 配置；expected ID 不从候选 secret 的响应自动填入。发布检查比对这份固定清单、publishable key 定位的 FAPI 与配置 issuer，并用该实例的合成用户实际登录，验证 token issuer／验签配置和同一已核验 BAPI client 的 session→subject 查询相符。全套匹配才开放账户；同为 live 的其他实例同样必须失败。更改任一绑定值须重新完成检查，不能用请求 Host／token 未验证的 iss 动态选择实例；已有业务数据的环境不能仅把expected ID改为候选key返回的另一个实例来「修好」mismatch，实例迁移须另立合同，禁止对旧owner在新实例批量解释404。日志只记 generationId、配置版本和规范错误码，不记录 secret、secret 派生指纹、token 或完整 client／供应商错误对象。

## 3. 页面、Action、Handler 与权限

下列均是**拟议路径／名字**。业务 CRUD 统一走服务器 repository；不同时建立另一套 REST 预设 CRUD。

| 页面 | 行为和状态 |
| --- | --- |
| `/account/sign-in/[[...sign-in]]` | 200 认证说明＋托管 SignIn；成功固定回 `/account`。已登录显示前往账户，不读取本地库。取消完整导航回 `/`。 |
| `/account` | 未登录文档导航 307 到固定登录地址；已登录 200 显示最小账户状态。尚无应用映射时并列「建立个人云端样式库」「删除账户与登录身份」及隐私页入口；前者才显式建空库，GET 不创建业务记录。 |
| `/account/sync` | 本人有效云预设，空库不覆盖本地；客户端选择／预览／确认本地转入，云记录编辑、改名、删除、冲突、显式存本地。未建立映射先回 `/account`。 |
| `/account/privacy` | 不以已有 owner／已建库为进入条件。active-uninitialized 说明未建立云库、提供身份删除＋回执；已有库说明私人数据导出／删除账户／清除此设备；敏感操作近期重验。disabled／deleting 显示受限说明，不渲染私人样式。 |

账户页面的状态说明可以是 200 UI，不能据此说接口也返回 200；已验身份但 forbidden 的私人数据入口返回 403。RSC 在取得私人 DTO **之前**完成校验，不在输出敏感 shell 后才用客户端隐藏；不依赖实验 `authInterrupts`。未知记录不产生可索引详情页，账户文档 `noindex`。

| Server Action（仅从 `/account` 路由调用） | 严格输入的业务部分 | 语义结果 |
| --- | --- | --- |
| `initializeAccountAction` | 未映射主体的 `contextTag` | 201 建空库；同 subject 重复 200 返回原 UUID；删除屏障 403；不会读取／同步本地。 |
| `refreshCloudSnapshotAction` | 当前 `contextTag`，可选 `knownLibraryVersion` 十进制字符串 | 200 全量快照，最多 24 项；版本不一致时409要求重新全量读取；只读。 |
| `createCloudPresetAction` | `nameLook` | 201 新 UUID／version 1；同名 409；配额 409。 |
| `updateCloudPresetAction` | `id,expectedVersion,nameLook` | 200 CAS；完整替换名称＋Look，可实现单独改名；不接受部分任意 JSON patch。 |
| `deleteCloudPresetAction` | `id,expectedVersion` | 200 tombstone 回执；重复规则见第 7 节；未知／跨 owner 404。 |
| `importCloudPresetsAction` | `expectedLibraryVersion,entries` | 200 原子提交所见预览；过时 409；可全跳过。 |
| `requestAccountDeletionAction` | 精确 `{operationId,requestedAt,contextTag,confirm:'delete-cloud-account',receiptToken}`；contextTag 用途为 account-delete，允许未映射主体 | 独立身份＋近期重验，不先要求 active owner；无映射直接建 deleting 的最小映射，事务提交 ledger＋job 后202；重复／丢响应见9.1。不调用 initializeAccountAction、不启用同步、不在请求内等 Clerk 删除。 |

除初始化与只读刷新，普通 Action 均加第 7 节的操作 envelope；删除账户用独立生命周期回执。返回正常结果用 `{ok:true,status,requestId,data}`；可预期失败用 `{ok:false,status,code,requestId}`，必要时带本人冲突 DTO。**这里的 status 是领域语义，不保证 React Flight 的 HTTP 状态相同**。官方重验错误结构是明确例外，直接由 SDK 处理。禁止把框架 Action ID 当认证、CSRF token 或业务幂等键。

| Route Handler | 认证／输入／真实 HTTP 结果 |
| --- | --- |
| `GET /api/account/export?format=presets\|account` | 由账户客户端 fetch 发起，Accept为application/json；Cookie 会话＋active＋5 分钟第一因子；未知参数／不支持的文档导航400；200 附件／401／403／422／429／503。`presets` 为1–24项的 V2 `style-presets` v1，0项返回422 `preset_empty` JSON、无附件；`account` 版本化账户包允许0项。见6.3，无保存作用。 |
| `POST /api/account/deletion-status` | 同源 JSON `{receiptId,receiptToken}`，不要求已删除的 Clerk 身份；恒时校验 token 摘要。200 只给 pending／blocked_external／completed 与时间；不正确／到期统一 404；429／503。不返回 subject、邮箱或 Look。 |
| `POST /api/webhooks/clerk` | 无浏览器会话要求；原文签名、时间窗、事件instance及当前BAPI实例绑定检查；成功／重复／可忽略事件204；无效签名／格式400；过大413；BAPI绑定未证实／不符、DB／队列故障503，不能先2xx后丢事件。 |

导出／删除状态的其他方法 405；不开放 CORS。导出参数只允许这两个枚举、拒绝重复参数；附件名由服务器固定，不含邮箱／预设名。下载需用户动作，失败不生成空文件。账户包只含本人应用 UUID、导出时间、schema、云记录／版本及必要状态；不含 OTP、Cookie、JWT、Clerk secret、回执 token、队列表、原始 webhook 或别人的字段。认证供应商的完整访问请求单独交代，不声称这个包导出 Clerk 的全部内部记录。

### Proxy 和安装版 Next 约束

拟议根 `proxy.ts` 使用 `clerkMiddleware()`，静态 matcher **只有** `['/account/:path*','/api/account/:path*']`。Webhook 不需要 Clerk 登录上下文，置于 matcher 外且自行验签。`/`、`/templates`、`/labs/render`、`/privacy`、`/api/health`、Next 静态文件和公开资源都不运行 Clerk Proxy。不开 FAPI reverse proxy／satellite，故不添加 `/__clerk` 通配转发；若未来选它，须同时修订路由和安全合同。

Proxy 负责 SDK 请求认证上下文／handshake 与账户 CSP，**不查 DB、不决定 owner、不全局 redirect**。Action 是发给调用页的 POST，所有云 Action 必须留在上述 matcher 内；禁止把 Action 直接放到 `/` 调用。即使误搬离 matcher，repository 的认证失败也必须拒绝数据，不能 fallback 到客户端身份。当前官方不再建议用 `createRouteMatcher()` 作为资源保护，已标记 deprecated。[clerkMiddleware](https://clerk.com/docs/reference/nextjs/clerk-middleware)（核验 2026-10-23）。

Clerk handshake 只用于账户HTML导航。为固定私人API的401／403合同，`/api/account/*` 在调用Clerk helper前拒绝 `Sec-Fetch-Dest: document/iframe` 的请求，以及缺该头而Accept包含text/html的GET（400、no-store）；导出不使用顶层链接，而以同源fetch＋明确Accept拿附件后由用户下载。正常API／Action到期不能跟随登录HTML重定向自动重放。不得虚构SDK中未核验的「disableHandshake」选项；验证真实SDK的导航检测及此入口guard。

已按仓库要求阅读安装的 **Next 16.4.2**：`01-app/02-guides/{authentication,server-actions}.md`、`03-api-reference/03-file-conventions/proxy.md`、`04-functions/cookies.md` 和 `05-config/01-next-config-js/serverActions.md`。它们确认 Proxy 默认 Node runtime、不能导出 runtime 配置；`cookies()` 异步；Cookie 写入仅响应阶段的 Action／Handler；每个 Action 是公开入口，layout 校验不足；Action 框架默认 1 MiB 且缺 Origin 并不自动严格拒绝。采用第 10 节的额外检查。官网仅作现行参考，不代表升级项目：[认证](https://nextjs.org/docs/app/guides/authentication)、[Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)、[Server Actions 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)（核验 2026-10-23）。

## 4. 身份、授权和最小 DTO

### 4.1 唯一服务器主体

身份检查与已建库授权分层为两个 `server-only` helper：`requireClerkIdentity()` 先取得2.4的当前verified handle，再执行以下1–3步，允许subject尚无映射；`requireAccountPrincipal()` 再执行4–5步、普通云读写必须active。账户状态／隐私RSC、初始化和删除Action先用前者及各自受控事务，**不能先调用要求active owner的后者**。每个服务入口仍重新认证；一次请求内可合并相同检查，禁止跨用户／跨请求缓存身份结果。次序固定：

1. `await auth({acceptsToken:'session_token',treatPendingAsSignedOut:true})`；只接受本实例 session Cookie，不支持业务 Bearer／机器／OAuth token。拒绝冲突的 Authorization，不手工解码 Cookie 当身份。
2. SDK 验签限定该环境的 issuer／密钥，核验 exp／nbf、sid／sub 和 `authorizedParties=[APP_ORIGIN]`；生产不包含 localhost 或任意 preview origin。允许时钟偏移最多 5 秒，服务器校时。默认 Clerk session token 不强制有 aud：本期不用 JWT template，自定义 aud 不存在时**不发明 audience 值**；出现意外 aud／issuer／token type 拒绝并诊断。若以后明确配置 aud，应同步传 SDK audience 选项并测试，不能只看 sub。[auth](https://clerk.com/docs/reference/nextjs/app-router/auth)、[验证选项](https://clerk.com/docs/reference/backend/verify-token)（核验 2026-10-23）。
3. 先取得第2.4节的当前 verified generation，再用**同一 client**的 `sessions.getSession(sid)` 和 `users.getUser(sub)` 实时确认 session 属于该 user、active、未到期，user 存在、未 banned／locked、主邮箱 verified。每次外部调用 3 秒截止；401／403 密钥错误、实例不符或无法核验均为503，阻止本代次所有云写／删除。只有已绑定的 getUser 真404且提交时绑定仍有效，才可进入可靠删除对账；不能把另一 live 实例的404或session的404当作删用户证据。会话无效401；身份存在但被限制403；429／超时／5xx503。返回的内部身份对象含 subject／sid／verified handle，绝不下发。不能以旧 JWT claims 的 active 推断替代检查。[getSession](https://clerk.com/docs/reference/backend/sessions/get-session)、[用户管理](https://clerk.com/docs/guides/users/managing)（核验 2026-10-23）。
4. 在服务器凭已验证的 subject 映射 `application_user.id`（UUID）。邮箱不是 FK／合并键，客户端传 owner 不被接受。初始化在显式 Action 中取得 subject advisory lock、查删除 ledger 后建立 active 空库及 library_initialized_at；并发同 subject 返回同一 active UUID。尚无映射的普通云操作403 `account_uninitialized`，GET不建记录。唯一的用户删除例外是9.1受控事务直接建立 deleting 最小映射；Webhook永不建应用映射。
5. 事务中重读／锁账户行，核对 active／`auth_epoch`。每个查询都含这个 owner：list、按 ID、版本、count、同名查重、导入／导出、回执、关联查询；更新条件含 owner＋id＋expectedVersion，新增 owner 服务器注入。最终返回 allowlist DTO，不返回 ORM 行或完整 Clerk User。

业务调用携带服务器给的 `contextTag = HMAC(contextKey,规范编码的[用途,应用UUID或未初始化标记,subject,sid,auth_epoch])`；用途严格分 `cloud`／`initialize`／`account-delete`，固定数组编码避免字符串拼接歧义。它仅绑定用户看见的会话上下文，**不是新认证凭据**。每次仍验证 Cookie。服务端重新计算并恒时比较，不信任 body 中的用户或 epoch；A 的提交随 B Cookie 到达时以 `409 account_changed` 拒绝，绝不能转存 B。该 tag 仅留页签内存，subject／sid 不下发自定义 DTO；初始化完成后换发绑定新 UUID 的 tag。初始化专用的未初始化 tag 使用 epoch=0，只能建空库或返回同 subject 已有 active 映射，必须先查删除屏障；重复提交验证原 bootstrap tag，不误将已创建映射当换号。账户／隐私页还为当前已验身份签发 account-delete tag：无映射用未初始化标记＋epoch=0，有映射用其 UUID／当前 epoch；只能调用删除，不授同步权限。首次删除在subject锁内比对当前状态，期间被初始化或状态变化则409 `account_changed`、重取说明并重新确认；已提交删除的同操作重放走9.1回执分支，不以被本次删除改变的epoch拒绝自身重试。

### 4.2 内容 DTO：`nameLook`

精确结构为 `{name,look}`，其中 `look` 精确为 `{background,padding,radius,shadow,frame,appearance}`；所有层级拒绝未知键／原型特殊键、数组替代对象、重复 JSON key、File／Blob、非 JSON 数据。来自 Style 的投影必须在客户端逐字段构造，**禁止把本地整个 envelope／source／raw backup 发给服务器再过滤**。

| 字段 | 合同 |
| --- | --- |
| `name` | 原文和规范化后均拒绝 U+0000–001F／007F；NFKC→trim→连续空白折一个 ASCII 空格；结果 1–40 个 JS UTF-16 code unit，UTF-8≤160 bytes，无孤立 surrogate；输入即使超长也不能先无限分配。拒绝含 `<`／`>` 的标记和 `data:`／`blob:`／`http(s):` URL 载荷，显示时仍转义为纯文本。本地旧名称不合此云规则时，在客户端要求用户改名后重新预览，不静默删字符。 |
| `nameKey` | 服务端从规范 name 用 ECMAScript `toLowerCase()` 生成，不采用 locale；规范 Unicode 版本随锁定 Node，数据库用确定性字节比较。保留名称显示大小写；不做任意邮箱／拼音合并。不是客户端字段。 |
| `background` | `violet\|sunset\|ocean\|mint\|rose\|midnight\|paper\|ink`，不接 CSS、hex 扩展或 URL。 |
| `padding` | 有限整数 0–200，单位沿 V2 输出基准像素。 |
| `radius`／`shadow` | 分别为有限整数 0–48／0–100。 |
| `frame`／`appearance` | `none\|browser\|device`／`light\|dark`。 |

非法值严格拒绝，不调用 V2 `normalizeStyle()` 把攻击值静默补成默认值。Look 与当前域一致，未来加颜色／模板需新 schema，不放开任意 JSON。

每份 `nameLook` 规范 JSON（固定字段序、无空白、UTF-8）≤2 KiB；整个业务 Action envelope≤100 KiB、导入 1–24 项，原始 Action HTTP body≤128 KiB（给 React transport 留余量）。`serverActions.bodySizeLimit` 拟为 128 KiB；全部 Action 参数递归拒绝 File／Blob，绝不创建上传表单。直接 Handler JSON 解析前限 8 KiB；webhook 原始 body≤256 KiB，并限深度和头长度。框架 transport 无法在所有形态保留 duplicate key 时，DTO 仍必须在服务入口验证，不把原始 JSON 字符串直接交给 SQL。

响应 `CloudPresetDTO` 精确为 `{id,name,look,schemaVersion:1,version,createdAt,updatedAt}`；`CloudSnapshotDTO` 为 `{schemaVersion:1,libraryVersion,activeCount,limit:24,items,contextTag}`。UUID 使用标准小写格式，所有 bigint 以规范十进制字符串传输（不转不安全 JS Number）；UTC 时间为 ISO-8601 Z。只返回有效项，完整快照按 `(created_at,id)` 稳定排序，大小≤100 KiB。没有图片缩略图响应，中性样式预览在客户端生成。

名称本身可能透露客户／项目，提示「将发送所选样式名称和外观参数」；服务端不能判断用户是否在名称中主动输入秘密，不能把小型 DTO 宣传为匿名数据。

## 5. 数据库 schema、索引与迁移

### 5.1 物理模型

默认托管 PostgreSQL（上线锁定受支持版本，目标 17／18）＋Drizzle 的服务器 SQL 驱动；事务必须固定同一连接，禁止不支持事务的 HTTP 查询模式。没有浏览器数据库 key。业务 schema 为 `picwiz`，队列为独立 `pgboss`；不复制 Clerk session／OTP／邮箱数据库。以下列和约束是迁移验收的精确最低合同，名称供实现固定，不是本轮执行的 DDL。

所有应用表 `created_at`／`updated_at` 等为 `timestamptz`，DB session 使用 UTC；服务器取 DB 时间，更新取 `greatest(clock_timestamp(),old.updated_at)`，不以客户端时钟决定胜负。未特别说明 ID 为服务器生成 UUID，计数／版本为 bigint，非负并禁止溢出；所有内容列均有有限 byte check。摘要均为 `bytea CHECK(octet_length(该列)=32)`，下表以「32字节」简写，**不是 PostgreSQL 不支持的 bytea(32) 类型**。除标为 NULL 的字段外均 NOT NULL；key version 为正 smallint。

| 表 | 列、PK／FK、唯一约束、CHECK 与必要索引 |
| --- | --- |
| `application_user` | `id uuid PK`；`clerk_subject text NULL`（1–128 ASCII provider ID，active／disabled／deleting 时非空，deleted 时为空）；`subject_digest bytea 32字节,digest_key_version smallint`；`state enum(active,disabled,deleting,deleted)`；`library_initialized_at timestamptz NULL`；`library_version bigint DEFAULT 0 CHECK>=0`；`auth_epoch bigint DEFAULT 1 CHECK>=1`；`created_at,updated_at,deleted_at NULL`。active／disabled 必须有 library_initialized_at；NULL 仅准 deleting／deleted 且 library_version=0，表示从未启用库的最小删除映射；非空时 created≤initialized≤updated。唯一 `uq_user_clerk_subject(clerk_subject)`（非空）；唯一 `uq_user_subject_digest(digest_key_version,subject_digest)`；检查 updated≥created，deleted 态有 deleted_at，其他态无 deleted_at。索引 `(state,id)` 用于有界对账。subject_digest 为带用途前缀的服务端 HMAC，不是邮箱 hash。 |
| `cloud_preset` | `id uuid PK`；`owner_id uuid NOT NULL FK application_user(id) ON DELETE CASCADE`；`name text NULL,name_key text NULL,look jsonb NULL`；`schema_version smallint CHECK=1`；`version bigint CHECK>=1`；`created_at,updated_at,deleted_at NULL`。唯一 `uq_preset_owner_id(owner_id,id)`；部分唯一 `uq_preset_active_name(owner_id,name_key) WHERE deleted_at IS NULL`，使用确定性 collation；有效项 name／name_key／look 非空，name 1–40 UTF-16 units 且≤160 bytes，Look 严格六键／枚举／整数范围；tombstone 三个内容列全 NULL，deleted≥created 且 updated≥deleted。check 内容 JSON 大小≤2 KiB。索引 `ix_preset_active(owner_id,created_at,id) WHERE deleted_at IS NULL`、`ix_preset_purge(deleted_at,id) WHERE deleted_at IS NOT NULL`。owner／id／created_at 不可更新。 |
| `cloud_operation` | PK `(owner_id,operation_id uuid)`；owner FK→application_user ON DELETE CASCADE；`kind enum(create,update,delete,import)`、`requested_at,created_at,expires_at`、`hash_key_version,request_hash bytea 32字节`、`result jsonb`。`expires_at=created_at+30 days`；result≤8 KiB，只允许 ID／index／version／计数／libraryVersion／alreadyDeleted，不存名称或 Look。索引 `(expires_at,owner_id,operation_id)`；已提交行不可更新业务结果。 |
| `account_deletion` | `id uuid PK`（用户请求时为 operationId）；`owner_id uuid NULL FK application_user(id) ON DELETE RESTRICT`，非空部分唯一 `uq_deletion_owner(owner_id)`；唯一 `uq_deletion_subject(digest_key_version,subject_digest)`；`subject_digest bytea 32字节,digest_key_version`；`origin enum(user,provider,reconcile)`；`receipt_token_hash bytea 32字节 NULL`；`request_hash bytea 32字节 NULL,hash_key_version NULL`；user 必须有owner（含直接deleting的最小映射）、token摘要、request摘要及key version，其他origin的三个回执字段为NULL。`state enum(pending,blocked_external,completed)`；`requested_at,completed_at NULL,purge_after NULL`；`provider_delete_confirmed_at NULL`；`last_error_code NULL`限规范枚举，包括 clerk_instance_unverified／clerk_instance_mismatch。completed 才有 completed_at／purge_after／provider确认时间，purge_after≥completed+37 days 且覆盖最近含该用户备份的到期时间；pending／blocked 没有虚假 completed 时间。索引 `(state,requested_at,id)`、`(purge_after,id)`。它同时是最小删除 ledger；仅 provider／reconcile 的未知 subject 删除证据允许 owner 为NULL，不建立空应用账户。 |
| `clerk_event_receipt` | PK `(clerk_instance_id,event_id)`，来自验证后的实例＋`svix-id`；`event_type`有限白名单、`event_at,received_at`、`subject_digest bytea 32字节 NULL,digest_key_version NULL`（两者同时有／无）、`payload_hash bytea 32字节`、`disposition enum(applied,queued,ignored)`、`expires_at=received_at+30 days`；id≤256、type≤64、instance≤128 ASCII bytes；不留 body／email。相同 ID 不同 body hash 拒绝并告警；索引 `(expires_at,event_id)`。去重写入与应用删除／queue 入队同事务。 |
| `security_rate_bucket` | PK `(scope,key_digest,window_start)`；scope 为 `initialize/read/write/import/export/delete_account/receipt` 固定枚举，key_digest 为32字节HMAC（owner／subject 或可信来源 IP），不存原文；`count integer CHECK>=0`、`expires_at`；原子 upsert 计数，索引 expires_at。UTC整分钟窗口，expires_at=window_start+24h；按期限批量清理。不是认证 challenge 表。 |
| `pgboss.*` | 由锁定 pg-boss 版本的官方 schema／migration 管理真实 job、retry、lease、schedule、dead-letter。业务只存 `ownerId,deletionId` 或已知 owner 的 reconcile 引用，不放 subject 明文／JWT／Look。不得把其内部表伪装为稳定业务 schema，迁移前保存版本／校验和并验证 Drizzle transaction adapter。 |

DB `CHECK` 不能只写 `jsonb_typeof='object'`：必须确实拒绝额外键、数字字符串、越界及 tombstone 半空状态。名称的 UTF-16 长度／ECMAScript nameKey 与 PostgreSQL 字符长度／lower 不是同一运算；迁移中以受控、版本化的校验函数／约束触发器实现同一规则，禁止用普通 `char_length(name)<=40` 或数据库 locale lower 冒充。固定 Unicode fixtures（全角、组合符、emoji、土耳其大小写）比较应用／DB，升级 Node／DB collation 前复核唯一索引。

同步序号只位于 application_user.library_version；没有额外无界历史表。限流初始规则（每UTC分钟）固定为：初始化每已验subject 3次且可信IP 20次；普通私人读每owner 60次；普通写每owner 20次；import同时计普通写并另限5次；export每owner 3次；删账户每已验subject 3次且可信IP 20次（不要求owner）；receipt查询每可信IP 10次。所有入口和重试都计数，多实例共用原子bucket，超出429且Retry-After为到下一窗口的整秒数。不存在的subject／非法token先做有界入口IP限流，不能为任意攻击字符串无限创建bucket；边缘未认证入口同样限每IP每分钟60次，并有部署总请求预算。此规则不替代Clerk自己的FAPI防滥用／BAPI实例限额。

初始化、provider 删除、可靠404清理和用户删除（含未初始化主体）必须先取得同一 subject 的事务级 advisory lock（由固定命名空间＋已验证 subject 确定，不随 HMAC key 轮换改变），再查映射／ledger，若有owner再锁其行；固定顺序为subject→owner→预设。摘要查找计算当前及仍保留的旧 key 版本，防止轮换后漏屏障。未知 subject 删除事件与首次建库也采用该锁。删除提交后，初始化包括原bootstrap重试都先命中屏障、返回403，不能把deleting最小映射变active或补 library_initialized_at。若初始化先赢锁，旧未初始化删除tag返回409、重新确认当前状态；若删除先赢锁，初始化零写入。摘要 key 轮换不能只改 unique key version 后把旧删除记录当不存在。

### 5.2 配额、锁和持久化不变量

普通内容更改同一owner时先锁 `application_user FOR UPDATE`，再依UUID升序锁必要预设；涉及第5.1节主体生命周期的初始化／删号／webhook／worker则必须**先subject锁，再owner，再预设**，不允许反序补取subject锁。锁内重读active数（不用UI／缓存计数），验证最终active≤24、唯一名称、CAS、用户状态，再一次提交预设＋library_version＋回执。每次内容改变的普通操作递增library_version一次；批量导入也一次；全skip／no-op不递增。名称＋Look完全相同的update校验CAS后no-op，版本不变，仍可写回执。

数据库另设 `trg_preset_quota`：INSERT 有效项／tombstone 变有效／变 owner 前按同一顺序锁 owner、确认 owner 仍 active、核对实际数量，阻止第 25 项；本期禁止后两种转换。应用不靠普通跨行 CHECK 假装保证配额。该触发器和严格列权限防止日后漏用 repository 的插入绕过配额；它不能约束 superuser，测试必须覆盖实际 runtime SQL 角色。事务使用有界锁等待 2 秒、statement 5 秒；死锁／serialization failure 最多额外重试 2 次，同 op ID／同 payload，之后返回 503。没有跨用户锁或无限 while 重试。[Drizzle 事务](https://orm.drizzle.team/docs/transactions)（核验 2026-10-23）。

### 5.3 角色和 RLS

- `app_runtime` 不是表 owner，没有 superuser、BYPASSRLS、DDL、TRUNCATE、grant／set-role 权限；只授必要业务 SELECT／INSERT／可变列 UPDATE。owner／subject／id／created_at／library_initialized_at 不授普通 UPDATE，删除账户状态变更和初始化通过受控函数／窄 service 能力执行。该删除能力允许已验证subject直接插入deleting最小映射、ledger和指定job；不依赖active owner，不授建active账户或插预设权限。
- 所有私人业务表启用并 FORCE RLS；AppUser 初始化查询以已验证 Clerk subject 的 transaction-local context 限定自身，随后设置应用 UUID。预设／普通回执 `USING owner_id=current owner` 且 `WITH CHECK` 同条件，普通内容读写同时要求映射 active／事务 auth_epoch 匹配；删除／清理专用函数另有严格作用域。读取、count、唯一查重仍显式 owner predicate。ledger 查询只允许当前 subject 摘要的受限检查／receipt 验证函数；普通请求不能枚举 ledger、事件和 queue。
- `set_config('app.user_id',verifiedUuid,true)` 等上下文必须在同一事务连接内设置，无上下文默认拒绝，结束回收后不得残留。subject／digest context 同样只来自已验身份。Clerk JWT **不会自动成为 PostgreSQL current_user**；不使用不存在的 `auth.uid()`、浏览器 SQL 或 service-role 旁路。
- migration role、queue migration／worker role、reconciliation role、`webhook_ingest` 和备份／ledger 管理角色独立。webhook_ingest 只可经受控函数去重事件、设置指定 subject 删除屏障／入 reconcile 队列，不能读取全体云内容；它不供普通账户请求使用。worker 不把全局管理连接暴露给请求；每项按明确 owner 建事务，记录 jobId／deletionId，不无条件全表删除。跨 owner sweep 只用专门受限读取列权限，不能返回给浏览器。
- 受控 SECURITY DEFINER 函数必须固定安全 search_path、全限定表名、撤销 PUBLIC EXECUTE、检查调用上下文、只提供指定操作；quota trigger 只获得维护不变量所需权限。队列 enqueue 能力只接受固定 job 名及已授权 owner 引用，不能让 app 任意调用管理 SQL。

RLS 是防止漏 owner 的第二层，不能隔离已经控制服务器／DB 凭据的攻击者，也不约束 superuser／BYPASSRLS。业务 runtime 不拥有表这一点必须实际验证。[PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)（核验 2026-10-23）。

### 5.4 拟议迁移文件

拟议 `db/migrations/0001_accounts.sql` 建业务表／枚举／PK／FK／checks／索引；`0002_accounts_security.sql` 建命名校验、配额 trigger、RLS、列权限和受控函数；`0003_accounts_jobs.sql` 记录锁定 pg-boss schema 版本、受限 enqueue／worker grants、定时任务及期限配置。Drizzle schema 位于拟议 `lib/server/accounts/schema.ts`，已生成 SQL 必须审阅，迁移专用角色运行，不能在 HTTP 请求／每次冷启动执行 DDL。升级使用 expand→兼容代码→回填验证→contract；回滚代码不 drop 个人数据。它与根规格本地 `003-template-scene.ts` 是独立迁移序列，不创建第二个 local store。

## 6. 用户显式转入／转出

### 6.1 本地／文件转云

1. 在 `/account/sync` 点「选择本地样式」才通过客户端 repository 读取同 origin 的 schema 3 本地库；损坏／未来版／迁移冲突先走本地恢复，不上传原文。默认全不勾选，提示「此浏览器资料由本机 profile 共享，请只选择你有权同步的样式」。预览用中性示例，不触碰源图预览的截图。
2. 文件选择仅在浏览器解析 V2 `{app:'picwiz',type:'style-presets',version:1,presets:[{name,style:Look}]}`，≤100 KiB、1–24 项；完整校验后转换为 nameLook。原始文件、文件名／路径、raw string、local-data-backup、Scene 或带 size 的 style 都不能发给服务器。云输入只包含经用户选定的 DTO，不依赖服务端删除禁用字段。
3. 从当前云全量快照＋选择项在客户端生成确定性计划，展示每项「新增／跳过／保留两份的最终名」，配额变化与内容。确认前零业务写入；取消不产生回执或账户数据。若本地读取 await 后三键／workspaceEpoch 变化，整份选择和计划失效，重读／重新确认。
4. 同名同 Look 跳过；同名异 Look **默认保留两份**，按下述算法给后缀。初期批量导入没有 overwrite 选项；要覆盖必须在对应云记录的编辑／CAS 流程里逐条确认。导入内部相同条目也去重。不同名称同 Look 允许作为不同预设，不做意外跨名称合并。
5. 确认提交包含 `expectedLibraryVersion` 和逐项 `{index,nameLook,decision:'add'|'skip',resolvedName}`。index 为 0..n-1 连续整数；resolvedName／decision 来自预览，但服务器必须锁 owner 后自行重新计算并逐项比对，不能信任它们。数据不同或库已改变返回 409 `preview_stale`，零部分写入，重取并重新确认；不能自行改名后悄悄提交用户没看过的计划。
6. 成功返回新增／跳过／改名计数、输入 index→云 UUID／version 的元数据映射及 libraryVersion；然后刷新当前云列表，仍核对会话 epoch。不修改／删除本地原记录，不设置「以后自动同步」。24 满库若全部 skip 仍成功；含一个超额新增则整批 409。

确定性名称算法复用 V2 语义：从原规范 name 开始，依次尝试原名、` (2)`…` (25)`。每个候选先按 `40-后缀UTF16长度` 截断原名、避免切断 surrogate、trimEnd，再附后缀；用 nameKey 查当前 owner 和已暂存本批记录。同候选同 Look 即 skip，异 Look 继续；第一个空位 add。最多只有 24 个活跃名，故 25 个候选足够，禁止无限循环。重复导入在内容未变化时找到相同候选并 skip，不反复增加 `(3)`。测试必须包括 40 单位名称和 surrogate 截断。

### 6.2 云 Look 应用与另存本地

「应用到本地编辑器」先显示中性外观和将改变的六项，确认后仅向**客户端** repository 调用 `applyLookToCurrentWorkspace(look,expectedWorkspaceEpoch)`。repository 读取／校验当前 v3，在本地合并 Look 并保存完整合法 envelope，保留 source、annotations、scene、size／scale、presets、jobs 等所有其他字段；该本地 envelope 从不作为 Action 参数。既有截图／模板预览由编辑器本地生成。不得将云 DTO spread 到 composition。

只有点「另存到此浏览器」才复制云名称＋Look 为本地预设，产生新的本地 ID／本地时间，沿本地 24 配额和确认后的同名规则；不把云 UUID／账户标识塞入 shared store。应用后的 Look 属于本地 workspace，因此退出不会撤销已明确应用的外观；这不等于保留云列表缓存。

本地读取／写入同时比较 `shinyshot:store`、`picwiz:pre-v3`、`picwiz:store` 三个 raw snapshot；任一 StorageEvent（含 key=null）、清空、换图、模板应用／恢复或 epoch 变化均使待应用回调失效。storage_conflict／quota／不可用时零静默覆盖，显示「未保存到本地」，可下载外观 JSON，不能声称云操作可恢复未保存的截图。库／迁移细节完全服从根规格第 5 节。

### 6.3 外观文件导出的空库合同

`GET /api/account/export?format=presets` 在身份／实例绑定／active owner／近期重验全部通过后，从同一一致快照读有效预设及计数。1–24项才返回200 `application/json`附件，固定文件名，内容严格为V2 `style-presets` version 1；**0项必须返回真实HTTP 422**，body精确为 `{ok:false,status:422,code:'preset_empty',requestId}` 的JSON，`Content-Type: application/json`、私人no-store，**无 Content-Disposition／附件／空文件**。不得输出 `presets:[]` 冒充可导入V2 bundle，也不得改变V2导入器的1–24项约束或自动塞入内置预设。空库可发生在刚建库、删除最后一项或恢复后，均走相同服务端判断；UI已显示1项但并发删空也必须得到422。

云库为0时显示「云端还没有外观预设；保存至少一个后才能导出外观文件。账户数据包仍可导出。」外观导出使用原生 `<button disabled>`，旁边保留可读解释并以 aria-describedby 关联，不能只降透明度／拦click；读取中也禁用，刷新到≥1项才启用。绕过按钮直接请求仍按上条422处理。客户端收到422显示空库说明、刷新列表，不创建下载Blob、不把它当网络故障重试。

`format=account` 是独立的版本化账户资料包：已有active映射但有效项为0时，仍200附件，记录 activeCount=0、空云记录数组及必要账户元数据；不以V2外观文件格式包装。未初始化身份的隐私页说明没有云库，无须为删除而初始化或导出；普通导出仍返回403 `account_uninitialized`。这些规则不修改本地V1／V2文件及根规格raw备份合同。

## 7. 幂等、CAS、删除预设与同步范围

### 操作 envelope

普通写入精确为 `{operationId,requestedAt,contextTag,...该Action字段}`；`operationId` 为浏览器本次确认生成的 UUIDv4，`requestedAt` 为规范 UTC Z。首次未见的操作只接受距服务器时间≤24h且未来≤5min，过期返回 409 `operation_expired`；它不是认证时钟来源。相同操作的自动重试绝不更换这些值或输入。

锁 owner 后先查 `(owner_id,operation_id)`：同 kind／规范业务输入 HMAC hash 返回已提交的**原元数据**；异 payload 409 `idempotency_mismatch`，不能覆盖旧回执。hash 包含 requestedAt、kind、id／expectedVersion、nameLook／完整有序计划等语义输入，排除 transport、contextTag、重试次数；hash key version 随回执保留。先做当前认证／状态／context 校验再返回回执，不能跨 owner／删号后读旧结果。

新操作在同一个 PostgreSQL 事务提交预设变化、quota／版本和回执；失败全回滚，不缓存成功或把 409 记为已提交。回执最多 30 天；同请求在保留窗内即使超过 24h也只重放元数据，绝不再变更。回执到期后旧 requestedAt 必然过期，不能因回执删除重新执行旧 create。用户显式重新预览／确认才能建立新操作。元数据回执不返回已删除旧名称／Look；最新内容另走已授权快照。

### 并发与预设删除

- Update／rename 必带完整 nameLook 和 expectedVersion；只有活跃 owner＋id＋version 命中才更新并 version+1。对不存在／他人的 ID 统一 404，无「此 ID 属于别人」；对本人有效但版本错 409 `version_conflict`，只返回本人的最新 DTO。不能按客户端 updatedAt 选赢家。
- 冲突 UI 并列本次草稿／云当前值，默认保留云端，允许「重新载入」「另存副本」「以当前版本再次确认覆盖」。覆盖形成新操作并带最新版本；再次被修改仍 409。草稿仅内存；不得悄悄 LWW 或无限自动重试 409。
- Delete 正常命中时 version+1、设置 deleted_at／updated_at，清 NULL 名称／Look，递增 library_version 并写回执。空位立即释放。客户端取消已发出的请求不代表事务回滚。
- 同操作 ID 重复返回原成功；同 owner 的既有 tombstone 遇到新的 delete 操作返回 200 `alreadyDeleted:true`、现 tombstone version，不改变版本／配额，但写幂等回执。未知／跨 owner ID 404。tombstone 30 天后清理，新 delete 返回 404；旧成功回执若仍存在仍可重放。Update 永不复活 tombstone，create 只生成新 ID，不接受客户端指定 ID。

### 小库全量合同

首期只用≤24 项**一致全量快照**与单调 libraryVersion，无分页／历史内容／delta feed／SyncRevision 内容日志。在同一只读一致快照中读取用户高水位及 active 项；不能分别查询造成版本和列表不一致。服务器 libraryVersion 从不因 tombstone／回执清理归零。

客户端只在同一个 session epoch 内比较 libraryVersion。旧请求得到较低版本则丢弃并重新读；没有自动把旧草稿当新建。刷新可带 `knownLibraryVersion`：等于当前版本返回完整当前快照；不等于当前版本（含大于服务器）返回 `409 resync_required`，客户端清旧云快照，再不带 knownLibraryVersion 取全量。服务端从不接受基于旧版本自动推送内容。本期不签发增量游标，也不把版本数字当能恢复历史的游标；任何旧会话／不兼容客户端保存的同步进度都失效并重取全量，满足根规格的过期同步进度处理要求。

读／正常写入总请求截止≤15 秒，浏览器等待≤20 秒；同 epoch 暂态网络／503 最多自动额外重试 2 次（1 秒、3 秒，±20% jitter，429 尊重 Retry-After）。超时标「结果待确认」，可用相同 op ID 重试／刷新；不得显示已失败并偷偷换 ID 再 create。401／403／404／409／422 不自动重试。离线没有新云发送，草稿仅内存，可显式导出外观文件；页面关闭、session 变化即丢弃，不写任何持久云队列。

## 8. 会话、退出、多页签与错误状态

客户端 `sessionEpoch` 是每次建立云会话上下文生成的随机代次；与 root 的 `workspaceEpoch` 分离。每个异步读取／确认／提交／应用本地都捕获 `{contextTag,sessionEpoch,workspaceEpoch?}`，**每次 await 后、更新 UI／发写入前再核对**。变化先中止 fetch、丢弃回调、清所有云列表／名称／草稿／计划／选中项／导出 Blob，再核对服务器；不能只在 promise 开始时判断一次。

| 状态／错误 | 精确行为 |
| --- | --- |
| `signed-out` | 本地区域照常；打开账户才显示登录。云写入 401，不暗中初始化。 |
| `signing-in` | 托管 UI loading／邮件／错误／重试；可取消。没完成 verified session 不提供业务权限。 |
| `active-uninitialized` | 身份已验证、无应用映射；可选择建空库、继续本地，或直接重验后删除身份并取回执。删除创建的最小映射直接deleting且 library_initialized_at=NULL，永不经过active、不读取profile／上传／默认导入。 |
| `active` | 云同步与本地存储区明确区分，显示已提交／未同步／等待确认，不用登录图标表示保存成功。 |
| `session_expired/revoked`，401 | 停止云写、epoch 失效并清云内存；本地截图／模板／导出不变。重新登录后重新取全量、重新选择确认，不重放旧操作。 |
| `forbidden`，403 | disabled／deleting 或近期重验要求；前两者清云区且不展示数据，后者由 SDK 默认弹层处理。不得对每个 403 无限引导登录。 |
| `not_found`，404 | 未知／他人／已不可读 ID 使用相同错误，无 owner、名称、version 或总数侧漏。 |
| `account_changed`，409 | 当前 Cookie 与用户确认的上下文不同；整份请求拒绝，清旧云 UI，重新加载本人内容。 |
| 422 `preset_empty` | 当前云库0项；说明并禁用外观文件导出，不生成附件，账户包仍可导出；保存／刷新到1项后恢复按钮。 |
| 429／503／timeout | 明确 Retry-After／稍后重试／结果待确认；实例未核验时全体云写／删除关闭，不能以404误清资料；不把失败记为已同步，不影响本地。 |

**退出流程：** 有未提交草稿先提示导出外观／取消退出／丢弃并退出；用户确认后立即锁云区、递增 sessionEpoch、清缓存、广播失效，再调用官方 `signOut()` 撤销当前会话。成功才显示「已退出」并完整导航 `/`；SDK 超时仍锁云区，显示「退出尚未确认」，提供显式重试，不能只删 JS Cookie 后宣称撤销。每次业务请求实时 BAPI 检查，故撤销后新请求被拒；已通过检查的在途事务可能完成，UI 丢弃它，下一次本人登录重新读确认。全设备退出不在首期 UI；删号另行禁止整个主体。

多页签通过 `BroadcastChannel('picwiz:account-state')` 广播**无秘密** `{type:'invalidate',nonce}`；fallback 只写不含身份内容的随机 invalidation key，以 storage event 通知，不写 token／云缓存。收到退出、换号、删除信号先失效 epoch；广播不作为身份权威。账户页 focus／pageshow（含 BFCache）立即遮蔽旧私人内容并复核服务器；可见账户页每 60 秒只做会话／快照只读刷新，隐藏时暂停，失败停止显示私人数据。Clerk 自身事件也触发失效，不依赖每个标签总能收到广播。恢复网络不自动重放旧请求。

退出不会清空 profile 的截图、本地预设或已应用外观，B 登录后仍可能看见 A 用过的本地资料；页面必须直说。独立按钮「退出并清除此设备」在确认后先使所有本地／云回调失效，再按 root 合同清 `shinyshot:store→picwiz:pre-v3→picwiz:store` 并读回验证。报告「会话退出」「三键清空」两个结果，部分失败禁止保存，不可显示整体成功。删除云账户也不能遥控其他浏览器、下载文件、剪贴板或 OS profile；清本地不能删除云数据。

## 9. 删除、真实 worker、事件及恢复

### 9.1 应用删除事务和回执

**入口不要求启用同步。** 注册→进入active-uninitialized→拒绝建库→在账户／隐私页点「删除账户与登录身份」→托管近期重验→确认→取得删除回执，是完整支持的流程。已建库时确认列明：立即禁用本主体云访问、删除名称／Look、异步删除Clerk身份；未建库时改为「你未启用云端样式库。为完成身份删除、重试和确认结果，我们会保存必要的删除记录；这不会启用云同步或读取此浏览器资料。」两者均说明本地三个键／下载保留、最小记录及备份保留期。有云库可先导出；未建库不以导出为前置。删除提交后不提供撤销或复活。

Action精确输入为 `{operationId,requestedAt,contextTag,confirm:'delete-cloud-account',receiptToken}`，拒绝额外键；contextTag为第4.1节account-delete用途。浏览器本次确认生成UUIDv4 operationId、规范UTC requestedAt及32字节随机receiptToken（无padding base64url，43字符）。托管重验自动重试保持全部输入不变、复核sessionEpoch／当前Cookie；第一因子≤5min＋显式确认缺一拒绝，不调用initializeAccountAction。参数只留页签内存，不放URL／日志；服务器严格解码后仅存token的SHA-256。删除回执ID等于operationId，只授最小进度查询。确认页一开始就可明确下载含receiptId／receiptToken的凭据；未提交时查状态为404，提交后沿同一凭据确认，下载不自动发送或重放删除。

服务器依次执行同源／大小／DTO／入口IP限流、`requireClerkIdentity()`（含当前实例绑定）、已验证subject限流、近期重验，再进入受控事务。**不调用先要求active owner的普通repository wrapper**。事务按subject advisory lock→已有owner行锁顺序，查当前及保留旧HMAC版本的subject ledger／映射，并核对操作ID：

1. **已提交同一用户操作：** subject／owner／operationId、原token摘要、request hash都相符时，返回同一202、`{receiptId,state}`，不再清资料／改变epoch／入第二job，也不要求已被本次删除改变的active或旧contextTag。request hash以固定编码覆盖kind=`delete-account`、operationId、requestedAt、confirm及token摘要，排除contextTag／transport；hash key随ledger保留。错token／改payload／ID冲突统一409 `idempotency_mismatch`，不泄露别人的记录；同subject的另一操作遇删除屏障403，不换ID重建。此分支仍需本次有效身份及近期重验；身份已消失用下述状态Handler。
2. **首次未见操作：** requestedAt接受窗同第7节（过去≤24h、未来≤5min），检查当前subject无删除屏障，并按锁内现状恒时验证account-delete tag。若无映射，直接插入一个服务器UUID的application_user：`state=deleting,library_initialized_at=NULL,library_version=0,auth_epoch=1,clerk_subject=已验证subject,deleted_at=NULL`，时间取DB并写subject摘要；**不插active行、不建立库、不插预设或普通operation**。若已有active／disabled映射，则转deleting、auth_epoch+1，清该owner全部cloud_preset／cloud_operation、library_version+1，保留原library_initialized_at。首次请求已是deleting／deleted或ledger已存在则403；初始化赢锁使原未初始化tag过时则409、零删除写入，需用户重看当前状态并确认。
3. 以该owner UUID创建origin=user、state=pending的account_deletion，写token／request摘要及key version；`requested_at=DB接受时间,attempt_cycle=1,attempt_count=0,cycle_started_at=requested_at,last_attempt_at=NULL`，provider确认／completed／purge时间为NULL。客户端requestedAt仅作为接受窗及request hash输入，不决定作业起点。通过pg-boss官方Drizzle transaction adapter **在同一DB事务**提交唯一 `clerk.delete-user` job，payload仅`{deletionId,ownerId}`。两种起点均使用此worker合同，不存在owner缺失而无法消费的用户请求。提交前再次确认实例代次仍获准；任一步／入队失败全回滚（包括新建的最小映射），503、无虚假回执成功。

提交后才返回202；UI立即失效云sessionEpoch／缓存并广播，显示「删除处理中」及凭据下载，不把202说成身份已删除。原页面可用已有receiptId／token向状态Handler查pending／blocked_external／completed；该Handler不要求Clerk身份或初始化。响应丢失时先查此凭据，200即继续原任务；404可能尚未提交／在途／凭据无效／到期，不能自动换ID，身份仍有效时只可同输入有界重试。Clerk已删、会话撤销或重验失败则不再发送删除Action，仍可用原凭据查状态。凭据仅放内存或用户主动下载，丢失不能凭可猜邮箱／ID恢复；超过24h且无已提交ledger的旧请求不能新执行。

初始化、此删除、provider事件及可靠404清理共用subject锁和单向屏障：删除先提交后，旧bootstrap Action、重复注册事件、晚到初始化／上传都403／忽略，不能补library_initialized_at或复活active；初始化先完成则删除需按当前UUID重新确认。`disabled`仍可经未被Clerk禁用且近期验证的会话删除；provider banned使重验不可用时走核实后的受控隐私CLI，使用相同屏障／队列，不能新增公开绕过。worker失败不解除屏障；最小映射随正常删除ledger／UUID保留规则清理，不形成另一个云同步注册入口。

### 9.2 持久任务系统

采用 **pg-boss＋独立常驻 Node worker**；本轮不安装。pg-boss 是真实 PostgreSQL job 系统，支持 transaction adapter、退避、dead-letter 和 lease；不自写请求内 Promise、`after()`／`waitUntil()`、内存 setTimeout 或无限轮询充当 durable worker。其内部可能轮询由库管理，不等于实现手写无界循环。[官方说明](https://pgboss.io/)（核验 2026-10-23，所见版本 12.38.0；实施另锁兼容版本）。

| Job／定时任务 | 有界工作、重试和结果 |
| --- | --- |
| `clerk.delete-user` | 同 deletionId 单例，重读ledger及owner（含未建库的deleting最小映射），completed则退出。外部调用／终态提交前均须通过2.4当前实例绑定，DB事务外用同一client调用 `users.deleteUser(subject)`，再以同代次getUser确认。只有已绑定真实404才可确认不存在；成功响应后DB提交丢失，重领再查也同结果。未核验／mismatch／API401／403绝不调用deleteUser或以404标完成，不新增本地内容清除；保持原pending屏障或blocked，修复后redrive。 |
| `clerk.reconcile-user` | 已知owner单例，通过2.4实例绑定才实时getUser；存在仅确认provider状态，已绑定真实404才走相同subject锁／删除屏障／内容清理。未核验或错误live实例404零清除／零终态；pending／blocked的既有删除只观察，不恢复active。active／disabled库的banned／locked使disabled、auth_epoch+1；最小deleting映射保持deleting，不补建库时间。解除禁止不得由旧update自动恢复，需当前BAPI证据＋受控运维操作；不从metadata导入owner／Look。 |
| `accounts.reconcile-sweep` | 每日00:15 UTC，先通过2.4当前代次准入才派发；按UUID keyset分页，每批≤100，持久continuation，每次≤1,000 owner／60秒，余下交后续job；扫描所有非deleted映射，含deleting最小映射，给每个owner入单例reconcile，消费者也独立检查自身代次。准入失败不推进coverage水位，保留待办／有界重试／告警。要求正常状态24h内完整覆盖，容量不足须增加受控吞吐／调频并验收，不静默漏尾部。 |
| `accounts.retention` | 每日 01:15 UTC，分批≤500 清到期 receipt／tombstone／event／rate bucket／完成 job 和满足屏障条件的 deletion ledger；每 job≤60 秒，明确 continuation。不得批量扫掉 pending 删除或重置高水位。 |

实例核验截止3秒，其他worker外部调用截止5秒；worker并发初始2、正常作业lease60秒、库负责崩溃后重领。删除每个自动尝试周期最多 **12次总尝试、最长24h窗口**，指数退避（30秒起、上限1h、jitter，429尊重Retry-After）；任一上限先到即dead-letter＋blocked_external，保留屏障并告警。`account_deletion`另有 `attempt_cycle integer DEFAULT 1 CHECK>=1`、`attempt_count integer DEFAULT 0 CHECK BETWEEN 0 AND 12`、`cycle_started_at timestamptz`、`last_attempt_at timestamptz NULL`；每次开始核验／外部工作前持锁提交计数，准入失败／崩溃也计尝试，不能靠失败未调用deleteUser或库重领重置计数。reconcile／sweep暂态失败也沿同12次／24h上限进入自己的dead-letter；没有ledger时不为运维故障伪造用户删除记录。永久配置错误直接blocked／dead-letter；运维修复后显式redrive，删除沿同deletionId增加cycle、重置计数／起点并审计，只有一个有效job，不能新建账户。禁止无限sweep重入队绕过上限。每日reconcile只观察pending／blocked，不擅自重启失败删除；当前已绑定实例证实provider已删才可幂等完成。

worker在当前已绑定代次确认外部身份不存在后，按subject→owner锁的事务将application_user改deleted、清raw clerk_subject并写deleted_at，ledger标completed；保留UUID／摘要／必要生命周期时间，最小映射的library_initialized_at始终NULL、library_version=0，不能借完成删除初始化库。UI只能说「活跃云数据库和Clerk身份删除已确认；供应商备份／法定记录另按政策」，不声称所有副本物理抹除。删除目标24h，超时显示pending／blocked，是运维目标而非供应商SLA。普通预设CRUD／本地应用／导入不使用队列。

### 9.3 签名 webhook、重复与乱序

仅订阅本期需要的 `user.deleted`、`user.updated`；`user.created` 若误送也验证并忽略，**永不 upsert 应用账户**。`user.updated` 只给已知映射入 reconcile job，不直接相信旧 payload 的禁用／邮箱状态；未知 subject 不建立用户。`session.*` 不作为会话授权依据，不需复制所有 session 事件。

`POST /api/webhooks/clerk` 使用 `verifyWebhook(request)` from `@clerk/nextjs/webhooks`，消费未经JSON重编码的原始body，验证 `svix-id`／`svix-timestamp`／`svix-signature`；不用session token、IP allowlist或body的instance_id代替签名。采用锁定verifier有效时间窗，目标±5min且有边界测试，不放宽以接受旧录包。签名通过后校验schema、`instance_id===CLERK_EXPECTED_INSTANCE_ID`、ID／event timestamp；**再经2.4当前BAPI代次绑定门**，才允许事件receipt／删除清理／后续入队，门故障503零事务提交，让供应商重投（重投耗尽须人工受控重放／sweep恢复）。错误事件instance为400；不能因签名来自正确实例就信任另一个live实例BAPI的404。Clerk重投签名时间与事件时间不同，不因event_at老拒绝合法新投递。[Webhook验证](https://clerk.com/docs/reference/backend/verify-webhook)、[Next同步指南](https://clerk.com/docs/guides/development/webhooks/syncing)（核验2026-10-23）。

在同一事务锁 subject／owner 后插入唯一 event receipt：

- `user.deleted` 是单向终态证据。立即建立或复用最小 subject 删除 ledger，锁定／清本人业务记录；已知映射转 deleted 并 auth_epoch+1，移除 raw subject；标 provider confirmed，无需再向已删 provider 发删除任务。未知映射也保留 subject 摘要屏障37天，避免与首次初始化竞态。若本应用已有删除 job，ledger 完成后 job 重领即 no-op。
- `user.updated` 原子写receipt＋真实reconcile job；若ledger已在pending／blocked_external／completed，直接ignored，不能转active或绕过失败重试上限。相同event ID／同hash返回204，无重复入队；同ID异hash拒绝告警。并发删除与初始化按subject屏障锁串行化，不能只各查一次不存在就插入。
- 不用「最后收到的事件」或单纯事件时间做复活判断。deleting／deleted 单向推进；晚到的 created／updated、旧快照、补投均不能清屏障。生命周期不可逆时无需把旧 profile 完整复制到 DB。

官方明确webhook非同步注册屏障，可能丢失、重复、乱序且重试有穷，故有实时BAPI检查＋每日全量对账。[投递语义](https://clerk.com/docs/guides/development/webhooks/overview)（核验2026-10-23）。漏user.deleted时，业务请求的**已绑定getUser真实404**触发相同subject锁／可靠清理，或由完整sweep发现；不把未绑定／错误live实例的404、session404、401／403、超时／429解释成用户已删。部署门关闭期间不承诺24h发现，积压／coverage告警保留，修复后恢复对账。

### 9.4 保留、备份与恢复

| 数据 | 应用控制的保留合同 |
| --- | --- |
| 活跃名称／Look | 保存至显式删除；无内容版本历史。预设删除当次事务清内容，tombstone 元数据30天。删号当次事务清全部业务内容。 |
| 普通操作／event receipt | 30天，只留摘要及有界元数据。无请求正文。过期旧操作不得重新执行。 |
| subject 映射 | 已建库者为账户存续期；未建库删除只在显式请求时直接存deleting最小映射。删除期间只为外部删除／对账保留；provider确认后清raw subject，最小映射不补library_initialized_at。Clerk邮箱不复制为业务永久字段。 |
| 删除 ledger／deleted UUID | 外部删除未确认期间持续保留并告警，不虚报完成；确认后至少37天，且必须覆盖所有含该用户的应用备份到期＋7天。正常备份窗口≤30天时约37天；例外延长须登记、最小化字段及原因。满足条件后才清 ledger／mapping tombstone。 |
| queue | 成功 job≤7天；dead-letter 的不含内容诊断≤30天；未解决删除的最小 ledger 不随 job 清理。业务重复保护不依赖短期 job 历史。 |
| 限流／应用日志 | bucket≤24h；普通应用日志7天，规范安全拒绝记录最长30天；不留邮箱、body、原始IP、JWT、名称／Look。供应商／主机记录另核实，不套用这些期限。 |
| 本地三键／下载 | root 第5节：profile 自己控制，备份键不自动过期；删除云账户不自动删除它们。 |

默认应用 DB 每日加密备份，任何可恢复快照／PITR／独立归档总窗口≤30天；选定供应商实际只有7天则如实写7天，不能因本规格写30就宣称已经购买30天。目标 RPO≤24h、RTO≤1工作日，季度隔离恢复演练后才可对外承诺目标。不可变备份不能逐条即时删除；正常轮换至到期，自管备份地区／访问／密钥另列。

最小删除ledger必须有**独立于待恢复业务快照的受限、加密、可验证连续性副本**，包括未建库身份的删除。恢复步骤：隔离恢复→禁用云入口／旧会话上下文→校验最新ledger覆盖水位→核验2.4新BAPI代次／部署身份绑定→重放所有删除屏障并清旧数据／任务→逐映射BAPI对账→验证RLS／幂等／queue→开启。绑定未证实前不执行恢复清除或外部删除；不能恢复到删前快照就开放登录。ledger覆盖／实例绑定任一无法证明，保持云关闭并人工对账，本地仍可用。备份目录禁止恢复过期快照。

旧 webhook 从不创建映射；ledger 合法到期后即使收到旧 created／updated 仍不能重建。被删除 subject 如果因供应商恢复重新出现，也不能映射旧应用 UUID／恢复旧内容；只能在当前有效身份和**显式创建全新空库**的动作下重新注册（且仍不得处于未解决屏障）。供应商变更／迁移也不凭邮箱复用 owner。恢复运维必须纳入身份恢复事件，不能假定 provider 永远不会恢复旧用户。

**Clerk 保留限制：** `deleteUser`／`user.deleted` 证明接口和活跃身份状态，不能证明其所有备份、反滥用／投递日志物理擦除。所读 [Clerk DPA 第9节](https://clerk.com/legal/dpa)（文档标注2024-11-26，核验2026-10-23）的90天针对**合同终止／到期**，不是每次个人删号后90天、也不是 PicWiz 可承诺的30天。上线前必须记录适用合同、个人用户删除／备份滚动期限、处理地区和例外；没有官方明确上限时写「供应商未提供可验证上限」，走合同确认并如实披露，禁止虚构擦除 SLA。这是上线配置／隐私门槛，不阻挡本轮 SPEC 或本地 fake 实现。

## 10. CSRF、缓存、CSP 与信任边界

### 同源入口与缓存

1. 浏览器业务 mutation 仅同源 HTTPS POST。保留 Next 自带 Origin／Host 校验，并在 Action／删除状态 Handler 明确要求 `Origin===APP_ORIGIN`；缺失／null／不匹配403。若有 Sec-Fetch-Site，必须 same-origin，缺失时仍需精确 Origin。反向代理重写并只信任自身转发的 host／proto，拒绝客户端自带伪造 forwarded header。`allowedOrigins` 不写 wildcard；正常同源无需额外放行。Clerk FAPI 请求／webhook 属于各自 SDK／签名协议，不能误套浏览器 Origin 拒绝它们。
2. Action 接受 React／Next 标准 transport 的必要 Content-Type，而非错误强制所有 Action application/json；严格验证反序列化参数、字段及字节上限，拒绝文件。JSON Handler 只收 `application/json`，其他415，过大413，语法400、业务字段422。webhook按官方原文 JSON 验签。SameSite、contextTag 和隐藏按钮都不替代 CSRF／身份校验。
3. 私人 RSC／Action／导出／状态 Handler、任何 Set-Cookie 响应统一 `Cache-Control: private, no-store, max-age=0`；托管 CDN 明确 bypass，不设 ISR／共享 `use cache`／跨请求 React cache／持久 fetch 缓存，不把完整 DTO 闭包捕获到客户端。公共页面不读身份故可静态缓存。Vary 只作辅助，不把 Vary:Cookie 当 no-store 替代。
4. 退出／换号完整文档导航并失效页内 router／query 缓存；pageshow 复核处理 BFCache。返回键、prefetch、并发 RSC、Action 的附带重渲染都不得在错误主体下显示旧数据。私人数据响应无 ETag／304 复用，不进入 service worker／离线缓存。
5. return URL 不收任意 URL／用户路径；登录／注册固定 `/account`，退出固定 `/`；路径跳转只能用内置枚举。拒绝协议相对、跨域、编码绕过和不受控 `redirect_url`。Dashboard redirect allowlist、SDK force redirect 和 APP_ORIGIN 同步配置，禁 satellite。

### 账户专用 CSP

用 `F` 表示**经发布检查解析为单一 HTTPS origin 的本环境 FAPI host**，不是任意请求参数；生产如已配置的自有认证子域，测试为独立 accounts.dev 实例。不在文档填写虚构域名／key。根规格的「禁止 *」指不使用裸全域 `*`；Clerk 当前必要的受限 Protect 后缀／端口模式如下，必须在上线安全清单单独记录，不能误写为全部精确单 host。

账户 HTML 的完整 CSP 最低合同：

```text
default-src 'self';
script-src 'self' 'nonce-{每请求随机N}' F https://challenges.cloudflare.com https://*.protect.clerk.com;
connect-src 'self' F https://*.protect.clerk.com:*;
img-src 'self' data: blob: https://img.clerk.com;
font-src 'self';
style-src 'self' 'unsafe-inline';
worker-src 'self' blob:;
frame-src https://challenges.cloudflare.com https://*.protect.clerk.com;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
```

`F`／nonce 在实现时替换，不能把上述占位文本当部署配置。生产不加 script `unsafe-eval`／全局 `http:`／`https:`，不因自动 CSP helper 默认包含 Stripe、Maps、telemetry 就全部放行。账户 nonce 必须覆盖 Next inline bootstrap 和 Provider／SDK 插入的必要脚本；该路由按请求动态渲染，禁止用静态 nonce。若锁定 SDK 需要额外 loader host，先用官方域证据和测试更新精确清单，不以宽泛 wildcard 修好。development 的 websocket／unsafe-eval 只限非生产。account 之外保持原本同源策略，不添加 Clerk 域；避免同时发送互相冲突的两份 CSP。

官方现行 CSP 要求包含 FAPI、Cloudflare challenge、`*.protect.clerk.com`，connect 特别需要 `:*`，样式需要 unsafe-inline；这些不可省略后宣称登录经过真实验证。[Clerk CSP](https://clerk.com/docs/guides/secure/best-practices/csp-headers)（核验2026-10-23）。这是一项明确的第三方信任取舍；不是允许其他任意域。SDK／CSP helper 升级必须做真实登录／重验的 Report-Only 观察后再 enforcement，不能让 root 的静态壳整体变动态。

保留 `nosniff`、`Referrer-Policy:no-referrer`、`X-Frame-Options:DENY`、最小 Permissions-Policy，HTTPS／HSTS 由正式主机按已控制子域配置。禁 analytics／session replay／错误截图。客户端和服务端分别设 `NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED=1`、`CLERK_TELEMETRY_DISABLED=1` 并验网络；不把遥测 opt-out 当关闭认证必需的反滥用请求。[环境变量](https://clerk.com/docs/guides/development/clerk-environment-variables)（核验2026-10-23）。

### 第三方脚本能力与「无截图上传」

本地工作区和账户页同 origin；进入账户页后执行的 Clerk SDK 可以拥有同 origin 脚本能力，包括读取 localStorage、DOM 和调用网络。**Provider 深度、CSP 或「不传 source prop」不能从密码学上阻止已获执行权的第三方 SDK 读到原图。**本设计保证的是 PicWiz 不构造／发送图片、注释、文件／原始备份载荷，编辑器／图库／lab 不加载 Clerk，并以网络验收检查实测行为；不能保证供应链被攻陷时仍零读取／零外泄。需要更强隔离须另设独立 origin 的认证／工作区架构，本期不暗中新增 BFF 或 iframe。

服务商必然处理登录邮箱、必要 IP／浏览器／会话及反滥用信息；不声称关闭 telemetry 即完全没有外部个人数据处理。页面、README、隐私说明发布时要删除「没有账户／没有云预设」绝对文案，保留并准确表达「截图由本地处理；仅在确认后同步所选样式」。日志禁 body／Cookie／Authorization／webhook 原文／名称／Look，监控使用 requestId／jobId／规范错误码；主机、Clerk、队列库自身日志配置另行验收。

## 11. 配置、费用、许可与运营门槛

本节是未来部署清单，**不要求现在提供秘密、建资源或采购**。缺值不阻挡 SPEC／本地 fake 开发；禁止在真实账户上线时仍空白。

| 配置 | 可公开性及用途 |
| --- | --- |
| `APP_ORIGIN`、`CLERK_EXPECTED_INSTANCE_ID`（应用自定）、FAPI host／issuer／环境类型／部署配置版本 | 非秘密，按2.4从所选实例独立固定成清单；redirect／authorizedParties／Origin／CSP一致，不从请求Host或候选secret的响应推导expected ID；preview使用独立测试实例。secret与任一配置／client重建产生新代次，核验ID与部署清单后才准入。 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 公共配置，只编码定位实例，不是服务器授权密钥；生产必须 live，测试必须 test，禁止混用。 |
| `CLERK_SECRET_KEY` | 只在服务器／受限worker secret manager；凭据版本与不可变client代次绑定，用该client的instances.get核验expected ID；不以live前缀或BAPI成功作证明。不记录key／派生指纹；可行时最小化密钥能力／网络，记录不可细分权限风险。 |
| `CLERK_WEBHOOK_SIGNING_SECRET` | 仅验签服务器，独立环境；轮换按官方重叠签名机制验收，不能当 Clerk API key。 |
| `DATABASE_URL`／`WORKER_DATABASE_URL`／`MIGRATION_DATABASE_URL`（后两者应用命名） | 分角色、TLS、池上限；迁移凭据不进请求 runtime；worker 管 pg-boss 的版本权限单独审阅。 |
| `ACCOUNT_HMAC_KEY_VERSION`／受控历史 key 引用（应用命名） | context、subject digest、request hash／rate bucket 各加用途前缀或独立派生密钥；server-only。旧 key 保留到相关 receipt／ledger 过期，不能轮换后失去删除屏障。 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 多实例部署一致性所需的框架密钥，不能代替业务签名／授权；按安装版指南生成／轮换，绝不写样例秘密。 |
| telemetry 禁用、备份／ledger 引用、账户功能开关 | 禁遥测实际生效；账户不可用只禁账户区，liveness不伪报深层健康。生产禁止 fake auth header／测试 verifier。 |

上线填报应用计算、DB、备份／ledger、Clerk 身份／认证邮件／反滥用／日志／支持访问各自地区与跨境安排；不能由用户时区推断，更不能把数据库选 EU 当所有供应商都 EU-only。还须指定维护／告警／删除请求负责人、最大连接／任务并发、发送滥用处置、实际 session 限制、恢复目标和合同保留说明。OTP 邮件是 Clerk 所有，不另设 app OTP budget API／邮件队列；应监控 Clerk 可见用量、拒绝／投递状态和供应商额度，不虚构无限免费邮件。

费用只作核验日口径：Clerk Hobby $0、含50,000 MRU；Pro 月付$25，按年付等效$20/月；Pro 首个超额阶梯50,001–100,000为$0.02/MRU。MRU 是注册24h后回访者，不能写成注册总数或通用 MAU。更高阶梯、可配置 session／日志保留等按所选套餐复核；本规格不选择付款模块。[Clerk Pricing](https://clerk.com/pricing)（核验2026-10-23）。

预算公式为「应用托管＋托管PostgreSQL／连接池＋Clerk实际套餐／MRU＋常驻worker＋备份／ledger＋监控与运维／税费／超额」。数据库／主机未采购则不编固定总价；pg-boss共用PostgreSQL不表示worker计算免费。正式发布前填写月上限、至少50%／80%／100%用量告警及BAPI全实例预算。当前文档列生产BAPI通用1000请求/10秒、测试100/10秒，端点可另限；每业务请求getSession＋getUser、每进程／代次首次及≤5分钟到期的instances.get、重验、轮换、worker及对账都计入，失败不缓存不代表无限重试。[系统限制](https://clerk.com/docs/guides/how-clerk-works/system-limits)（核验2026-10-23）。

许可：Clerk JavaScript SDK 为 [MIT](https://github.com/clerk/javascript/blob/main/LICENSE)，Drizzle ORM 为 [Apache-2.0](https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE)，pg-boss 为 [MIT](https://github.com/timgit/pg-boss/blob/master/LICENSE)（均核验2026-10-23）。锁定依赖时复核具体版本及传递依赖 notices。SDK 开源不等于 Clerk 身份服务可完整自行托管或免费；托管服务、DPA／子处理者／价格独立生效。不复用旧 Better Auth／Resend 的价格或协议作为本路线承诺。

## 12. 验收矩阵与拟议交付位置

以下测试均**尚未实施或执行**。确定性 CI 使用真正隔离 PostgreSQL＋Clerk adapter fake；fake 只替外部 API／可控验签密钥，不跳过 requirePrincipal、owner、RLS、事务、queue 或限流。真实邮件投递／SDK／Cookie／CSP 另用 Clerk 非生产实例验收；两者不能互相冒充。隔离测试拒绝生产 URL／共享 schema，只建带随机前缀的临时库并清理，pg-boss worker 也连同一临时库。

| 编号 | 可执行 Given／When／Then 要求 |
| --- | --- |
| A01 范围／网络 | 带唯一标记的本地 source／filename／annotation／scene／backup；未进账户时执行编辑、Gallery、lab、PNG／ZIP，捕获 requests 和 bundle import：无 ClerkJS／FAPI；进账户但未选同步，无 workspace 上传；确认选中2项后仅2份 nameLook＋控制字段，body／URL／RSC／日志无标记。抓包不能只断言未调用 upload 函数。 |
| A02 DTO 对抗 | 顶层／Look 额外键、source、dataURL、File／Blob、prototype、重复key、CSS／URL、size／scale、Scene／motion、NaN／Infinity／小数／字符串数、坏Unicode、嵌套炸弹、100KiB边界＋1；必须在副作用前拒绝，DB／queue零部分记录。对2KiB／24条／128KiB transport／256KiB webhook分别测边界，错误类正确。 |
| A03 主体隔离 | 两用户 A/B 各建记录；对所有Action、刷新、导出、同名去重、计数、回执和批量猜 A UUID，B不得看到／修改A；未知和跨owner都是404。篡改owner字段422，A context随B Cookie提交409；伪造邮箱／metadata／header不得映射owner。 |
| A04 真实 SQL／RLS | runtime role直接SQL：未设context空结果／写拒绝，换owner／关联FK拒绝，连接池A→B不串号，不能DDL／TRUNCATE／BYPASSRLS／改owner；刻意漏repository的第25项也被quota trigger拒绝。用真实PG验证partial unique、Unicode约束及迁移，不用SQLite／Map替代。 |
| A05 并发／CAS | 同owner从23项同时create／import，最多24；两个不同payload同opId只有一个提交；两设备version1更新，只有一个到2，另409；rename同nameKey唯一；事务中断／死锁／锁超时无部分保存，有限重试次数可断言。 |
| A06 导入 | 原始40单位名＋异Look、后缀已占、批内重复、emoji；首次确定性新增／skip／改名与预览一致；重复导入零新增；全部skip满库成功，超容量整批失败；预览后另一页改库返回preview_stale，零写且不偷偷改计划。取消零请求。 |
| A07 幂等／删除预设 | 提交后丢响应，同ID重试返回原metadata无重复；不同payload409；保留30天后老requestedAt拒绝，不重建create；delete→update404；同op delete重放、新op tombstone alreadyDeleted、purge后404；从不复活原ID。 |
| A08 会话／CSRF | 过期／篡改／错误issuer／azp／aud／test实例／pending session／撤销／banned／BAPI429/5xx/timeout；401/403/503分清；缺Origin／null／跨域／伪forwarded拒绝；直接ActionPOST与UI同权限，default auth.protect 的404行为不能覆盖本合同。 |
| A09 会话竞态 | 暂停A列表／Action／文件读取／重验（含未初始化删除），退出并B登录或删除后释放；旧回调不显A内容、不发到B、不写本地；旧RSC／router／BFCache／多标签失效后先遮蔽复核；reverification自动重试保留原操作ID／token／输入并重验主体。A删除tag随B Cookie到达409，B零映射／ledger／job；退出前已提交可能成功可查证。 |
| A10 本地三键 | schema3带source／annots／scene／size；应用云Look只变6字段。姓名／云ID只有显式本地另存才按合同处理；任一键／key=null／清空／迁移／模板应用改变epoch使旧应用失效；清3键部分失败阻止保存，退出和clear分别报告。无账号所有权假设。 |
| A11 删除／worker崩溃 | 请求提交前／入队中／事务提交后断连接；只允许全回滚或屏障＋job均在。worker在Clerk删除后、DB确认前崩溃，重领404完成；Clerk未删而网络超时保持屏障；12次或24h停止进入死信，redrive沿同ID，不靠request进程存活。 |
| A12 webhook | 缺／坏签名、错实例、body改字节、超过时间窗／未来签名、重复投递、同eventId异body、真重投新签名但旧event_at；分别拒绝／幂等。deleted→旧created／updated不复活；并发初始化／删事件无竞态；DB／queue故障不2xx。 |
| A13 实例绑定／漏事件／恢复 | adapter fake显式模拟两个**同为live／production**实例A、B；部署pin／issuer／publishable为A，换入有效B secret：instances.get成功但id=B，即使B的getUser本会404，auth清理／无映射删除／reconcile／完整sweep／deleteUser／webhook后续／恢复均503或未开始／dead-letter，原Look／映射／provider确认时间零删除／零终态，deleteUser零调用，不仅测test/live或401/403。再测正常A整套、secret A配publishable／issuer B、错expected pin、缺id／timeout／429／401/403及部署清单不符；失败不复用旧success／不缓存用户不存在。warm成功A→轮换到B、仅配置变更、client重建、5分钟到期、轮换中的晚404、并发首次核验分别断言必须重新instances.get、同client handle、无跨代次／stale缓存；修复新代次后才可redrive。正确绑定A且确有getUser404／漏webhook时，请求或完整sweep按屏障清理；session404只401。恢复删前备份须最新独立ledger＋已绑定实例，含未建库最小映射；缺任一证明云保持关闭。覆盖备份过期／HMAC轮换／ledger合法清理，无旧UUID内容／旧job复活。全部故障置换用fake，不触碰真实live资源。 |
| A14 导出／缓存 | 建库后0项及删除最后一项后0项，format=presets均真实HTTP422、精确preset_empty JSON／no-store、无Content-Disposition／下载Blob；原生button.disabled及可读说明正确，绕UI直请求仍422。两种0项时format=account仍200合法空账户包；新增／恢复到1项后按钮启用，外观附件为V2可导入1项，最多24；显示1项后并发删空也422，绝不presets:[]。新鲜验证不足触发托管重验；跨owner／匿名拒绝；Cookie／JWT／token／他人数据不入包。CDN／RSC／Action／Attachment no-store，不304复用。 |
| A15 真实 Clerk | 两个合成邮箱用户、独立browser contexts＋共享profile换号：实际托管email_code登录／注册、错误／过期／重发、重验取消／成功、signOut撤销及Cookie标志、窄Proxy／nonceCSP、实际webhook、Dashboard删用户与漏投对账。自动测试用官方test email／Testing Token，仅非生产；至少一次真实测试邮箱送达，test token不证明生产送达。 |
| A16 回归／可用性 | 当前V2导入／迁移／预设／导出／race测试仍成立；新增三引擎关键路径、390px、键盘／focus／aria-live。账户服务停机仍可用本地PNG／ZIP；SDK失败不吞掉继续本地入口；读屏／真机／隐私模式未测单列。 |
| A17 未建库身份删除 | 注册后不调用initialize、不读本地库，账户／隐私页可直接删除；取消重验零业务写入，成功后仅一个application_user直接deleting（initialized=NULL、library_version=0、epoch=1）、一个user ledger＋一个owner UUID job，零active中间态／预设／ordinary operation／上传。清楚显示必要删除记录说明；worker用同合同删身份→deleted并清raw subject，receipt无登录可查。重验／入队／事务各故障原子回滚；同输入重复及提交后丢响应只同一receipt／job，错token／payload409，身份已消失仍凭原token查状态，不换ID重发。并发首次初始化与删除两种锁顺序：删先→bootstrap重试403、无库；初始化先→旧删除tag409、重新确认才删；与provider删事件／HMAC轮换／旧callback竞争无复活。A13的错误live key及绑定故障覆盖此独立入口、映射零创建，不要求先有owner才能授权。 |

Clerk 官方测试工具只适用于其规定的测试环境，不将测试凭据写入fixture、trace或生产构建。[测试指南](https://clerk.com/docs/guides/development/testing/overview)（核验2026-10-23）。真实 smoke 包须记录应用SHA、Next／Clerk锁版本、实例类型、配置清单、执行时间、两用户结果、网络redaction与供应商未验证项；不把V2的110／57结果当新增认证证据。

拟议实现位置：`lib/accounts/contracts.ts`（共享纯DTO／严格验证）、`lib/server/accounts/{principal,repository,schema,deletion}.ts`（server-only）、`lib/server/clerk-adapter.ts`、`lib/client/cloud-look-transfer.ts`（只调本地repository）、`app/account/{layout,page,actions}.tsx/ts` 及本节路由、`app/api/account/{export,deletion-status}/route.ts`、`app/api/webhooks/clerk/route.ts`、`workers/accounts.ts`、上列DB migrations、`tests/{unit,integration,e2e}/accounts-*`。实际文件扩展名按用途固定，不创建与已有storage/domain重复的完整工作区模型。

未来实现完成标准：A01–A14及A17确定性测试、A15真实实例与A16回归有可复现证据；三个范围隐私文案统一；真实worker／限流／删除ledger／恢复演练通过；地区／套餐／成本上限／Clerk个人删除保留限制如实填报。未通过不能发布真实账户，不把本地功能或其他工作包设为登录依赖。

**本轮文档状态：R1纠正已写入，等待父任务重新发起独立工程／产品R2评审；不自行撤销R1 NOT READY，也不声称实现或上线ready。** 本轮仅修改本SPEC，未运行上述未来测试。残余风险仍包括Clerk／同origin SDK信任、第三方保留上限、BAPI可用性／用量及删除积压；故障时保持数据和屏障、恢复后重试，不能承诺供应商不可用期间仍按24h完成删除。根规格公共CSP的受限Clerk Protect模式、pre-v3原始V1／V2备份及原文件合同保持不变。
