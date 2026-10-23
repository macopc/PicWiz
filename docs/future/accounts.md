# 可选个人账户与样式同步：产品及技术选型提案

状态：**研究完成，等待用户 D4 决策；未授权实现**。研究及官方网页访问日期：**2026-10-23**。基线：PicWiz V2，提交 `0704446`。本文只提出方案，没有安装依赖、创建服务或修改应用。

文中「事实」指本仓库现状或已查阅的官方资料；「建议」指本项目的产品/技术判断；「待确认」指用户选择、合同条款或尚未完成的验证。网页价格均为美元、税前公开价格，可能调整；购买时需复核，不能把公开起价当作生产总价或 SLA。

## 1. 结论与账户的购买理由

**建议选择 D4A：Better Auth + Drizzle + 托管 PostgreSQL，先提供可选的跨设备样式预设同步。** 为便于预算比较，数据库暂以 Supabase Pro 的单个 Micro 项目为例，仅购买其数据库/备份能力，不同时启用 Supabase Auth。登录建议为邮箱一次性验证码（OTP），暂不支持密码、社交登录、组织、团队、成员邀请或共享工作区。

账户获得的是「在另一台设备找回我主动同步的样式」，不是截图备份，也不等于付费会员。登录、开启同步和以后可能推出的云端构图保存，必须是三个独立动作。这里推荐的 HttpOnly 不透明会话是本方案的设计取舍，不是声称所有安全托管认证都必须使用同一种 Cookie 架构。没有账户的人仍可以完成全部本地编辑、标注、预设 JSON 导入导出、PNG/剪贴板和 ZIP 导出；账户服务不可用时也能继续这些工作。

选择 D4A 的主要判断：样式最多 24 项，数据量小，现阶段不需要托管认证的大型 UI/组织能力；同源、数据库会话和 HttpOnly Cookie 比较容易表达及验证；认证记录和业务记录可随 PostgreSQL 迁移。代价是我们负责认证依赖升级、邮件投递、滥用处理和会话运维。若没有人持续负责这些工作，**应先保留纯本地产品，或在 D4 改选 D4B 的托管认证**，不能把开源认证库当成无人维护的服务。

### 分阶段范围

| 范围 | 账户实际提供 | 数据离开浏览器的条件 | 建议 |
|---|---|---|---|
| 本地模式 | 当前 V2 的完整能力、样式文件迁移 | 截图、标注、样式均不上传 | 永久保留 |
| 个人账户首期 | 已验证邮箱、设备会话、主动启用的样式同步、账户数据导出/删除 | 登录会传邮箱和认证请求；同步会传所选预设名称及 Look | 推荐 D4 选择此项 |
| 云端完整构图 | 截图、标注、源文件信息、编辑状态与版本恢复 | 必须另有功能说明、逐项保存动作及独立同意 | 本次不选择、不暗含在登录中 |
| 公共分享/团队 | 分享链接、成员权限、组织等 | 新的接收者、权限及公开内容边界 | 不纳入个人账户提案 |

可用性目标建议是「本地导出不依赖登录服务」和「每个云端写入有可确认结果」。业务收益应先通过自愿试用反馈验证；本文不建议为验证收益自动新增分析脚本或用户行为采集。

## 2. 现有隐私承诺与未来边界

**仓库事实。** [README](../../README.md)、[V2 spec](../v2/spec.md)、[architecture](../architecture.md)、[data model](../data-model.md) 及现有 `/privacy` 均明确：没有账户、数据库、对象存储或上传；浏览器 profile 加 origin 是本地所有权边界。同一 profile 的人共享数据，切换账户不是浏览器隔离机制。当前 `picwiz:store` schema 2 保存一张当前截图、标注、样式、最多 24 个预设和 20 条导出记录；`shinyshot:store` 可能另存旧截图。批次文件与结果只在内存。原始恢复备份可包含截图，不能当作样式文件上传。

建议首期保持本地工作区模型：

| 内容 | 本地持久化/共享边界 | 首期云端边界 |
|---|---|---|
| 当前截图、标注、导出历史、旧键、原始恢复备份 | 仍属于此浏览器 profile；账户不取得其所有权 | 不接收、不序列化到同步 DTO |
| 本地预设 | 仍是最多 24 项的 profile 共享集合 | 必须先选择并确认「同步这些样式」 |
| 云端预设 | 所有者为服务器验证的个人 `User.id` | 只含预设名称及 `Look` allowlist |
| 云端预设列表/冲突编辑草稿 | 默认只在登录页签内存缓存 | 登出、换号或会话失效后清除，不写入共享本地库 |
| 邮箱、会话及必要安全记录 | 不进入预设 JSON、本地备份或编辑器 storage | 认证库/服务及数据库，按明确保留策略处理 |

Look 仅为 `background,padding,radius,shadow,frame,appearance`。同步禁止 `source`、图片/data URL、文件名、标注文本、size/scale、导出记录、任意 CSS/URL、凭据以及未知字段。预设名称也可能透露客户或项目名称，必须在同步前说明；「没有截图」不等于「没有个人信息」。中性示例缩略图继续在本地生成，不缓存截图缩略图到服务器。

**共享 profile 的重要后果：** A 登录、退出、B 登录后，B 仍可能看见这个 profile 原有的当前截图和本地预设。把云端 Look 应用到编辑器后，外观参数也成为本地工作区内容；只有显式「另存到本地」才复制云端预设名称和记录。登出默认清除云端缓存与待发送任务，保留共享本地工作区；按钮旁必须直说「退出不会删除此浏览器的截图」。另外提供独立且需确认的「退出并清除此设备本地数据」，沿用两键删除及验证，清除失败不得显示成功。它无法清除下载文件、系统剪贴板、其他 profile 或其他设备。

首期不宣称账号命名空间或前端加锁提供本机保密。真正的本机隔离仍需独立浏览器/OS profile。以后若增加每账户本地工作区，是一次独立 schema 迁移和隐私决策，不能悄悄把现有共享工作区归给先登录的人。

## 3. 用户流程、同步与恢复

### 登录与第一次同步

1. 编辑器只增加低干扰的「同步样式」入口；不在首次导入截图、导出或选择内置预设时弹登录墙。
2. 展示将处理的邮箱、认证/数据库/邮件服务、选定地区、账户仅同步样式的边界。OTP 发出统一提示，避免确认邮箱是否已注册；支持取消并返回编辑器。
3. 登录成功只加载账户状态及用户主动打开的云端样式列表。**不自动上传或搬迁任何本地数据。** 首次弹出可跳过的对照预览：本地有哪些样式、云端有哪些、预计新增/跳过/重命名哪些项；默认尚未勾选同步本地库。
4. 用户选中样式后显示准确载荷类别，确认一次才提交。跳过则保留登录但不同步。最多 24 个云端有效预设；内置六项仍为公共代码目录，不复制到每个账户。
5. 开启后，在明确标为「云端」的样式记录上点击保存才发起同步；本地记录的改动不会自动上传。用户也可选择对某条预设开启后续自动同步，该授权必须可见、可关闭，首期建议只做显式保存。

### 导入、迁移和冲突合同（建议）

- 继续接受 V2 外观文件格式 `style-presets` version 1、100 KiB、1–24 项，严格验证未知字段和容量。**导入首先在本地预览**，选择「仅存本地」或「确认同步所选样式」；登录状态不改变默认选项。`local-data-backup` 包装、损坏/未来版本与带图片的对象全部禁止进入云端导入路径。
- 本地旧 ID（包括兼容的非 UUID）不作为云端主键；云端新建 UUID，返回映射仅供此次确认流程使用。本地原记录保留，可导出 JSON 以回退。邮箱变更不变 owner ID。
- 同名、同 Look：预览为跳过；同名、不同 Look：提供「保留两份」默认方案，按现有 NFKC、空白/大小写规则及不超过 40 字的确定性后缀重命名。要覆盖则展示双方缩略图并明确选择，不能凭客户端时间戳决定谁新。
- 云端保存要求 `expectedVersion` 或 `If-Match`。版本不匹配返回 409 和此 owner 的最新值；可选择使用云端、另存副本、确认覆盖最新版本。覆盖仍需带最新版本再次提交。未解决前保留本地编辑，不悄悄 last-write-wins。
- 导入一批在服务器一个事务中完成：验证/去重、锁定账户配额、所有更改、递增同步序号、写入幂等回执一起提交；任一无效或超容量均不部分保存。相同操作 ID、相同 payload 重试返回原结果；相同 ID、不同 payload 返回 409。
- 删除产生 tombstone 和递增 revision，避免离线设备重建已删条目。建议 tombstone/幂等回执保留 30 天；游标早于最早保留版本时返回 `resync_required`，重新取全量并让用户处理旧草稿，不能把老设备当作新增来源自动推回。
- 网络失败标「未同步」，只在同一 owner、同一会话代次下有限重试。首期离线草稿仅内存，离开前提示导出外观 JSON；不把待发送云端任务写入现有共享 store。若需要可靠离线队列，另立本机多用户设计后再实施。

### 状态与用户恢复

| 状态/错误 | 可见行为 | 恢复动作 |
|---|---|---|
| signed-out / 主动跳过 | 本地编辑可用；云端保存说明需要登录 | 按需登录，不上传历史草稿 |
| OTP 错误/过期/已使用 | 显示验证码失败，不暴露用户存在性 | 重发新挑战；旧码失效，受冷却限制 |
| 邮件延迟/退信/供应商故障 | 显示发送未完成或延迟，保留编辑 | 检查邮箱、冷却后重试、继续本地；不无限重复发信 |
| session expired / revoked，401 | 立即停止云端写入、清云端内存，保留本地截图 | 重新登录同账户后重新预览；不自动重放旧写入 |
| forbidden，403 | 账户被限制/正在删除，停止同步 | 提供非敏感原因码、联系支持入口或本地导出；重新登录不是绕过方法 |
| 猜测/不属于自己的资源 ID | 对外统一 404，无标题/owner/存在性细节 | 返回自己的列表；服务端记录脱敏拒绝事件 |
| 409 / 跨设备更新 | 展示我的草稿与账户最新外观 | 选择版本/保留两份后重试 |
| 429 | 明确冷却时间 | 遵守 `Retry-After`，继续本地操作 |
| 5xx / 离线 | 不显示「已保存到云端」 | 有限退避、手动重试或导出本地样式 |
| 本地 quota/corrupt/future schema | 沿用 V2 恢复，不因登录变成上传恢复 | 私下备份、session-only、重载或确认清除 |
| 丢失浏览器 profile | 恢复该账户曾成功同步的样式 | 未同步样式、截图、标注与批次不可由账户恢复 |
| 退出时有草稿 | 提醒尚未同步；可导出样式或取消退出 | 确认退出后丢弃云端队列及内存，不继续后台发送 |

首期 OTP 方案没有密码，因此不存在密码重置流程；丢失邮箱访问权时不能凭姓名/旧截图恢复账户。将来若选密码方案，必须增加单次、短期、抗枚举的重置流程、重置后撤销会话及相应测试，不能只多放一个输入框。修改邮箱建议重新验证当前账户和新邮箱；不能把「两个邮箱相同」当作合并两份云端库的授权。

多页签共享 Cookie：换号/退出广播不含身份秘密的会话失效信号，所有页签立即锁住云端区、清草稿缓存并重新核对服务器身份；每个异步操作携带内存中的 owner/session epoch，晚到响应不得写入另一账户 UI。本地标签遮挡只降低误看，不能承诺同 profile 安全隔离。退出前已被服务器接受的操作可能成功；UI 必须通过下次重新读取确认，而不是声称取消已回滚服务器。

## 4. 三种技术路线及适配结论

本仓库 `next` 固定 `16.4.2`，React 范围 `^19.2.0`。已阅读安装包中的 `node_modules/next/dist/docs/01-app/02-guides/authentication.md`、`server-actions.md`、Cookie、Proxy 和 Route Handler 指南。框架方案以这些本地文档为准；当前官网显示的较新版本不是本项目已经升级的证据。

### D4B. Supabase Auth + Postgres + SSR

事实：官方为 Next.js 提供 `@supabase/ssr` 的浏览器/服务器客户端与 Cookie 会话方案；`getClaims()` 验证 JWT，`getUser()` 获取最新用户，不能信任仅从 Cookie 读出的 `getSession().user` 做授权。[Supabase SSR 指南](https://supabase.com/docs/guides/auth/server-side/creating-a-client)（访问 2026-10-23）。

事实：标准 SSR 设计允许浏览器读取 access/refresh token，官方并不要求其 Cookie 为 HttpOnly；`getClaims()` 验签不能消除已撤销会话的未过期 JWT 窗口。认证响应被 CDN/ISR 缓存还可能把会话发给其他用户。[SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)（访问 2026-10-23）。

判断：托管认证、数据库、RLS 和备份集中，运维最省；但若坚持本提案的 HttpOnly 不透明应用会话，应单独设计服务器代理/BFF，而不能把标准 browser client 示例改个 Cookie 标志就声称完成。届时可能需要保留加密的 provider refresh token、处理并发刷新和撤销；应先做窄验证再确认成本。若 D4 明确接受标准 SSR 客户端 token 模型，可选 **D4B：Supabase Auth（标准 SSR token 模型）**，业务所有权仍逐查询验证。

许可边界：Supabase 平台主仓库 Apache-2.0，Auth 项目 MIT；不同组件需逐项核对。托管服务另受服务合同约束，开源许可不代表托管免费。[平台 LICENSE](https://github.com/supabase/supabase/blob/master/LICENSE)、[Auth LICENSE](https://github.com/supabase/auth/blob/master/LICENSE)（访问 2026-10-23）。

### D4A. Better Auth + Drizzle + 托管 Postgres + 邮件（推荐）

事实：Better Auth 有 App Router Route Handler、RSC/Server Action 和 React 集成；Drizzle adapter 支持 PostgreSQL，schema 由认证配置生成后通过 ORM 管理迁移。不能把 Drizzle 模式直接当作内置 adapter 的自动 migrate。认证至少涉及 `user/session/account/verification`，不是四张业务表就能实现认证。[Next.js 集成](https://better-auth.com/docs/integrations/next)、[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[认证数据库模型](https://better-auth.com/docs/concepts/database)（访问 2026-10-23）。

事实：Better Auth 的主会话是签名的不透明标识；生产 Cookie 可为 HttpOnly/Secure，支持配置。[Cookie 文档](https://better-auth.com/docs/concepts/cookies)（访问 2026-10-23）。邮箱 OTP 插件提供登录/验证；应用必须实现邮件发送函数。[Email OTP](https://better-auth.com/docs/plugins/email-otp)（访问 2026-10-23）。

判断：不启用组织、多会话切换、JWT/Bearer、外部头像或无关插件；保持客户端只拿最小会话 DTO，不拿数据库密码或邮件密钥。服务器直接连托管 Postgres，使用池化连接和有界并发。主要风险是认证库升级及安全响应责任由我们承担，需要有人负责。

许可事实：Better Auth 是 MIT；Drizzle ORM 是 Apache-2.0。使用这些开源包本身没有按 MAU 的许可费用；托管数据库、邮件、备份和维护人力另外付费，不把其他商业产品/插件一并视为免费。[Better Auth LICENSE](https://github.com/better-auth/better-auth/blob/main/LICENSE.md)、[Drizzle LICENSE](https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE)（访问 2026-10-23）。

### D4C. Clerk + 独立 Postgres

事实：Clerk 提供 Next.js SDK、登录/用户管理组件及服务端认证。官方样例明确记录了 Next.js 16、React 19 的组合，但这不是本项目 `16.4.2` 的实际验证结果。[App Router 快速开始](https://clerk.com/docs/nextjs/getting-started/quickstart)、[官方 Next 16/React 19 示例](https://clerk.com/blog/build-a-blog-with-trpc-drizzle-nextjs-clerk)（访问 2026-10-23）。

事实：Clerk 长期 `__client` Cookie 为 HttpOnly；应用域上的短期 `__session` JWT 为客户端 SDK 可读，不能声称所有认证 Cookie 都是 HttpOnly。[Clerk 工作原理](https://clerk.com/docs/guides/how-clerk-works/overview)（访问 2026-10-23）。

判断：现成认证 UI 和会话管理最完整；本产品目前只要小型个人样式库，其 UI、外部脚本/CSP 及供应商身份生命周期接入较重。可以选用，但应明确接受上述 Cookie 模型；不为个人用户暗建 organization。Clerk 管身份不等于它会替业务 Postgres 做 owner 授权。

许可事实：JavaScript SDK 为 MIT；托管身份服务是独立商业服务，不能因 SDK 开源便视为可自行完整托管。[SDK LICENSE](https://github.com/clerk/javascript/blob/main/LICENSE)（访问 2026-10-23）。

### 相对取舍与退出路径（判断）

| 维度 | D4B Supabase Auth | D4A Better Auth | D4C Clerk |
|---|---|---|---|
| 身份运维 | 低，主要配置/集成 | 较高，自己运行认证库与升级 | 低，托管 UI/身份服务 |
| 数据库运维 | 托管，备份仍需验证 | 选择托管后类似 D4B | 另外采购/运维 |
| HttpOnly 不透明应用会话 | 标准 SSR 不直接匹配；需 BFF 或接受差异 | 原生方向匹配 | 标准 SDK 的短期 JWT 不匹配全 HttpOnly 要求 |
| 100–10k 活跃规模费用 | 固定底座与邮件为主 | 固定底座与邮件/维护为主 | 可用 Hobby，Pro/自定义能力增加固定费 |
| 身份锁定 | 中，Auth schema/API/令牌模型 | 低至中，库 schema 和插件也形成耦合 | 较高，SDK/托管会话/用户模型 |
| 业务数据可逆性 | 标准 PostgreSQL + 外观 JSON | 同左，身份记录也在受控 DB | 业务库可迁，身份需要供应商导出/映射 |
| 后续切换 | 保留业务 owner，迁移身份映射并重新登录 | 迁移库与身份 adapter；会话建议失效 | 导出用户不等于可迁移全部凭证/会话，需逐项确认 |

任何路线都应保留稳定的应用用户 ID 和 provider/subject 映射，不以邮箱作为 FK。切换供应商时先导出/校验数据、演练映射及回滚，再迁移；不要承诺密码、passkey 或现有会话能无感迁移。退回纯本地应允许下载样式 JSON，停止同步并按确认计划删除云端数据，不影响已经下载的本地文件。

## 5. 当前公开价格、计量定义与预算

下列费用公式沿用 A=Supabase、B=Better Auth、C=Clerk 的供应商简写，分别对应统一决策编号 D4B、D4A、D4C；Backup 成本另记，不是认证路线。

### 已核对的公开项目

- **Supabase Pro：$25/月起**，含 $10 compute credit，可覆盖一个 Micro 项目；包括 8 GB 数据库磁盘、100 GB 文件存储、250 GB 常规 egress，以及每日数据库备份保留 7 天。超量分别为数据库 $0.125/GB、文件 $0.0213/GB、常规 egress $0.09/GB；cached egress 是另一口径，本模型不使用。额外项目、compute 扩容等另计。[定价](https://supabase.com/pricing)（访问 2026-10-23）。
- **Supabase Auth MAU**：计费周期内发生登录或 token refresh 的不同用户，每个用户只计一次；Pro 含 100,000，超出 $0.00325/MAU。不是页面访问数、注册总数或仅成功保存预设的人数。[MAU 定义及计费](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)（访问 2026-10-23）。
- **Supabase 默认邮件不适合生产**：当前仅允许项目授权地址，限制 2 封/小时；正式邮箱登录需要自有 SMTP。不能把 $25 Auth 底座写成包含生产邮件。[官方 SMTP 说明](https://supabase.com/docs/guides/auth/auth-smtp)（访问 2026-10-23）。
- **Clerk Hobby $0，50,000 MRU/应用；Pro $25/月付，或 $20/月按年付**。Pro 首档超量 50,001–100,000 为 $0.02/MRU/月，更高阶有阶梯价。本模型只写首档有效公式；不是任意规模统一 $0.02。MRU 指当月访问、且已超过注册至少 24 小时的用户；新注册后未回访者不算。Hobby 有固定 7 天会话寿命等限制，不能把 Pro 特性算入免费层。[Clerk 定价及 FAQ](https://clerk.com/pricing)（访问 2026-10-23）。
- **Resend Transactional Pro $20/月，50,000 封/月，超出按每额外 1,000 封 $0.90 分桶**；Free 仅 3,000 封/月且 100 封/日。采用付费 Pro 作为生产预算示例，邮件可达性和域名配置仍要做。[邮件定价](https://resend.com/pricing?product=transactional)（访问 2026-10-23）。
- **示例应用托管：Vercel Pro $20/月的单开发者底座，含 $20 usage credit**；超出各资源额度/credit 后另计。此处只是备选托管模型，未替项目购买或确认主机。[Vercel 定价](https://vercel.com/pricing)（访问 2026-10-23）。

### 可复算公式

建议先用一套付费托管数据库作一致比较，A 用 Auth+DB，B 用 DB-only，C 的业务 DB 也按同一 Supabase Pro 底座核算。C 通过服务器 SQL 访问，不启用 Supabase 第三方认证计量；如果以后改为第三方 JWT/Data API 集成，必须另核对对应收费。

令 `M` 为账户月活假设，`R` 为 Clerk 实际 MRU，`E` 为本月计费邮件数；`D_i` 为第 i 个项目的数据库 GB-month，`S` 为对象存储 GB-month，`G` 为常规 egress GB。`x+ = max(0,x)`。本例只有一个项目；若增加项目，磁盘额度按项目分别计算，不能把闲置额度任意合并。以下是预算模型，具体服务按账单精度计量：

```text
DB = 25 + max(0, 所有项目 compute 月费 - 10)
     + 0.125 × Σ_i(D_i - 8)+ + 0.0213 × (S - 100)+ + 0.09 × (G - 250)+
     + 其他已选择的数据库附加项
Email(E) = 20 + 0.90 × ceil((E - 50,000)+ / 1,000)
Host = 20 + Vercel 超额度/credit 后实际用量费用（示例单开发者）

A = Host + DB + 0.00325 × (Supabase 实际 MAU - 100,000)+ + Email(E) + Backup + O
B = Host + DB + Email(E) + Backup + O
C Hobby = Host + DB + Backup + O               （R ≤ 50,000 且 Hobby 功能足够）
C Pro = Host + DB + 25 + 0.02 × (R - 50,000)+ + Backup + O
        （此 MRU 公式只适用于 R ≤ 100,000；超过需用完整阶梯）
```

`Backup` 是独立备份/恢复演练所需的额外存储、请求及计算费用；`O` 是监控、限流状态、运维人力、域名/税费等未报价项，不能写成确定为零。Clerk 行假设采用其方案内建的认证邮件，不再叠加 Resend；若改自有邮件投递，再加对应邮件费并核对功能资格。没有把邮件/运维预算省略来宣传免费生产。

### 100 / 1,000 / 10,000 月活情景（假设，不是容量测试）

假设一套生产 Micro、一个开发者、没有额外环境；每活跃用户每月 3 次 OTP 请求，另按 10% 额外发送计入预算，即 `E = ceil(3.3M)`。每人最多 24 项、每项按 1 KiB 业务载荷估计，则最大当前样式载荷约 `24 KiB × 总存量用户数`；不能把 MAU 当成全部存量用户，也不能忽略索引、认证记录、revision 和 WAL。此处仅假设总数据库仍在 8 GB、egress 在 250 GB 内，无对象、无 PITR、无 compute 扩容。实际性能与邮件峰值需验证。为保守比较令 `R=M`；真实 MRU 不一定相等。

| 月活假设 M | 预算邮件 E/月 | A 公开底座 | B 推荐方案公开底座 | C Hobby 公开底座 | C Pro 月付公开底座 |
|---:|---:|---:|---:|---:|---:|
| 100 | 330 | $65 + Backup + O | $65 + Backup + O | $45 + Backup + O | $70 + Backup + O |
| 1,000 | 3,300 | $65 + Backup + O | $65 + Backup + O | $45 + Backup + O | $70 + Backup + O |
| 10,000 | 33,000 | $65 + Backup + O | $65 + Backup + O | $45 + Backup + O | $70 + Backup + O |

这些数字含示例 Host $20；若复用已付费托管，A/B 新增服务底座为 $45，C Hobby 为 $25、Pro 为 $50，仍须加 Backup/O 及真实增量用量。不能据此保证 10k MAU 用 Micro 足够。免费研究环境可以评估，但 Supabase Free 没有自动备份且有暂停行为、免费邮件有日限，不作为生产承诺。

**备份与截图云存储另算。** 每日 7 天数据库备份已在 Pro 底座内；若业务要求 PITR，公开选项为每项目每 7 天保留 $100/月，且官方要求至少 Small compute（公开月价 $15，相比 Micro 再加 $5）。在本例单项目模型中，开启 PITR 至少增加 $105/月，A/B 示例底座随之从 $65 变为 $170，再加真实用量及 Backup/O；开启 PITR 后它取代每日备份，不把两种备份当作并行提供。独立异地备份 `Backup = 备份GB-month×存储单价 + 写/读请求 + 恢复流量 + 演练计算`，供应商/地区未选，所以不虚构报价。Supabase 数据库备份不包含 Storage API 的实际对象，仅有对象元数据；以后保存截图必须另做对象备份。[官方备份说明](https://supabase.com/docs/guides/platform/backups)、[PITR/compute 公开价格](https://supabase.com/pricing)（访问 2026-10-23）。

未来若明确选择云端构图，成本至少另加「实际对象 GB-month、上传/下载/变体请求、egress、缩略图/转换计算、旧版本与删除保留、对象备份和内容滥用处理」；不能只拿 100 GB 包含额度说上传免费。本提案首期 `S=0`，不存在 bucket、上传 URL 或云端渲染资源。

## 6. 拟议后端边界和数据模型

**本节仅是设计，未创建 SQL、迁移、环境文件或服务。** 浏览器本地编辑器 → 同源 Next Route Handler/Server Action → `requireUser` + 业务 repository → PostgreSQL；认证 adapter 与业务 repository 分开。浏览器不直接访问 SQL、不获得管理密钥。

### 四个核心逻辑实体

| 实体 | 建议字段/约束 | 所有权及索引 |
|---|---|---|
| User | 稳定应用 `id` PK；认证 provider/subject 唯一映射（外部 provider 时）；认证库要求的邮箱验证字段；`createdAt,updatedAt`、状态 active/deleting/disabled、`syncSequence` 非负高水位 | 一个人一个租户；邮箱不是 tenant key；只返回最小 DTO；状态/高水位为服务器专有字段 |
| Session | 认证库管理的 ID/不透明 token、`userId` FK、`createdAt,updatedAt,expiresAt`；撤销采用库支持的机制 | `userId`/过期索引；用户只能看自己脱敏后的设备会话列表，不返回 token |
| CloudPreset | UUID PK；`ownerId` FK → User；`name,nameKey,look,schemaVersion,version`；`createdAt,updatedAt,deletedAt`；tombstone 可清空名称/Look | `UNIQUE(ownerId,nameKey)` 限有效记录；`UNIQUE(ownerId,id)` 便于复合 FK；owner+id 查询；owner+updatedAt+id 列表索引 |
| SyncRevision | `ownerId` FK；每 owner 单调 `sequence`；presetId（可空用于导入回执）、operation create/update/delete/import、operationId、requestHash、resultVersion/有界结果、`createdAt` | PK `(ownerId,sequence)`；唯一 `(ownerId,operationId,条目序号)`；preset 用 `(ownerId,presetId)` 复合 FK；支持分页变化游标与幂等结果 |

以上是最小业务视图，**不是宣称只有四张物理表**。推荐 D4A 复用 Better Auth 的 `user/session`，保留它要求的 `account/verification` 等 schema；如其 ID 类型不为 UUID，FK 类型跟随实际生成结果，不强行改库约定。若选 D4B/D4C，User 是业务映射表，Session 由 provider 持有，不无意义复制其原始 token。跨 provider 切换才引入单独身份映射表；首期只一种身份方法。

时间统一 UTC instant、Postgres `timestamptz`，HTTP 输出规范 ISO-8601 Z；不使用用户时区比较版本。`version/sequence` 为正向整数且只由服务器生成，客户端 JSON 用安全整数范围或十进制字符串。约束包括有效记录名称长度 1–40、规范化且同 owner 唯一、Look 的枚举/数值与 V2 一致、`schemaVersion=1`、有限大小、updatedAt/删除时间不早于创建时间、会话到期晚于创建时间；tombstone 采用独立状态约束，名称/Look 可空。业务 FK 的账户删除采用事务内级联或等效明确顺序，认证数据跟随选定库生命周期。JSONB 不是免校验入口；服务器 strict validator 加数据库 check，禁止 HTML/URL 扩展。初始建议每预设载荷上限 2 KiB、整批 100 KiB，并在最终 spec 固定编码计算方式。

每个账户上限 24 个有效预设不能仅靠客户端计数或普通 `CHECK`：每次写事务锁同一个 owner 的 User 行，查配额、修改、递增 `User.syncSequence`、写 revision/回执；配合唯一约束解决并发命名。清理旧 revision 时不能重置 User 中的最高水位。状态和高水位禁止从认证注册/修改资料接口接收客户端写入；若复用 auth User 表，业务连接只获必要列的读取/更新权限。将来更大规模才单独加同步状态表，避免预先造复杂队列。revision/回执仅存 ID、版本、结果计数等同步元数据，不存完整 Look/名称；客户端收到变化后获取仍有效的本人预设，首期不提供历史内容回滚。删除清除 payload/名称等不再需要的内容，留下最小 tombstone；清理 tombstone 及相关 revision 要满足 FK 顺序。

首期若需要可靠邮件重试队列、跨实例限流或 webhook，需增加对应受限基础设施表（例如 delivery outbox、rate limit、event receipt）；这些不伪装成云端构图表，也不能假装内存队列在 serverless 上可靠。最终 schema 必须从选定库配置生成并审阅，而不是把本文表格直接作为可执行迁移。

### 逐查询授权、角色与 RLS

- **认证 ownership 与业务 tenant 分开。** 认证 provider 证明 subject；业务层映射到应用 User，检查 active 状态，并由该 ID 决定 owner。个人用户就是 tenant，不引入 orgId/teamId。来自 body、URL、header、localStorage 的 ownerId 均不能作为授权来源。
- **每个业务查询都有 owner 条件**：列表、单条、更新、删除、导出、计数、导入去重、revision 游标、关联查询均绑定服务器身份。更新等价于 `id + ownerId + expectedVersion`；insert 的 owner 从 session 注入。批量 `IN(ids)` 同样带 owner；禁止「先按 id 取出，再在 UI 隐藏」。不能省略 counts/唯一性查询的 tenant 过滤。
- 公共无 Cookie 请求无业务数据权限。默认业务 runtime role 只有需要的 DML，无 DDL、TRUNCATE、BYPASSRLS 或表所有权；迁移角色独立且不供请求使用；认证 adapter 角色仅能访问 auth schema；备份/清理管理角色单独且审计。认证内部查邮箱/验证 challenge 是身份验证流程，不开放为通用跨用户业务查询。
- **RLS 是第二层**：CloudPreset、SyncRevision 启用 RLS，读取/删除使用 owner predicate，插入/更新同时 `WITH CHECK` 禁止改 owner。D4A 的服务器连接在同一数据库事务中用 transaction-local、由已验证 session 设置的 owner context；未设置时默认拒绝。连接池释放后不可残留 owner。不能把 Supabase Auth 的 `auth.uid()` 原样套在没有 Supabase JWT 的 Better Auth SQL 连接上。
- 若选 D4B 的用户 JWT/Data API 路线，则用真实 `auth.uid()` 策略与 owner 索引；`service_role` 不用于普通用户 CRUD。若选 D4C，验证 issuer/audience/expiry 后映射 User，再走相同 repository。所有路线都测直接 SQL/REST 旁路。
- 不依赖 RLS 约束数据库 superuser/表 owner；对业务表可用 FORCE RLS 加固，但不能声称能约束 BYPASSRLS。事务、参数化查询、FK 及列权限共同建立边界，RLS 也不能替代应用本身被攻陷后的隔离。

RLS 的默认行为、表所有者绕过、USING/WITH CHECK 区别由 [PostgreSQL 官方行安全文档](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) 说明；Supabase 对用户 JWT、service key 与 owner 索引有专门说明。[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)（访问 2026-10-23）。上述特定角色/事务结构是本项目建议，并非供应商已经为 PicWiz 配好。

## 7. 会话、安全、邮件与接口设计

### Next.js 16 / React 19 适配

建议账户页面 SSR 最小信息，图片/Canvas 继续留在客户端；验证 `cookies()` 使用 async API，Cookie 写入在 Route Handler/Server Function 响应阶段完成。Next 16 使用 `proxy.ts` 文件约定；Proxy 可作轻量跳转，不是业务授权的最终防线。每个页面数据读取、Action、Handler 都重新核对身份/状态与 owner；不能只在 layout 或隐藏按钮上检查。对账户/同步/带 Set-Cookie 的响应明确 `private, no-store`，不进 CDN/ISR/共享缓存，登出后清理 Router 缓存并重取会话。参见已读本地指南与 [Next 官方认证指南](https://nextjs.org/docs/app/guides/authentication)（访问 2026-10-23）。

React 19 的 `useActionState` 可管理提交结果/pending；它不是服务器事务或幂等保证。错误返回有界、可访问的状态，键盘及读屏可完成 OTP、冲突选择、退出和删除。[React 官方 API](https://react.dev/reference/react/useActionState)（访问 2026-10-23）。

### 安全策略（建议参数，实施时确认）

- D4A 的主 Cookie：HTTPS、Secure、HttpOnly、SameSite=Lax、Path=/、host-only；可采用符合 `__Host-` 规则的名称。初期禁用会话 Cookie cache，服务器每次验证数据库会话/账户状态。建议会话有效期 7 天，最终 spec 明确续期/空闲策略与绝对上限，不能把滚动过期描述成绝对七天；共享设备提供不持久会话选项。数据库中的 bearer/session 字段按库真实存储处理，不能无证据声称默认全被哈希；限制读权限、加密备份，绝不输出到客户端或日志。
- 会话建立/身份变化旋转；退出撤销当前 session，全设备退出明确区分。账户删除立即禁止业务读取和写入并撤销全部 session。长存 OAuth access/refresh token 首期为零；以后确需保留，使用有 key version 的认证加密和可轮换密钥，权限最小化、脱离业务 DTO，删除时撤销/销毁，不明文 JSON 入库。
- 保持认证库 CSRF/Origin 校验，不启用 `disableCSRFCheck`/`disableOriginCheck`。所有业务 mutation 限同源 HTTPS POST/PATCH/DELETE、严格 Content-Type、Origin/Host allowlist 与 CSRF token/等效保护；SameSite 不能替代全部 CSRF 防护。受信反向代理重写转发头，回调及 returnTo 只允许批准的同源路径。
- OTP 首期无需 OAuth callback。若以后选择 OAuth，交给认证库验证 state、PKCE S256、OIDC nonce、签发者/受众/redirect allowlist，授权码一次使用；不得用邮箱字符串自动合并业务所有权。绑定新登录方式要求现有会话近期验证和新身份验证，禁止未经验证邮箱自动 linking。认证库的 state/PKCE 与 CSRF 能力见 [Better Auth 安全说明](https://better-auth.com/docs/reference/security)（访问 2026-10-23）。
- OTP 建议 6 位、5 分钟、每挑战最多 3 次验证，显式设 `storeOTP=hashed`，不能沿用插件默认明文存储。重发生成新挑战并使旧码失效；传输重试重发同一封、同一挑战，不能每次 API timeout 生成新码。插件确切选项/默认行为见 [Email OTP](https://better-auth.com/docs/plugins/email-otp)（访问 2026-10-23）。
- 发送建议同邮箱至少间隔 60 秒、每邮箱每小时 5 次，另加 IP、设备、项目邮件预算上限；验证限制独立计数。参数是待调建议，避免攻击者用全局锁定拒绝合法用户。归一化邮箱策略跟随认证库，不自行删除 `+tag`/点号合并邮箱。
- 多实例限流需共享数据库/限流存储，不用各实例进程内计数冒充全局保护。Better Auth 官方明确 `auth.api` 服务器直接调用不受其客户端入口限流；因此任何包装 Server Action/BFF 都要另外调用相同的限流规则，避免绕过。[Rate limit](https://better-auth.com/docs/concepts/rate-limit)（访问 2026-10-23）。
- 邮件需要验证域名、SPF/DKIM/DMARC、关闭打开/链接追踪、退信抑制、供应商限额和告警。API 接收成功不等于用户收件。队列/托管任务确保请求结束后仍能发信；发送前重新检查 challenge 仍有效且未被新挑战替换，429/暂态 5xx 退避抖动，最多建议 3 次且不能超过 OTP 有效期，永久失败不重试。
- 邮件发送使用独立 delivery ID 作为 idempotency key；Resend 对相同请求去重窗口为 24 小时，不能当作永久 exactly-once。重试窗口后需由自己的 delivery receipt 保证不重复。[Resend 幂等文档](https://resend.com/docs/dashboard/emails/idempotency-keys)（访问 2026-10-23）。OTP 正文在 outbox 如需短存，应加密且到期清除，不打印正文。
- 默认不增加认证遥测。Better Auth 官方说明遥测可选且默认关闭；部署/CLI 仍建议显式关闭并验证网络目的地。[Telemetry](https://better-auth.com/docs/reference/telemetry)（访问 2026-10-23）。现有 CSP 不因登录被宽泛改成 `*`，只在最终方案批准后列精确必要域名。

### 拟议路由与端点（名称待最终 spec 固定）

| 路由/操作 | 功能与权限 |
|---|---|
| `/` | 本地编辑器，完全公开；同步入口按需加载 |
| `/account/sign-in` | OTP 发起/验证，支持返回本地编辑器 |
| `/account`、`/account/sync` | SSR 最小账户信息、云端预设、设备会话、关闭同步/导出/删除 |
| `/api/auth/[...all]` | D4A 的认证库标准 GET/POST 入口；不自行重写密码学/会话协议 |
| `GET /api/account/session` | 有界状态 DTO，no-store；不返回 token/完整身份记录 |
| `POST /api/account/sign-out` 或库标准 signOut | 撤销当前会话、Cookie 清理；CSRF 防护；幂等 |
| `GET /api/account/presets` | 本 owner 列表/全量快照，可分页 |
| `POST /api/account/presets` | 创建；服务器注入 owner，幂等键/配额 |
| `PATCH/DELETE /api/account/presets/:id` | owner+version 校验，更新或 tombstone |
| `POST /api/account/presets/import` | 只接收确认后的外观 DTO；事务、去重和幂等 |
| `GET /api/account/sync?after=...` | 本 owner revision 游标；过旧要求重同步 |
| `POST /api/account/export` | 近期验证后导出本人的业务数据，下载响应 no-store |
| `POST /api/account/delete` | 近期 OTP/重新认证、显式确认、幂等删除任务/回执 |
| `/api/webhooks/auth`、`/api/webhooks/email` | **仅在选择外部身份/投递回执后增加**，首期不预先创建 |

Server Action 只是同一服务层的 UI adapter，所有校验/限流/事务不依赖路由是 Action 还是 HTTP。GET 不触发保存/退出/删除；OTP 协议回调按库要求处理。账户响应只有规范错误码、requestId 和必要字段，不回传 SQL、堆栈或 provider 原始错误。

若采用 webhook：按供应商 SDK 对原始 body、签名及 timestamp/replay window 验证，限制体积；持久化唯一 event ID 去重，提交事件处理后再确认，暂态故障可重投。乱序的旧用户更新不得复活 deleting/deleted 账户；provider 用户创建事件不授权迁移本地数据。不能用 webhook 取代同步请求的身份认证。Clerk 的正式同步流程要求验签，可参考 [官方 webhook 指南](https://clerk.com/docs/guides/development/webhooks/syncing)（访问 2026-10-23）。

## 8. 备份、导出、删除、运营与法律待确认

### 生命周期建议

- 云端样式保存至用户删除记录或账户；不承诺无限版本历史。tombstone/revision/幂等回执暂拟保留 30 天，过期游标强制全量重同步。认证 challenge 按有效期清理；过期会话按维护计划清理。
- 账户导出包括本人的云端样式、schema 版本、UTC 时间和必要账户元数据；提供可回本地的 V2 外观 JSON，并区分它与完整账户数据包。排除 session token、OTP、密码散列、OAuth 密钥、邮件正文。导入不接受完整数据库/原始本地备份。
- 「删除云端样式」「删除账户」「清除此浏览器数据」三个动作分别解释作用域。清本地不删除云端；删云端不遥控清除别的浏览器/导出文件。本设备若同时清除，须独立确认并报告两者各自结果。
- 建议删除请求先在事务中标 deleting、禁止新会话与同步、撤销会话，再异步幂等删除业务和认证数据；完成后给非敏感回执。建议活动数据库删除目标为 24 小时内，异常告警并报告 pending，不能宣称即时清除全部副本。外部 provider 删除/邮件供应商记录需要单独执行或确认其合同保留。
- 备份中的已删数据自然滚动过期，不能承诺能逐条即时删除不可变备份。建议异地备份最长 30 天，保存受限的删除清单覆盖最长备份窗口；恢复时在对外开放前重新应用删除清单、禁止旧账户复活并使旧会话失效。清单本身最小化、访问受限，到期也删除。最终保留与客户义务由 D4/隐私政策确认。
- 建议数据库备份每日、季度恢复演练，初始目标 RPO≤24 小时、RTO≤1 工作日；这是待验证目标，不是现有能力/SLA。演练须含 schema/auth 配置、RLS、密钥可用性、删除清单和单 owner 导出验证；恢复到隔离环境，不能把旧快照直接覆盖生产后开放登录。

### 诊断与密钥

日志只记录事件类型、随机 requestId、规范错误码、延迟、状态和必要的受控假名关联；默认不记邮箱/IP 原文、验证码、Cookie、Authorization、token、SQL 参数、预设名/Look、图片、文件名、标注及完整请求 URL。错误监控禁采集请求体、会话重放/截图，统一 header/body redaction；假名 ID 也按个人数据管理。认证库 session schema 可能存 IP/user-agent，不等同于应用日志：实施时关闭不需要的收集；确需用于设备安全/限流则在隐私说明中列出用途、访问限制及最短保留，不能漏掉这部分。建议一般应用日志 7 天、安全拒绝事件最长 30 天，实际托管/provider 保留期需另核对。

以下仅为**拟议环境变量清单**，不是创建 `.env` 的指令，也不需要此时提供凭据：

| 用途 | 未来可能的配置名 | 边界 |
|---|---|---|
| 公共站点地址 | `APP_ORIGIN`、D4A 的 `BETTER_AUTH_URL` | 非秘密，固定 HTTPS origin，callback/CSRF allowlist |
| D4A 会话签名/加密 | `BETTER_AUTH_SECRET`，轮换时 `BETTER_AUTH_SECRETS` | 服务器 secret manager；不进入 `NEXT_PUBLIC_*` |
| 业务 DB | `DATABASE_URL` | 服务器池化、最小权限角色；禁止浏览器使用 |
| auth DB / migrations | 拟议 `AUTH_DATABASE_URL`、`MIGRATION_DATABASE_URL` | 分角色；迁移凭据只给部署作业，不放 runtime |
| 邮件 | `RESEND_API_KEY`、`MAIL_FROM`；若 D4B 用 SMTP 则供应商 SMTP 配置 | 前者秘密、后者地址配置；API 密钥限制域名/发送权限 |
| 遥测 | `BETTER_AUTH_TELEMETRY=0` | 显式关闭；不是服务凭据 |
| 备份/加密/限流 | 拟议 `BACKUP_*`、`TOKEN_ENCRYPTION_KEY_VERSION`/KMS 引用、`RATE_LIMIT_*` | 只在所选方案确实需要时添加 |
| D4B 替代配置 | `SUPABASE_URL`、publishable key；受限 admin/secret key | publishable key 不是 secret；管理密钥永不公开，普通 CRUD 不使用 |
| D4C 替代配置 | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY` | publishable 可公开，secret 仅服务器 |
| 可选 webhook | `CLERK_WEBHOOK_SIGNING_SECRET` 或邮件供应商签名密钥 | 仅在启用相应回执时，服务器验证原始请求 |
| 可选 OAuth | provider client ID / client secret | 首期不需要；secret 不下发客户端 |

命名为「拟议」的变量是本应用未来配置，不冒充框架内置变量。正式轮换先加新 key/version、部署兼容读取、改用新 key 签写、在最大会话/备份/回调窗口后撤旧；泄漏事件需立即撤销受影响会话/token、替换数据库/邮件/webhook密钥，不能仅换环境变量后保留已泄漏凭据。Better Auth 的 versioned secret 机制见 [官方轮换说明](https://better-auth.com/docs/reference/security)（访问 2026-10-23）；具体版本能力必须在锁依赖时再验证。

**法律及地区未知，不作法律建议。** 账户使邮箱、IP/访问记录、身份供应商及跨境处理进入隐私说明；仅同步外观也不能沿用「没有账户/没有预设上传」的绝对文案。应在实施发布前确认运营主体、目标市场/年龄、适用法律、服务商 DPA/子处理者、数据及备份/支持访问所在地、删除/访问请求流程、Cookie 告知及必要同意、侵权内容/滥用处理。数据库地区不等于认证、邮件、日志与客服访问都在同地区；没有证据时不能承诺 EU-only 或全球合规。截图云保存若另选，还需重新确认内容敏感性、权利、保留与第三方处理范围。

## 9. 未来实施验收与停止条件

以下都是批准后的验收要求，**本轮没有实施或执行这些账户测试**。现有 V2 已完成的测试不证明新增后端/账户安全。

1. **两 owner / 猜 ID**：A/B 分别创建预设；对列表、详情、更新、删除、导入冲突查重、revision、计数、导出使用另一人的 UUID，均不泄漏；直接请求/SQL 与 UI 一致，伪造 owner、修改 FK、跨 owner 批量操作失败。测试未设置 owner 的 RLS、低权限连接及连接池复用不串号。
2. **认证与恢复**：signed-out、Cookie 篡改、到期、主动撤销、disabled/deleting、供应商不可用；OTP 错误/过期/重复/暴力尝试、限流穿透及 trusted proxy 伪造；没有邮箱访问权不能恢复。若改选密码，则加入重置链接过期/复用、重置后旧会话撤销；如 OAuth 则测 state/PKCE/linking 与回调 allowlist。
3. **网络隐私**：未登录及已登录但未同意同步时，实际捕获请求证明没有本地图片、标注、文件名、预设文件/恢复备份上传；同步 payload 只含 allowlist。验证 telemetry 关闭、CSP 精确域名、日志/错误上报 redaction。仅断言前端函数没被调用不够。
4. **同步/导入冲突**：两设备同版本更新、删后离线修改、两个导入同时接近 24 上限、确定性重名、重复导入、幂等 ID 重试/换 payload、事务中断全回滚、游标过旧、schema 不兼容。预览取消零写入，整批失败零部分记录；import preview 不发送文件内容。
5. **退出/跨用户浏览器隐私**：A 云端列表加载中退出后 B 登录，晚到响应和 queued retry 不得显示/写入 B；多页签换号失效、刷新/后退/浏览器历史/Router缓存/CDN 不显旧云端内容。明确验证本地共享截图仍可见并有告知；「退出并清本地」覆盖旧/新两键及部分清除失败，不能在失败后宣称已清除。
6. **删除/备份**：重复删除幂等、删时同步竞态不复活、auth 删除失败保留受限 pending 状态；导出仅本人且不含秘密。将删除前备份恢复到隔离环境，重放删除清单后用户不复活、旧 session 失效。RPO/RTO 以演练证据报告。
7. **邮件/运维**：真实测试域名验签及送达、429/5xx 重试不重复发信、出队后进程终止、OTP 到期不补发旧码、退信抑制、预算上限；若 webhook，测试错误签名、重复、乱序和重放，事件与事务一起提交。
8. **框架/浏览器**：所选锁定版本在 Next `16.4.2`/React 19 实际构建、SSR/Action Cookie 更新和无共享缓存验证；Chromium/Firefox/WebKit 覆盖本地无登录路径、账户流程及冲突/退出关键路径，另列真机/系统邮箱与隐私模式限制。认证故障期间 PNG/ZIP 导出不应被登录阻断。

若无人维护认证、安全测试未通过、没有恢复演练、没有邮件预算/地区决定或隐私文案未确认，则不发布账户功能；保留 V2 本地路径继续工作。用户确认 D4 后再写最终规格、锁版本和执行计划，不凭本文直接部署。

## 10. D4：需要用户选择的具体内容

| D4 子项 | 推荐决定 | 其他可选项 / 待确认影响 |
|---|---|---|
| D4.1 价值/内容边界 | 可选个人账户，仅主动同步样式；截图、标注、完整构图仍只在浏览器 | 暂不做账户；或另开云端构图方案，需重新审内容/存储/费用 |
| D4.2 认证方案/维护人 | D4A：Better Auth + Drizzle + 托管 PostgreSQL，指定维护责任人 | D4B：托管 Supabase Auth，明确标准 SSR token 模型或额外 BFF；D4C：Clerk，接受其 SDK/Cookie 与服务依赖 |
| D4.3 登录方式 | 邮箱 OTP，无密码、无社交绑定 | 若要 Google/GitHub/passkey/密码，重审身份 linking、恢复、费用及测试 |
| D4.4 托管与地区 | 同一地理区域的应用计算与数据库，先根据实际主要用户/运营要求选定；稳定 HTTPS origin | 美国、欧盟或其他地区必须由用户选；认证、邮件、备份、日志地区逐项核实，不从用户时区推断 |
| D4.5 月度预算 | 接受示例 $65/月 + 独立备份/运维/税费/超量，先设告警及邮件上限 | 若有现成主机，新增服务 $45/月 + 其他项；是否接受本模型 PITR 至少再 $105/月（含 Small compute 增量）须另选 |
| D4.6 同步/保留 | 显式云端保存、24 项/账户、冲突人工选择；删除目标 24h、备份/最小 tombstone 最长 30d（建议） | 更大配额、可靠离线队列、版本历史、更短删除窗口需调整模型及成本 |

**本提案尚未替用户作出 D4 决定。** 内容边界、身份方式、运行地区、预算和维护责任明确后，才能把推荐选型转为实施授权；图像上传尤其需要单独批准，不能从「同意账户」推导。
