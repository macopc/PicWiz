# D2A／D3A 本地渲染实验规格

2026-10-23 · 状态：**READY WITH RISKS，独立工程R3及产品复审已通过；POC 未实现、未运行，全部设备与成品证据待测。** 每格式的发布包分配证书是执行前置条件；实际修正与证据边界见[评审记录](review.md)。

本文是 [V3 主规格](spec.md) 的渲染分规格；共用规则以主规格为准。基线为 V2 `0704446`，研究提案为 `9c4e899`。用户选择是 D1B 构建时 CMS 静态 Gallery、D2A 直接 Three.js、D3A 浏览器 WebCodecs＋Mediabunny、D4C Clerk 仅显式同步 Look。本文只定义 **D2A 通用手机静态 PNG POC** 和 **D3A 2D 视频 POC** 的未来实施及验收合同。

“必须／禁止”是实现约束；所有预算、时限和质量数字均为初始实验门槛，**不是现有性能、平台上限或产品支持承诺**。当前交付只写本文，不修改程序、依赖、环境文件或数据库，不安装工具、连接服务、迁移数据或提交代码。

## 1. 范围与独立性

| 工作包 | 本 POC 的唯一问题 | 通过后仍需另定的事项 |
| --- | --- | --- |
| D2A | 一个原创、无品牌的程序化通用手机，三个固定视角，能否可靠预览并输出真实静态 PNG，且可取消、释放和回退？ | 正式编辑器接入、设备库、2×、批量、持久化、产品支持矩阵。 |
| D3A | 单张 2D 截图的三个受限动作，能否经真实配置探针产生可独立解码的本地短视频？ | 产品化参数、平台接受度、正式入口、移动支持范围和维护成本。 |

Gallery 的 2D 模板与 D3A 都不依赖 D2A。D2A 的 PNG 成功不证明可逐帧输出视频；D3A 明确拒绝 `device3d` 输入。无 3D 视频、品牌硬件复刻、glTF／GLB、R3F、WebGPU、外部环境图、后处理、音轨、录屏、剪辑、任意时间线、多源、GIF、4K／60fps、批量视频、ffmpeg.wasm、云渲染或自动平台发布。

POC 不接 CMS、Clerk、数据库、账号、云存储或上传，不新增登录／注册／付费门槛。D1B／D4C 的实施由对应规格负责，不成为实验前置条件。没有分析脚本、许可遥测或截图／标题日志。失败只能提出明确的本地替代选择；不得自动下载其他引擎或转云。

## 2. 基线复用与禁止误读

已核读 `AGENTS.md`、`docs/future/{gallery-and-3d,video,product-design,decisions,review}.md`、主规格以及以下代码／相关测试：

| 既有边界 | 本地事实 | 对 POC 的约束 |
| --- | --- | --- |
| `lib/domain.ts`；`tests/unit/domain.test.ts` | 六尺寸、1×／2×；`applyLook` 保留 size／scale；Look 不含内容。 | POC 的输出参数独立，不改变 V2 尺寸或云 Look。 |
| `lib/canvas.ts`；`tests/unit/canvas.test.ts` | `compositionLayout` 与 `renderComposition` 同步；标注绘制为私有函数；源图等比 fit、标注裁切、最多三行文字。 | 未来可抽取共用背景／源图标注／前景组能力，保留现有公开签名和 flat 像素回归；不能把 DOM 截图当 renderer。 |
| `lib/browser.ts`；`tests/unit/browser.test.ts` | 原生 PNG 锁仅在 `toBlob` 回调或同步抛错时解锁；15 秒应用超时／abort 不解锁。通用下载仅接受 PNG／JSON／ZIP。 | 不直接把视频传给现有 `downloadFile`；新增有界视频下载适配器。不能从 PNG Promise rejected 推导资源已释放。 |
| `lib/batch.ts`；`tests/unit/batch.test.ts` | Batch 自有串行 `running` 与原生 PNG busy 检查；64 MiB 是成功 PNG 保留额度。 | 这不是 PNG／GPU／视频共用协调器，也不是总内存上限。未来统一接入第 6 节；POC 不扩充 Batch 内容或复用其 ExportJob。 |
| `lib/annotations.ts`、`lib/image-format.ts` | 标注为源图归一化坐标；现有输入为 PNG／JPEG／WebP，25 MiB／40 MP／16384 边，规范化边 4096。 | 实验可更严格，不放宽 V2；保留字节签名、声明尺寸和实际解码尺寸校验。 |
| `tests/e2e/exports-v2.spec.ts`、`interaction-races-v2.spec.ts` | 已有真实 PNG 尺寸、换图／拖动／撤销竞态场景。 | 新适配器要覆盖同类竞态；旧测试不提供 GPU／codec 证据。 |

V2 的 110 项单元／适配器与 57 项浏览器通过记录仅是基线历史；本轮未重跑，也不作为新 POC 的通过证据。Playwright WebKit、手机 viewport、软件 WebGL 与实体 Safari／手机 GPU／系统编码器分别记账。

## 3. `/labs/render`、部署开关与隐私

### 3.1 显式实验环境

只有独立 `/labs/render` 提供两个实验页签；默认合成图，不改正式 `/`、Gallery 或导出栏。初始页只呈现说明和参数，用户点击“初始化 3D”／“检查视频”才加载对应浏览器模块。切页签停止旧预览并清理资源，不同时初始化两套引擎。

拟定服务器配置如下，**本轮不创建配置文件**：

| 配置 | 默认与允许值 | 必须行为 |
| --- | --- | --- |
| `PICWIZ_DEPLOYMENT_KIND` | `development`／`render-lab`／`production`；非本地开发缺省按 `production` | 正式 `production` 始终返回 HTTP 404，即使误设 lab 开关也不能开启。未知值按禁用处理。 |
| `PICWIZ_RENDER_LAB_ENABLED` | 缺省 `0`，仅字面值 `1` 启用 | 本地开发也须显式开启；query、Cookie、localStorage、客户端按钮不能越过服务器检查。 |
| `PICWIZ_RENDER_LAB_ORIGIN` | 专用 `render-lab` 必填固定 HTTPS origin；不含路径、凭据或查询 | 使用独立 lab 构建／部署，TLS 有效且真实浏览器信任；错误配置拒绝开启。不是允许截图外传的地址。 |

本地 `localhost` 开发可作为潜在可信来源，但仍检查 `isSecureContext` 与实际 API。实体手机必须使用上述显式开启的可信 **HTTPS lab**，或已经验证的安全本地转发方案。**`http://192.168.x.x` 的 API 缺失只能记作 `insecure_context`，不能记作手机 codec 不支持。** 不要求参与者关闭浏览器安全检查、安装不可信证书或登录账号。lab 地址访问控制由测试部署管理，不发明产品 signup gate。

Server Component 在渲染／流式输出及导入实验组件之前检查开关并 `notFound()`，保证正式 404。实验壳为 Client Component，浏览器对象仅在 effect／用户事件内创建；`'use client'` 本身不表示免 SSR。若使用 `dynamic(...,{ssr:false})`，只在客户端边界定义。Three／Mediabunny 动态加载失败只影响本实验。

实现须遵照已安装 **Next 16.4.2** 的本地指南：`node_modules/next/dist/docs/01-app/02-guides/{lazy-loading,server-and-client-boundary,environment-variables}.md`、`01-app/03-api-reference/04-functions/not-found.md` 和 `01-app/01-getting-started/13-fonts.md`。非公开环境值由服务端检查；不得以构建时内联的 `NEXT_PUBLIC_*` 当运行时授权。lab 和正式生产分别构建，禁止把启用 lab 的构建直接晋升为正式部署。404、客户端不发起 lab 模块请求、主页面无实验入口均列入生产检查；不声称路由 404 自动保证安装包中完全没有实验代码。

**lab 的媒体 CSP 例外。** 当前 `next.config.ts` 没有 `media-src`，媒体回落到 `default-src 'self'`，不能据此假定 Blob 视频可播。仅显式开启的 `/labs/render` 文档响应在原同源策略中增加 `media-src 'self' blob:`；`/`、Gallery、账户及禁用 lab 的响应不继承这个例外。每个响应只发送**一份生效 CSP**，包括部署代理／CDN，不在旧的全局策略旁追加第二份 lab 策略：多份策略的交集仍可能阻断 Blob。保留其余指令，不增加远程媒体源、`data:` 或裸 `*`。此例外用于探针／实际成品 `<video>`，不授权上传。验收须从实际 lab 响应读取策略，在该策略下用真正 mux 完成的 Blob URL 执行 loadedmetadata→用户播放→时间推进→ended／seek；监听并脱敏记录 CSP violation。另验证远程媒体仍被阻断、正式／禁用响应未放宽。仅 `VideoDecoder` 成功或只断言 header 字符串不算播放器通过；生产构建的 HTTPS lab／真机也须测，不用开发 CSP 代替。

### 3.2 输入与诊断

默认使用本地生成的虚构界面：`portrait-ui-v1` 900×1800、`wide-ui-v1` 1600×900、`color-grid-v1` 1024×1024。包含上下左右标识、四角不同色块、灰阶 0／16／64／128／192／235／255、红蓝细字、透明边缘与渐变；文字／图标无真实客户数据。视频探针另用目标尺寸的帧号／色卡 fixture，帧号不依赖用户标题。

可选“仅在此设备试一张私有文件”，通过原生文件选择主动导入一张 PNG／JPEG／WebP。说明其仅存在本标签页；不上传、不进入 URL／RSC／Server Action、不写 localStorage／IndexedDB／Cache API／Service Worker，不收集原图、文件名、文字、内容摘要或 Blob URL。私有文件不进入测试证据包、自动截图或 trace；调试仅返回阶段／错误码。源图变更立即使旧代次失效，不自动导出。刷新丢弃实验输入。

两 POC 先验限额统一为原文件 ≤25 MiB、声明及解码像素 ≤12,000,000、单边 ≤8192；头部在原始解码前校验，解码后校验一致。实验规范化最长边 ≤2048、等比、不向上采样；明确显示缩小后的尺寸及小字风险。此限制不改 V2 的 40 MP／4096 合同。不能为了复用会落盘的编辑器导入流程而自动存私图。

无后台日志上报。内存诊断 allowlist 仅含随机 run／attempt ID、版本、阶段、参数枚举、耗时、字节／帧／资源计数、规范化错误码；原始异常文本／stack 必须先脱敏，禁止直接 `console.log(error)`。用户可显式下载不含内容的 JSON 报告。仅合成 fixture 的有意输出 PNG／视频可作为测试产物；页面 screenshot、trace、HAR／响应体默认关闭，网络证据只存方法、来源类别及是否违规。普通同源静态资源请求不是“没有网络”的承诺。

## 4. 唯一内容来源与 Scene v1 语义建议

### 4.1 不增加第二份作品模型

正式 composition 的 `source/style/annotations` 仍是唯一真值；模板字段属于主规格的 `TemplateSceneV1`。POC 只读取显式传入的 composition 视图，或在 lab 内用相同结构组装 session-only fixture 输入；不主动读取、adopt、迁移或写回用户工作区。lab 相机、动效和探针配置另存于内存，不塞进 Look。

建议渲染语义版本称 `scene-v1`：它定义“如何解释一次完整输入”，**不是持久化 `SceneDocument` 或 store schema**。未来 `RenderSnapshot` 可冻结 source lease／尺寸、Look、标注、已解析的 2D 模板布局／文字、目标逻辑坐标、renderer 版本及 lab 参数。不能在 store 中复制 data URL、源图尺寸／标注编辑副本或输出尺寸来形成另一份可编辑真值。

组装时防御性复制并冻结style／annotations／已解析文字布局等值；不直接freeze正在编辑的composition对象。source只取得同一不可变本地资产的lease引用。快照可包含一次完整渲染所需的全部值，但只能被runner读取，不能成为另一份可保存、可编辑或可同步的作品。

本 POC 不运行 store2→3、不新增迁移、不写 `composition.scene`、V2 ExportJob 或持久化 3D／视频历史。主规格独占 store v3／003，仅供 **2D TemplateScene**；Gallery 的精确 schema 不在本文重复定义。刷新仅显示“实验会话已结束”，没有恢复下载、继续编码或迁移历史的承诺。

### 4.2 两种文字空间与图层

| 内容 | 坐标／所有者 | 渲染合同 |
| --- | --- | --- |
| 源图和 `Annotation[]` | composition；相对源图 `[0,1]` | 标注跟随源图 contain、缩放和屏幕透视，先裁切在源图矩形内；不绘到 letterbox、机身或背景。不得对透视画布复用 2D 拖动命中。 |
| 场景标题 `heading` | lab 临时输入；或只读已解析的模板槽 | 画布空间纯文本，始终保持正面；不进入标注数组、屏幕纹理或云 Look。 |
| 设备参数／motion | lab session | 固定枚举及有限数值；不保存到 composition，不成为模板支持 3D／视频的声明。 |

POC 内置布局：空标题时内容区为归一化 `{x:.06,y:.06,w:.88,h:.88}`；非空标题时标题区 `{x:.06,y:.04,w:.88,h:.14}`，内容区 `{x:.06,y:.24,w:.88,h:.70}`。换画幅重新按逻辑尺寸求解，不能将横图拉伸为竖图。3D 机身与 2D 前景组均完整 fit 于内容区；所有背景覆盖整张画布。

标题最多 80 个 Unicode code point、最多两行，纯文本，无 HTML／URL／CSS。用当前已解析字体测量后自动换行；两行或高度超限即 `text_overflow`，不静默截断或缩字。标题字号 `round(min(W,H)×0.035)`，字重 600，行高 1.2，左对齐；颜色由背景预设明确指定为 `#292431` 或 `#ffffff`。规范化输出坐标先求完整布局，低分辨率预览只整体缩放，不重新换行。

源图文字标注复用 V2 校验、颜色、2／4／8 stroke、0.022／0.03／0.045 字号、最多三行与 `Arial, Helvetica, sans-serif`；字号、笔画分别按源图呈现宽度及宽度／1600 缩放。未来抽取私有标注绘制时保留矩形／箭头方向和裁切语义。2D 视频复用 `compositionLayout` 的 frame、padding、radius、shadow 计算；不得先烘焙整张 V2 背景成品再当屏幕截图。

字体：UI 和拉丁标题使用仓库同源 DM Sans Variable；中文标题／标注使用本机实际可用的 sans-serif fallback，先做缺字和换行检查，记录通用字体策略与非内容性的测量摘要。初始化等待 `document.fonts.ready` 并检查所需字体；超时／缺字显示错误，不以临时字体完成导出。预览、出帧、成品检查属于同一次字体冻结；字体 loadingdone／分辨率／内容变化使旧快照失效。系统字体跨 OS 字形不同，禁止承诺跨设备逐像素一致；本轮不新增字体依赖或在线字体请求。

## 5. 拟议模块与异步合同

下列都是**拟议路径／接口，不是已存在实现**。只建立完成 POC 所需的窄接口，不创建通用插件系统。

| 路径 | 单一职责 |
| --- | --- |
| `app/labs/render/page.tsx`；`components/labs/render-lab.tsx` | 服务端 404 条件、客户端实验表面、焦点／状态；不拥有 codec 生命周期。 |
| `lib/render/snapshot.ts`；`contracts.ts` | 严格校验、深冻结完整临时输入、资源 lease／版本／代次。 |
| `lib/render/flat-session.ts`；`generic-phone-session.ts` | 共用异步 scene session；前者提供 2D 帧，后者只静态手机 PNG。 |
| `lib/render/motion.ts`；`fixtures.ts` | 帧索引纯函数与合成 fixture；无 DOM 动画时钟决定导出。 |
| `lib/render/high-cost-coordinator.ts`；`budget.ts` | 每页排他、原生 settlement、累计预算，V2／模板调用同一协调器。 |
| `lib/render/png-operation.ts` | 包装既有 `canvasToPng`，区分 result 与原生 settled，固定 raster 寿命。 |
| `lib/video/probe.ts`；`webcodecs-session.ts`；`mediabunny-mux.ts` | 实际配置探针、原生编码器、封装；不持有 React／工作区 writer。 |
| `lib/video/bounded-target.ts`；`validate.ts`；`download.ts` | 有界文件构建、本机成品检查、显式下载与 URL 生命周期。 |
| `tests/unit/render-poc.test.ts`、`video-poc.test.ts`、`render-coordinator.test.ts` | 可注入时钟、deferred native、分配器与 fake adapter。 |
| `tests/e2e/render-poc.spec.ts`、`video-poc.spec.ts`、`render-lab-disabled.spec.ts`；`playwright.render-poc.config.ts` | 实际实验／正式禁用验证；无截图／trace 的独立配置。 |

接口草案仅表达必要类型与所有权；其中 `CompositionView` 是只读现有 composition，`Resolved2D` 是只读已解析布局，`OutputSize` 是本文允许的正整数宽高，`Ledger` 是第 9 节账本。类型不能代替运行时严格校验。

```ts
type Stamp = Readonly<{
  pageEpoch: number; workspaceEpoch: number;
  sourceRevision: number; annotationRevision: number; planId: string;
}>;
type RenderSnapshot = Readonly<{
  semantics: "scene-v1"; rendererVersion: string; stamp: Stamp;
  composition: CompositionView; resolved2D: Resolved2D | null;
  presentation: "flat" | "generic-phone-v1";
  heading: string; phone: PhonePreset | null;
  source: SourceLease; fonts: FontResolution;
}>;
type FrameRequest = Readonly<{
  size: OutputSize; frameIndex: number; frameCount: number;
  timestampUs: number; durationUs: number; motion: MotionPreset | null;
}>;
interface RasterLease {
  readonly canvas: HTMLCanvasElement; // 借读；持有人禁止改写／resize
  readonly width: number; readonly height: number;
  readonly colorSpace: "srgb"; readonly alpha: "opaque";
  release(): void; // 幂等；释放后 canvas 不得再访问
}
interface SceneRenderer {
  prepare(snapshot: RenderSnapshot, ledger: Ledger,
    signal: AbortSignal): Promise<SceneSession>;
}
interface SceneSession {
  readonly id: string;
  renderFrame(request: FrameRequest, signal: AbortSignal): Promise<RasterLease>;
  dispose(): Promise<void>; // 幂等；停止新帧，等待本会话借用资源归还
}
interface NativeOperation<T> {
  readonly result: Promise<T>; // 应用超时／取消可先终结
  readonly settled: Promise<void>; // 实际清理证明，允许一直 pending
  cancel(reason: string): void; // 幂等、同步建立 fence
}
interface VideoSession extends NativeOperation<VideoArtifact> {
  add(raster: RasterLease, timing: FrameRequest,
    signal: AbortSignal): Promise<void>; // 借读，不转移 raster 所有权
  finish(signal: AbortSignal): Promise<VideoArtifact>;
}
```

`prepare` 获取 source 的一个引用；失败／取消时由适配器自行归还，不能要求调用者清理一个从未返回的 session。late prepare 返回的 session 必须立即 dispose；挂起则仍登记未结操作。session 独占 geometry、material、texture、canvas／context、监听器；不共享未计数的全局 texture cache。snapshot 无 Three 对象、React、DOM、Blob URL、可执行函数或远程资源 URL；source lease 为不序列化的本地不透明引用，不复制源文件。

同一 session 的 `renderFrame` 串行；第二次并发调用拒绝 `render_busy`，不排无界队列。返回前的 raster 归 session，返回后由调用者唯一持有并在 finally 中 release；它仍被 PNG 原生操作借用时要由该操作托管 release。session 在 raster 归还前不得复用 backing store；dispose 不通过清零正在借用的 canvas 来伪装完成。晚帧若代次已失效，先 release 再丢弃，永不更新 UI／工作区／URL。

Video `add` 内部创建一个带精确 timing 的 `VideoFrame`；`encode` 同步提交后在 finally `close()` 应用引用。`VideoFrame` 未提交／抛错也必须关闭。adapter 自持原生引用不代表调用者可泄漏 frame；`add` 在像素拷贝完成且下游背压允许后 resolve，调用者才 release raster。取消时不清零仍被读取的 raster；由实际退出／settlement 归还。解码验证的每个 VideoFrame／ImageBitmap 也各由一个 owner 在 finally close。`finish` 首次调用封闭新输入，重复调用返回同一个完成Promise，不重复flush／finalize；finish后add拒绝，cancel／dispose均幂等，所有result只终结一次。

## 6. 每页高开销协调、取消与永不结束的操作

### 6.1 共用排他而非两个私锁

未来同一 document 必须只有一个 high-cost coordinator，涵盖 **V2 单张 PNG／复制、V2 Batch（含 ZIP-only recovery）、模板 PNG、GPU POC、Video probe／export／validate**。所有入口在副作用前 `tryAcquire(kind,id)`；忙时明确拒绝并显示当前任务，不自动积压。整个 Batch／视频管线持有同一个高层 lease；其内部 PNG／mux 不递归申请同一 lease。

获准前暂停所有动态／3D 预览，等待当前预览帧归还，释放不再需要的预览 backing store；一次最多一个高开销执行者、一个活动 renderer 和一个原生 video encoder。ready 状态的成品播放器在新作业前 pause、解绑旧 src／释放旧产物；不与新编码争用未计账解码资源。普通内容阅读和取消按钮可用。

V2复制路径仍须在原始点击手势中同步`tryAcquire`并启动`copyPng(pngPromise)`／`clipboard.write`；异步pause／prepare／PNG生产由传入Promise承接，不能先await编码再请求剪贴板。拿不到lease同步拒绝，不破坏现有用户激活语义；剪贴板错误仍给显式PNG下载，不自动重复write。

排他范围是**同一页的应用资源**，不是跨标签页、浏览器 profile、OS 或 GPU 的总内存保证。其它标签页可能耗尽原生资源，必须按实际失败处理。不得新增 SharedWorker／跨页锁服务或声称该协调器消除了系统争用。

### 6.2 状态与 settlement

可见状态为 `idle → preparing/probing → rendering/encoding → finalizing → validating → ready`；异常到 `failed/unsupported`；任何阶段可到 `stopping → cancelled/interrupted`，收尾无法确认则 `resource_busy`。错误有固定 code 与固定文案：`insecure_context`、`webgl2_unavailable`、`context_lost`、`font_unavailable`、`text_overflow`、`resource_limit`、`codec_unavailable`、`encoder_error`、`mux_failed`、`artifact_invalid`、`png_timeout`、`operation_timeout`、`cancelled`、`interrupted`、`resource_busy`。`unsupported` 不计为该格式通过。

取消、关闭、换源、换参数、清空、返回前台发现失效或主规格的 epoch／StorageEvent 失效必须先同步建立 abort＋generation fence，然后停生产、阻止下载和后续阶段。所有 awaited 成功／拒绝路径、进度回调、native output、finalize／validator 完成前后检查 signal 和 stamp；onProgress 抛错不能妨碍清理。已终结任务的晚回调只完成清理，不改变 cancelled／failed 为 ready。

| 操作 | 可终结应用结果的条件 | 协调器可释放的证明 |
| --- | --- | --- |
| PNG `toBlob` | abort／15 秒超时／异常／有效结果 | **既有实际 native callback 或同步抛错**。包装器在调用前订阅 `subscribePngEncoder` 并关联当前独占 operation，观察 busy→false；不能仅等待被软超时包装的 Promise。native 未回调时保留 raster 和锁；同步回调、重复旧回调也不能释放别人的 lease。 |
| GPU prepare／render | abort／初始化时限／context loss／有效帧 | 无在途 prepare／复制或借出帧；监听器移除、专有 geometry/material/texture/renderer dispose 完成。已提交 GPU 命令不能被 JS 硬杀；compile 等 Promise 永不结束且无法证明脱离资源时保留锁。 |
| WebCodecs＋mux | abort／错误／时限／有效完整文件 | 停生产、原生 encoder／decoder `close()` 成功到 closed、所有应用 frame 已 close、所有实际 start／add／finalize／cancel 与 target／sink 在途调用均已结清，释放 Output／source／target／stream／回调引用；按 8.3 归还完整库预留。`add` resolve、`encodeQueueSize=0`、result rejected 或一次 `cancel()` resolve 都不能单独解锁。 |
| 下载 | 显式用户点击且 generation 有效 | 不重编码；URL／播放器和独立下载租约归还。点击被拒绝记下载失败，不把文件准备好说成已保存到磁盘。 |

`NativeOperation.settled` 仅由上述证据 resolve；同步异常也须清理已取得的部分资源。PNG 或 mux／prepare 永不 settle 时，应用 Promise 可按时进入 `resource_busy`，**高层 lease 和所需 native backing store 继续保留**。不得在 timeout finally 无条件解锁，不重建第二个 encoder／renderer，不通过换 plan／切页签绕过。显示“本次已停止提交；浏览器资源尚未确认释放。请重新加载后重试”。允许晚 settlement 清理后恢复 idle，但禁止复活旧成品。

Video 取消调用原生 close 和 Mediabunny cancel，**不 await flush 来完成取消，不 finalize 半成品**。关闭整个 worker 只有在未来明确选择 worker adapter、确认 worker 结束且其所有应用资源确实归属该 worker 时才可作为清理证明；本 POC 首选主线程串行＋主动 yield，不依赖 OffscreenCanvas／Worker。close 的规范资源语义不证明所有 OS／驱动物理内存已立即归还。

超时初值：单次 prepare／字体／probe 10 秒，PNG 15 秒，作业连续 15 秒无有效进展、完整一次生成 90 秒、取消收尾 5 秒。任何一项到时停止新增工作；进度仅以真实完成帧、packet 消费或阶段完成更新，不用定时器伪造。平台可能冻结 timer；用单调时钟检查 await 前后和 resume，不能把 timer 当硬实时保证。

`visibilitychange(hidden)`、`pagehide`、锁屏／OS 回收均转 `interrupted`：停止预览、取消当前作业并失效探针。恢复前台先核对经过时间与资源；不自动继续、重试或补墙钟帧。后台再次激活发现挂起保持锁；下载与播放必须用户重新点击。清空只承诺失效并释放可控制的引用，不声称擦除浏览器／驱动内部所有副本。

## 7. D2A：程序化通用手机静态 PNG

### 7.1 固定渲染参数

只有 `generic-phone-v1`，无外部模型和品牌名称。几何单位以机身宽 1：高 2.14、厚 .09、外轮廓圆角 .10；前表面 z=.045。用圆角 Shape＋ExtrudeGeometry，curveSegments=12、steps=1、bevelEnabled=true、bevelThickness=.008、bevelSize=.008、bevelSegments=3，挤出后居中；实际包围盒包含 bevel，fit 时不能只用名义宽高。mesh 三角形合计 ≤20,000、material ≤3、texture 1 张（无 mipmap），不加镜头／商标／外部 HDR。

屏幕外框 .88×1.94、圆角 .06、z=.055；源图和其标注先画到最长边 ≤2048 的 sRGB 纹理。屏幕底色 `#121217`，源图完整 contain 在 .76×1.78 的内矩形，透明输入先在源图矩形内合成白底；不拉伸／cover，不让圆角吃掉截图四角。纹理上下方向固定，四角 fixture 必须证明无镜像／倒置。纹理在屏幕 mesh 上用白色 `MeshBasicMaterial`、`toneMapped:false`；设备受光不能染色 UI。

机身 `MeshStandardMaterial`：`#292431`、metalness=.10、roughness=.65；无透明玻璃／反射贴图。灯光固定 HemisphereLight（sky `#ffffff`、ground `#746a80`、intensity=2）和 DirectionalLight（`#ffffff`、intensity=3、position=[3,4,5]）；不启 shadowMap。POC 使用无接触阴影版本，避免未经定义的阴影质量／显存成本；此选择不改变 2D V2 shadow 语义。

相机为正交，朝 [0,0,0]，near=.1、far=100、距离=6；设备固定，三个相机预设：front（yaw=0°、pitch=0°），left（yaw=−22°、pitch=8°），right（yaw=22°、pitch=8°），roll=0。相机位置为 `6×[sin(yaw)cos(pitch),sin(pitch),cos(yaw)cos(pitch)]`。按变换后包围盒八角的投影 fit 内容区并额外留 4% 空间，保持比例，不开放自由轨道／连续旋转／相机动画。

实际创建 WebGL2 context；`WebGLRenderer` 明确 `alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'default'`，clear alpha=0，pixelRatio=1，物理 canvas 尺寸精确为请求 W×H，不能再乘 DPR。`ColorManagement.enabled=true`，屏幕 texture `SRGBColorSpace`、generateMipmaps=false、LinearFilter，renderer `outputColorSpace=SRGBColorSpace`、`toneMapping=NoToneMapping`；无广色域／HDR。透明中间层正确 source-over 合成到不透明最终 2D canvas。

初始主路径为：prepare／字体及 shader 准备 → 重新 render WebGL → **同一同步任务内立刻** `drawImage(renderer.domElement,...)` 到已有背景的最终 2D canvas → 绘标题 → 返回 raster lease → 原生 PNG 编码 → 独立解码检查 → ready。render 和复制之间无 await／rAF／用户等待；不使用上次已被清除的 drawing buffer，不用网页 screenshot／CSS transform 生成图像。捕获方向来自 Three 官方说明；具体颜色和边缘仍须实测。[Three Canvas 捕获](https://threejs.org/manual/pages/tips.html)（2026-10-23）。

第一轮不同时实现 render-target 读回替代线；若主路径在某目标设备失败，记录失败并停止该路径，另行评估 `readRenderTargetPixelsAsync`、翻 Y、颜色和缓冲寿命的修订，不能默默换实现宣称已通过。

### 7.2 预览与输出矩阵

| 模式 | 实际像素／内容 | 可用输出 |
| --- | --- | --- |
| 交互预览 | 同一布局整体缩放，最长边 min(1024,原输出长边)，DPR=1；只在参数改变时绘制 | 无自动旋转／下载；DOM 提供源图、标注、标题和视角摘要。 |
| PNG | landscape 1600×900；square 1080×1080；portrait 1080×1350；story 1080×1920；linkedin 1200×627；pinterest 1000×1500 | 六尺寸仅 1×，不透明 PNG。三个视角均需各自证据。 |
| 本次不支持 | 2×、ZIP、复制、视频、其他设备／自由角度 | 控件不出现；不以 PNG 六尺寸结果推断扩展能力。 |

背景实验仅用既有 `paper #f2f0f7`（深标题）和 `violet`（`#b9a1ff/#7950d9/#403081`，135°，白标题）；渐变轴遵循 V2 背景数学。预览和 PNG 同一 snapshot 与参数，不更换材质、文本行数或截图裁切。

初始化读取目标纹理／renderbuffer／viewport 上限并尝试真实 context／尺寸；不足则在分配前拒绝。`webglcontextlost` 使任务失效并停止导出；不自动无限恢复。允许资源结清后用户**一次**“重新初始化”；显式重建计入 session 预算，失败给“改用平面 PNG”。回退生成另一个明确的 flat plan，更新预览／输出标签，不将平面 PNG 记为 D2A 成功；它不必等待 Gallery／账号。

成品 PNG 必须独立解码、精确尺寸、alpha 全不透明、机身可见、四角源图正确、标注仅在屏幕图内、标题在画布上。屏幕内平坦色卡通道误差目标 ≤4/255，边缘与文字位置结构误差 ≤1 输出 px；抗锯齿／GPU 差异使用事先定义的边缘 mask，不要求跨 GPU PNG 二进制相同。细字须在 100% 输出查看，不能只看缩略图判定。

## 8. D3A：2D WebCodecs＋Mediabunny 视频

### 8.1 冻结计划和确定性时间

仅接受 flat `RenderSnapshot`。默认不把 Gallery 模板列为“支持视频”；POC 使用自身单图／标题布局和 V2 平面 frame 语义。未来模板只有独立验证后才能开放视频，不因具有 `Resolved2D` 字段自动承诺支持。无源图禁止开始；annotation-reveal 无标注时 `annotation_required`，不能自动换动作。

| 参数 | 冻结候选值 |
| --- | --- |
| 画幅 | landscape 1280×720；square 720×720；story 720×1280，全部偶数；不提供其余 V2 比例或 scale。 |
| 帧率／片长 | 精确有理数 30/1 fps；3／5／8 秒，默认5；分别90／150／240帧。 |
| 编码 | MP4＋H.264/AVC 优先；WebM＋VP9、其次VP8须用户选择且另过探针。 |
| 数据 | 不透明、8-bit SDR、无音轨（不是静音 AAC）、无旋转／非方像素 metadata、无用户标题／文件名 metadata。 |
| 参数 | bitrate=4,000,000 bit/s，framerate=30，latencyMode='realtime'，hardwareAcceleration='no-preference'；H.264 `avc:{format:'avc'}`。这是请求，记录实际支持配置和产物，不声称硬件加速。 |
| 关键帧 | i=0、60、120、180…显式请求，间隔最多2秒；实际关键帧间隔也检查。 |
| 单次 output 字节 | probe／生成均采用8.3：accepted packet载荷≤8MiB、位置文件／Blob≤8MiB、累计target writes≤9MiB，整池预留85.0625MiB／encoded-data容量96MiB。8秒×4Mb/s的请求约4,000,000 bytes，通常有实验余量，但码率请求不是size保证；超限失败，不截断凑文件。 |

`VideoPlan v1` 为内存深冻结：snapshot、planId、attemptId、renderer／timeline／adapter 版本、size、fps 分子分母、N、codec 完整配置、容器、颜色／alpha／audio 策略和预算版本。更改任何参数新建 plan，重试沿用旧 snapshot，不读当前编辑状态；attemptId 一次接受，双击拒绝。成功结果重新下载复用 Blob，无新 attempt。

令 `N=D×30`，`T(i)=round(i×1,000,000/30)`（0≤i≤N）；帧 i 为 `[T(i),T(i+1))`，`timestampUs=T(i)`、`durationUs=T(i+1)−T(i)`。**只生成 i=0…N−1**，不额外生成 i=N 的尾帧。前四个边界为0、33333、66667、100000 μs；N=90／150／240 的最终边界为3,000,000／5,000,000／8,000,000 μs，持续时间求和精确相等。禁止每帧固定33333μs、墙钟定时跳帧或用 rAF 次数作为导出帧数。

动作归一化进度 `p=i/(N−1)`，`clamp01(x)=min(1,max(0,x))`，`smooth(x)=x²(3−2x)`：

| 动作 | 精确定义 | 不变项 |
| --- | --- | --- |
| fade | 前景组 opacity=`smooth(clamp01(p/.20))`；p≥.20 为1。 | 背景／标题始终完整；前景组含截图、frame、shadow、全部标注。 |
| gentle-push | 前景组中心缩放 `s=.96+.04×smooth(p)`，无位移，opacity=1。 | 在完整 contain 的最终几何内从96%到100%，不裁截图；标注一起缩放。 |
| annotation-reveal | 仅标注组 opacity=`smooth(clamp01((p−.30)/.15))`。 | 背景、标题、截图、frame、shadow固定；p≥.45 标注全显。 |

最终出帧 i=N−1 必须恰好等于静态最终构图。2D 图层不能通过“整张含背景的 PNG 再缩放”实现。未来抽取 V2 背景、截图／frame 组与标注组时，共用源图坐标／绘制算法，提供 `motion=null` 的 flat 像素回归；不维护第二套稍有不同的标注 renderer。

### 8.2 探针：从配置到实际成品

API 存在、MIME、`canPlayType`、MediaCapabilities、`isConfigSupported`／`canEncodeVideo` 只决定能否继续探针。**不得单独显示“MP4 已支持”。** WebCodecs 不负责容器；AVC 也不是每个实现必须支持。[WebCodecs 规范](https://www.w3.org/TR/2026/WD-webcodecs-20261019/)、[AVC 注册说明](https://www.w3.org/TR/webcodecs-avc-codec-registration/)（2026-10-23 核读）。

每个目标 size／配置按下列顺序执行，probe 和真实导出使用同一编码／mux adapter：

1. 检查 secure context、Canvas 2D、VideoFrame、VideoEncoder、VideoDecoder、Blob／本机播放能力及3.1的实际lab媒体CSP；缺安全来源报 `insecure_context`。核对8.3本格式源码证书，缺失记前置阻塞。拒绝非finite、非法枚举及超限尺寸；取得完整output预留后才分配。本POC不依赖Worker／OffscreenCanvas。
2. 固定候选顺序：用户选择 MP4 时先 `avc1.42E01F`，失败再 `avc1.4D401F`；选择 WebM 时先 `vp09.00.31.08`，失败再 `vp8`。VP9取profile0／level3.1／8-bit作为720系列候选，不能拿不足以描述该尺寸的level1.0字符串做假阴性；这仍不是设备支持保证。[VP9注册](https://www.w3.org/TR/webcodecs-vp9-codec-registration/)、[WebM官方level表](https://www.webmproject.org/vp9/levels/)（2026-10-23）。检查容器接受 codec，再用**实际 W/H、30fps、4Mb/s、完整字符串和上述编码参数**进行 `VideoEncoder.isConfigSupported`；记录支持返回配置，关键字段被丢弃／改写不能当原配置通过。禁止 UA 支持表替代。
3. 配置通过后在**同目标像素**编码30帧／1秒合成帧号色卡，包含灰阶／彩色小字和每帧不同标记；真正 configure→encode→flush→mux finalize。验证一视频轨、零音轨、实际codec、PTS／duration和30帧；首／中／尾可区分，无黑尾／截断。
4. 使用新建 decoder／本地实际 `<video controls playsinline>`，从 mux 完整 Blob 重新打开／解码，禁止拿编码前帧充当成品预览。每次探针全部30帧由本机 VideoDecoder 重新解码，逐帧计数和 marker 检查；demux 可用 Mediabunny Input／EncodedPacketSink，但它不是独立封装正确性证据。探针 URL 用完撤销。另由第 11 节独立原生工具复查合成探针和真实导出文件，才有该设备／配置的 POC go 证据。
5. 通过后只显示“此会话此配置探针通过，生成仍可能失败”。内存 cache TTL=5分钟；key 包含 adapter／renderer版本、完整codec／容器／尺寸／fps／码率／颜色策略，缓存只含结论与脱敏计数，不留视频。后台／context loss／codec error／源字体策略变化／资源限额触发均失效。每次真实产物仍重新验证；不把探针通过当保修。

每个 plan 至多 **3 次实际编码探针**，配置检查另计最多4候选；例如两种AVC均失败后，只剩一次用户显式选择的WebM探针机会；可以明确选择PNG，不循环遍历所有编码器。探针成功文件即刻释放，不能另留一组帧／chunks；失败也消耗累计额度。

MP4失败且资源已结清时显示“MP4 未通过：选择并检查 WebM／改为 PNG”。WebM通过才可生成WebM，文件扩展名与按钮都显示WebM；若还未探针不提前称“可用”。两格式均失败则保留平面PNG；只有用户明确选择较小输入／画幅才新建计划，更新真实像素。never-settle 时先处理 resource_busy，不能在挂起 encoder 旁启动 fallback。

### 8.3 编码、封装与字节背压

#### 8.3.1 两种队列与受限输入

选用直接 `VideoEncoder` 管理队列和关闭。Mediabunny 只承担 `EncodedPacket.fromEncodedChunk`、`EncodedVideoPacketSource('avc'|'vp9'|'vp8')`、`Output`、`Mp4OutputFormat`／`WebMOutputFormat` 与目标写入。AVC 必须是 length-prefixed `avc`，首包须有真实 `decoderConfig.description`；缺失即失败，**不进入库的 Annex B 转换分支**。一个 output 只有一个视频轨，最多 240 个非空 packet，PTS／duration 必须匹配冻结帧；无 alpha／额外 sideData、音频、字幕、附件、自定义 tags／轨名／用户 metadata。编码配置字符串有固定 allowlist。首份 description≤64KiB，复制为精确长度的 buffer 后固定；后续相同 metadata 复用这份，值或 description 改变则在转交前失败，不不断复制配置历史。先比较 byteLength，再读／复制；小 view 不能把大 backing buffer 带入库。[AVC配置](https://www.w3.org/TR/webcodecs-avc-codec-registration/)、[packet source](https://mediabunny.dev/api/EncodedVideoPacketSource)（2026-10-23）。

在 `output.start()` 前添加该唯一轨。callback 不能靠 `async` 被浏览器 await；先累计实际产出字节，再同步检查 fence、单包≤2MiB、当前 output 累计载荷≤8MiB、FIFO 槽与字节数，**全部通过后**才 `fromEncodedChunk`／copy／clone／入队。超限或取消不复制、不 forward；超限那一包及取消后的晚包仍计 plan 的64MiB／session 的256MiB累计 encoder 产出。单一 consumer 按 callback 的解码顺序 `await packetSource.add(packet,meta)`，不按 PTS 重排，不用 `Promise.all`；每次调用前再次检查 fence、源认证、完整预留仍有效及 packet／累计前置限额。

**应用 FIFO** 的计数包含正在 await add 的一包：至多2包／4MiB，单包2MiB；生产 raster1、native 输入 credit≤2、`encodeQueueSize<2` 才提交。额度不足暂停生产；已到达的同步 callback 无法暂停，若无槽立即 fence／取消，不能先复制到另一个队列。`submitted−outputCompleted` 单独计 native credit。realtime 不是一输入一图像或无重排保证；探针不满足则拒绝该路径，不删帧、不以每帧 flush 绕过。

**mux 所有的保留数据另计**。非 fragmented MP4 `fastStart:false` 仍在 `currentChunk` 保留约0.5秒媒体，30fps 常见约15包，之前多次 add 已 resolve；sample／时间表还可保留到 finalize。WebM 的 chunkQueue、cluster／cue 与 target 也不是应用 FIFO。add resolve 只归还应用槽及其引用，**绝不归还 mux／target 的完整预留**。[固定研究 revision 的 MP4](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/isobmff/isobmff-muxer.ts)、[WebM](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/matroska/matroska-muxer.ts)。

packet timestamp／duration 为**秒**，WebCodecs 为**整数微秒**。**先在转换和复制前**校验原始 `chunk.timestamp` 为 safe integer 且唯一等于一个已提交帧的 `T(i)`，并以该整数记录输入／输出关联；非null的原始 `chunk.duration` 也须是 safe integer 且等于该帧计划duration。`fromEncodedChunk` 后校验 `Math.round(packet.timestamp*1_000_000)===chunk.timestamp`，duration同样按最近整数微秒核对；不得用截断辅助getter做精确相等检查、帧ID或累计时钟。固定研究版 `microsecondTimestamp/microsecondDuration` 使用Math.trunc，浮点往返可少1μs：i=61／62／123的计划时间为2033333／2066667／4100000，截断结果为2033332／2066666／4099999，而上述round均恢复原整数；这不应拒绝合法导出。缺duration仅在已通过原始整数PTS关联后用 `clone({duration:plannedDurationUs/1_000_000})` 补全，再做round核对；实际冲突仍失败，不将错误原始时间强改成计划值。研究源码的此clone共享data，不能外推到未认证版本；适配器最多容许两份精确长度的packet payload，额外副本必须先改预留合同。真实容器／解码后PTS仍按8.4的有理数timebase容差独立验收，不借round掩盖丢帧或容器漂移。[固定packet源码](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/packet.ts)。

#### 8.3.2 位置写入与库上游分配

采用 `StreamTarget`＋本地 `WritableStream`，**`chunked:false`**，sink 并发1。64KiB 只用于应用位置文件的块和 sink 拷贝 scratch，**不是 StreamTarget flush 的大小或内存上限**。源码 `_write` 会先 `data.slice()` 保留 sections；`_flush` 会再分配整个连续区间的 Uint8Array，随后才检查／等待 writer 背压。一次 flush 可远大于64KiB。若启用库 `chunked:true`，还会分配 chunk backing、在循环内不 await 地排入多个 write，WebKit partial-view 分支再 slice；本合同禁用该分支以免漏算这些副本，不能只改 chunkSize 就沿用认证。[固定 target 源码](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/target.ts)。

sink 接到大块时先检查 safe integer position／length／end、非负、文件高水位≤8MiB及每 output 累计 write≤9MiB（回写也累计），再逐64KiB写到位置块；不简单 append，不另建无界 sink 队列。每块按 backing 实长计；8MiB 是64KiB整数倍，至多128块，洞和边缘块也不能超额分配。仅允许一个≤64KiB scratch，禁止为每片排队复制；借读的整个大块一直归上游预留，直到该 sink write 真正结束。target write 事件与 sink 边界用于核对／累计诊断；它们发生在库分配之后，**不是库内部的分配前限额检查**。

MP4 固定 `fastStart:false`、非 fragmented；WebM 固定 `appendOnly:false,minimumClusterDuration:1`，时间范围0…8秒、最多240个cluster。两者均关闭所有会 startTrackingWrites 的内容回调，包括 MP4 的 onFtyp／onMoov／onMdat／fragment 回调及 WebM 的 onEbmlHeader／onSegmentHeader／onCluster；不创建初始化／分段目标，不用 BufferTarget 作成品目标。MP4 内建的固定辅助 BufferTarget 仍计入下节辅助池，不因禁用公开 BufferTarget 就假定不存在。禁止偷偷切 fragmented、reserve、in-memory 或新增轨来沿用此预算。

#### 8.3.3 在任何 add 前取得整条 output 的保守预留

每个 probe／完整 attempt 各有一个 output。定义 `E=8MiB`（被接受的 encoder packet 载荷总和）、`H=1MiB`（证书必须证明的非载荷写入总界，含 header／索引／padding／回写）、`W=E+H=9MiB`、`F=8MiB`（位置文件／成品高水位）、`C=64KiB`。H **不是**“最后文件大小减 payload”：重复写入也占 H。每 output≤240包、description≤64KiB及上述窄配置是证明的前提，探针30帧也用同一完整预留。下表是8.3.4认证必须满足的目标池界；本轮未完成这些上界的发布包证明，未认证格式不得执行。

| 预留池 | bytes／独立 owner 与保留原因 |
| --- | --- |
| P：应用 packet／防御副本 | `2E=16MiB`；fromEncodedChunk 的精确 copy＋至多一份额外 payload copy。FIFO 活跃数仍仅2；不把整个 E 变成实际预生成队列。 |
| M：mux 保留与序列化内容 | `E+H=9MiB`；给所有已接收 packet 的库引用／可能副本及 box／EBML metadata 留全片额度，完全不依赖0.5秒何时 flush。与 P 引用同一 backing 时仍保守占两池。 |
| S：StreamTarget sections | `W=9MiB`；`data.slice()` 的总额按所有写入和 padding 计算，不能按最终 F 代替。 |
| T：连续 flush scratch | `W=9MiB`；所有连续区间的并集≤其 sections 总字节，允许整片级 allocation；单一 consumer，不并发 start／add／finalize。 |
| Q：sink 在途与 stream 排队数据 | `W=9MiB`；chunked:false 的 write 持有完整区间；即便和 T 共享 backing，也独立预留整个 output 的 write 总额，不依赖 desiredSize／highWaterMark 限制库排队。无 chunk／WebKit partial-copy 分支。 |
| I／B：位置文件与 Blob | 各 `F=8MiB`，共16MiB；位置块与一次 Blob 构造的最坏完整 copy 可同时存在；不先拼成另一个全片 ArrayBuffer。 |
| V：成品验证的压缩输入副本 | `2F=16MiB`；至多一份全片字节读取＋总 backing≤F 的 demux packet／比较副本；逐帧释放，禁止缓存所有解码帧。验证源路径也须纳入源码／API认证，native decoder／播放内存另观测。 |
| A／J：辅助 typed buffers／应用 writer scratch | `H+C=1.0625MiB`；A 须逐分配点列出 frozen description、库固定辅助 buffer、补零临时buffer、codec配置与小型 helper／prelude／序列化临时 byte buffer 的**总**上界≤H；J 只有一个 C。不能拿 A 当未审计的任意 overhead。 |

总预留 `R=2E+4(E+H)+4F+H+C=85.0625MiB`，低于**96MiB 当前 encoded-data 容量**；未使用的10.9375MiB不是准许库任意多分配的系数。P／M／S／T／Q 有意允许重复保守计数，不重复使用同一预留 token。对象／数组／Promise 另列可达数量上界与 owner：packet≤240、MP4 sample／时间表／chunk项和 WebM cue／EBML项按源码随 N 的公式、位置块≤128、write／section项按认证的写入调用数；不凭估计的“每对象若干字节”把 JS heap 算成已证明≤96MiB。这个公式只约束已审计的可达压缩／metadata backing 字节，**不是总 RSS、GC 未回收内存、native codec、播放器或 GPU 的硬界**。

预约／释放算法固定如下，不能退化成“看不到缓存就停”：

1. 先释放旧 artifact 的所有播放／下载 lease。核对本格式的固定版本源码证书、窄配置与帧数；在构造 Output／target／source、配置 encoder、分配文件块或提交首帧**之前**，原子取得全部 R token 及协调器 lease。不足即 `resource_limit`，无半套池、无第二 output。
2. token 划给表中 owner，整个 output 存续期间不缩小库池。callback 的前置 guard 在任何 copy 前执行；每次 add 前检查完整 reservation ID／fence／accepted bytes／packet数。调用后不按 packet size 临时增借，也不靠 sink 回调才申请库内 scratch。每 output 的 accepted payload≤E、forwarded packet≤N≤240；达到上限后的新包在 copy／forward 前失败。累计64MiB等第9节限额从不退款。
3. add resolve 仅删应用 FIFO 引用／归还流控槽，P／M／S／T／Q／A 的 reservation 继续**整池持有**。sink write／ready／target finalized 事件、flush 结束也不触发这些池的提前退款；记录 observed 和 reserved 两列，库不可实时观察时保留全池即可。
4. 正常：停止生产→确认 N 次提交→await encoder.flush→FIFO及单一 add 结清→关闭 packet source→await实际 output.finalize及所有 target／sink write／close结清→close encoder→确认无在途调用并删除 Output／source／target／stream／metadata／closure引用。此时才归还 P／M／S／T／Q／A／J；finalize 的 Promise 不代表外部引用已被释放。I／B 仍持有才可用位置块一次构造 Blob；构造期间 I＋B 同计，成功且位置块／parts引用归还后才释放 I。随后用 V 完成本机验证，验证实际结清并释放引用才归还 V。
5. 取消／错误先同步 fence、停生产、close encoder、清 FIFO，通知 sink 拒绝尚未开始的写入并让当前写入真实结束，再请求 output.cancel；不 flush／finalize 半片。研究版 Output 在 finalizing 时 cancel 可直接返回，**这不是取消完成**：若 finalize 已开始，仍须等待原 finalize 及 target／sink 的真实终结；其间所有池与高层锁保留，晚输出仅计累计量并丢弃。只有全部在途调用结清、闭包／库对象／位置块／部分 Blob 引用移除才归还各池；任一永不结清按6.2保持 `resource_busy`，不得因 cancel resolve 或5秒超时回收 token。
6. ready 只保留 B 及 artifact lease。preview／download URL 共享同一个 Blob，不新建 Blob／ArrayBuffer／base64 copy；URL 不是额外一份应用字节副本。B 直到用户替换／关闭 artifact，播放器 pause→remove src→load、验证与下载 lease归还、URL撤销且最后 Blob引用删除才释放。下载被浏览器内部保留的 native 数据不声称可计量／即时释放。

`getMimeType()` 若等待codec，在首包之后调用，不能在首包前 await；它不是成功证据。上述整池预留可牺牲并行率，不需要 allocator 框架、修改私有字段或 vendored 生产 fork。[Output 生命周期与 cancel／finalize 源码](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/output.ts)。

#### 8.3.4 每格式的源码证书是执行前置条件

**当前 MP4／WebM 都是待认证的设计候选，不是已证明在85.0625MiB运行的实现。** 第12节固定 research revision 只用于复查分配点。未来开始适配器实施前固定实际发布包／lock integrity／源码 fingerprint／API，再为 MP4-AVC、WebM-VP9、WebM-VP8 分别填写小型审计记录；不是新增运行服务。未取得本格式证书时在创建 Output／encoder 前返回 `blocked-by-prerequisite: mux_budget_uncertified`，不得 forward 一个 packet，也不得将该格记 unsupported 或 pass。另一已认证格式可以单独继续。

证书必须从固定源码推导并附函数／行及算式：每 payload 恰好写一次、无 Annex B 变换／alpha扩张；全部非载荷写入（首次／finalize、seek回写、补零）≤H；因此**累计** source target写入≤W，而不是仅文件高水位≤F。MP4 须逐项计 ftyp／mdat patch／moov、stts（最坏每sample两项）／ctts／stsz／stss／stsc／stco或co64、description及默认metadata；WebM须逐项计EBML／SeekHead与回写／Info／Tracks／SimpleBlock前导／Cluster size patches／Cues／最终Segment与duration回写，最坏每帧一个cluster／cue也须有界。不能拿正常4Mb/s的实测文件大小证明这个上界。

另须列全**不经 target.write 的分配**及 M／A 上界、临时序列化数组／codec helpers／内建辅助 BufferTarget，所有 section／write 调用数与对象集合增长式；证明 chunked:false 消除了 chunk backing／WebKit partial slice，单 consumer 防止 flush scratch重叠，sections与排队数据的总 backing分别≤W。验证 Input／source／packet sink 的读入与复制路径也须满足 V，不自动把 encode 侧证书当 decode 侧证书。任何项不能由前置参数与源代码证明，就保持该格式 blocked，或**先修订具体前置限额／逐池公式并复审**，不猜一个5MiB overhead／乘数，不先跑私图碰上限。

源版本、构建产物、API或选项变化即使只是patch升级也使证书失效；先做上述 fingerprint／API／allocation复核，再允许创建新 output。未来的有界计数测试验证实现符合证书；它们不能替代源推导，普通 `await add`、writer1或64KiB块也不能充当证书。本轮没有安装包、完成发布包认证、实现分配观测或运行这些测试。

### 8.4 动效预览、成品与色彩

| 表面 | 生成方式／时序 | 允许的声明 |
| --- | --- | --- |
| 静态／动态预览 | 同一snapshot和evaluate(i)，最长边≤720；播放时由墙钟映射到合法帧索引，可跳预览帧；定位直接选i。 | 仅是“动效预览”；默认最终帧，用户显式播放一次后停止。 |
| 实际编码 | 精确目标W/H与i=0…N−1，串行、不能跳帧。 | 显示真实submitted／muxed帧数和阶段，不伪造剩余秒数。 |
| 成品预览 | 仅验证过的实际Blob，非零且≤8MiB；实际lab CSP下的`video controls playsinline`，可暂停／定位／重播。 | 标明容器、实际codec、尺寸、帧数、时长与字节；生成前Canvas不能代替。 |
| 下载 | 当前ready artifact＋有效generation＋用户点击 | `picwiz-lab-<runId>.mp4/.webm`；不使用私有文件名／标题，不自动触发、不自动分享。 |

2D raster明确sRGB、先合成不透明背景；encoder配置不凭空把RGB标为Rec.709。SDR YUV转换／range与色彩metadata由实际encoder结果核验并记录；sRGB与Rec.709传递函数不能只换标签当转换。8-bit、无alpha、无音轨；颜色metadata缺失记unknown，依靠独立解码色卡决定是否接受该精确路径，冲突metadata或重复full／limited转换阻塞。目标：平坦灰／彩色块解码RGB通道误差≤8/255、已对齐且排除明确边缘mask的画面SSIM≥.98，几何误差≤1输出px；红蓝细字及渐变人工100%查看。所有阈值待测，不宣称视频与PNG无损相同。

本机对每个真实成品全片顺序decode并数帧，解码帧即时close，仅保留首／中／尾的有界比较统计；不把全片解码帧收进数组。独立工具同样检查全片，实际容器时间基下每个PTS换算与T(i)差≤1μs或一个容器tick（取较大），无重复／倒退PTS，帧数精确N，最终展示结束误差≤1/30秒。若mux timebase无法表达恒定30/1且被观察成不可信VFR则失败，不能只看平均fps标签。

下载适配器仅接受验证后的 `video/mp4`／`video/webm` Blob和匹配container；大小非零且≤8MiB；不修改V2下载白名单来顺带接受任意MIME。preview与download使用同一个Blob的独立URL，不制作额外文件副本；B池按8.3保持到artifact及全部lease释放。独立preview URL在换产物／关闭时先pause、remove src、load后撤销；独立download URL派发后按有界延迟撤销，并验证真机是否仍可保存。浏览器只能确认派发或已捕获的失败，不能宣称磁盘写入完成。失败保留ready Blob供显式重试下载，不重编；页面退出清理全部URL。不引入File System Access／OPFS／系统分享为必要条件。

## 9. 初始资源账本、累计额度与停止条件

所有分配在分配前预约，所有释放对同一owner幂等记账。账本区分**当前占用峰值**和**累计工作量**；丢弃数据不返还累计额度。source decode、缩小canvas、纹理源、最终raster、VideoFrame、packet、mux块、Blob构造、验证decoder与成品播放器均不可漏计。

| 类别 | 初始硬停止值／计数定义 |
| --- | --- |
| 应用可管理raster | 当前≤96MiB；以W×H×4计每个RGBA surface，含原始decode／规范化／预览／输出／验证frame；借用同一backing store只计一次，真实拷贝各计。外部native引用不能因此不追踪。 |
| GPU声明资源估算 | 一个renderer／scene、一个≤2048边screen texture；应用声明的color／depth／texture等预算≤64MiB，按实际样本数／格式计；驱动隐藏缓冲另测。不够则拒绝分配，不自动降分辨率。 |
| 视频在途／packet | raster生产1、native输入credit2、encodeQueueSize门槛2；**应用FIFO含正在add的一包**≤2／4MiB、单packet≤2MiB、sink并发1。mux-owned保留另由整池覆盖，不能套用FIFO2包上限。 |
| 视频文件与副本 | 每output：accepted载荷E≤8MiB、位置文件／Blob F≤8MiB、含回写／padding累计write W≤9MiB；当前encoded-data容量96MiB，任何分配／add前原子预留8.3的85.0625MiB，按owner整池释放。各格式证书未齐则禁止启动；成品B池直到artifact全部lease归还才释放。D2A PNG上限另列。 |
| 一个视频plan累计 | 实际probe≤3次、完整生成attempt≤2（含首次），累计提交编码帧≤600、累计encoder产出字节≤64MiB、累计target write字节≤96MiB、累计活动处理≤210秒。probe／丢弃／取消／手动重试全计；任何先达到即停止。 |
| 一个D2A plan累计 | 完整PNG attempt≤2、显式context重建≤1、累计PNG产出≤32MiB、累计活动处理≤60秒。单个PNG仍≤32MiB；每次native调用不论结果都计attempt。 |
| 页面实验session累计 | 视频提交帧≤3000、encoder产出≤256MiB、target writes≤384MiB、PNG产出≤128MiB、初始化／重建≤30次、活动处理≤900秒。新plan不重置；达标显示结束实验。 |

编码累计帧数只计实际提交，不把尚未执行的plan声明帧算完成；在native提交前预约计数，抛错也不返还已提交工作。产出字节在callback入口先计，再判断是否保留；codec配置检查无编码帧，但时间和次数照计。正常全部组合的批量测试通过**有记录的独立干净session**进行；仅在settled、账本归零／已解释缓存后开始新session，不能自动reload绕过挂起锁。手动创建新plan不是清空累计额度的按钮。

RGBA下界示例：1280×720一帧3,686,400 bytes≈3.52MiB，240帧全存≈843.75MiB；12MP一次decode≈45.78MiB。source与规范化副本同时存在就分别计；禁止预生成全部帧。raster96MiB、GPU声明资源64MiB、encoded-data96MiB是不同账本；encoded的85.0625MiB是源码证书前提下的保守预约，非运行实测值。不把这些数字相加当浏览器RSS、总JS heap、显存或设备内存保证。GC尚未回收的不可达buffer、native encoder／decoder、播放器、GPU驱动与下载内部副本另观测；不可测项写unknown。

硬停止：任一预算超限、重复作业／陈旧代次、队列无界、资源未确认释放、格式错误、黑尾／丢帧、隐私外传、context反复丢失或崩溃，立即停止该路径并保留脱敏失败证据。未到上限也可因真实OS错误失败；不为达到通过率隐藏unsupported／失败。

初始观测目标：3D缓存后1024边预览≤2秒、1080² PNG≤5秒、视角操作到反馈P95≤100ms；视频5秒720系列端到端参考桌面P95≤15秒、参考手机P95≤30秒；取消状态反馈≤100ms、单个主线程任务目标≤200ms。各设备分别记录30次样本、冷／热路径与热条件；达不到就提出减范围／暂停，不能改宣传文字变成已达到。正确性先于性能，超时阈值不等于性能目标。

## 10. 实验面板与可操作回退

桌面单一主预览＋参数区＋阶段／错误区，不仿造正式功能入口。390×844使用单列，操作区留safe-area和底部空间，无横向溢出；状态文字与图标同时显示。视角用三个有名称按钮，时长／动作／画幅为原生选择控件；无需拖拽即可设置、逐帧定位、取消和下载。关键触控目标≥44CSSpx；键盘可见focus，错误区和关闭后的焦点返回明确。

预览不是无标签的Canvas：旁边有标题、标注层、contain／letterbox、相机／动作及真实输出尺寸的DOM摘要。进度`aria-live`最多每秒更新，不逐帧播报；不支持时说明具体阶段及“选择其他格式／平面PNG”。不显示假“成功”和无法操作的永久spinner。

`prefers-reduced-motion`默认显示最终静态帧、禁自动播放／循环；用户可主动播放，导出仍使用明确选择的动作，并解释该差异。视频取消后无需登录、上传或转云即可回PNG。GPU失败提供flat预览和PNG，原源图保留在当前内存composition；切回后不复制旧标注到新源图。不自动降低输出像素或把fallback计为原路径成功。

## 11. 自动化、真实产物与 go／no-go

### 11.1 拟执行命令，当前均未执行

以下路径／配置／测试是未来实施交付物；不存在时是缺少验证设施，不能把命令失败或跳过写成通过。仅使用仓库已有npm脚本；独立解码器如不可用记前置缺口，不在本规格工作中安装。

```sh
# 保留V2回归；这些通过仍不证明POC能力
npm run typecheck
npm run test:unit -- tests/unit/domain.test.ts tests/unit/canvas.test.ts tests/unit/browser.test.ts tests/unit/batch.test.ts

# 新增确定性adapter套件；fake timers／deferred native，不依赖真实codec
npm run test:unit -- tests/unit/render-poc.test.ts tests/unit/video-poc.test.ts tests/unit/render-coordinator.test.ts

# 正式构建：即使误启用开关，正式部署仍404
PICWIZ_DEPLOYMENT_KIND=production PICWIZ_RENDER_LAB_ENABLED=1 npm run build
PICWIZ_DEPLOYMENT_KIND=production PICWIZ_RENDER_LAB_ENABLED=1 npm run start -- --port 3001
# 另一终端；独立POC配置不得隐式复用开发server
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- --config=playwright.render-poc.config.ts tests/e2e/render-lab-disabled.spec.ts

# 本地实验server；与上方生产检查分开运行
PICWIZ_DEPLOYMENT_KIND=development PICWIZ_RENDER_LAB_ENABLED=1 npm run dev -- --port 3002
# 另一终端；所有关键实验都带@critical，不能被当前Firefox/WebKit grep漏掉
PLAYWRIGHT_BASE_URL=http://localhost:3002 npm run test:e2e -- --config=playwright.render-poc.config.ts tests/e2e/render-poc.spec.ts tests/e2e/video-poc.spec.ts --project=chromium --project=firefox --project=webkit
```

专用配置保留串行workers=1、重试=0、真实download，timeout按作业90秒加有界收尾配置；禁用trace／screenshot／video录屏，网络observer不存body。现有默认配置会保留失败trace／截图且限制Firefox／WebKit为`@critical`，不能不检查配置直接沿用。生产检查与lab检查分别记录build SHA／flag，专用HTTPS lab另跑实际浏览器和真机；localhost三引擎不代替它。

独立解码命令候选，仅处理明确命名的**合成fixture产物**；`artifacts/render-poc/<run-id>/`为未来测试输出路径，不在当前创建：

```sh
# 将RUN_ID替换为实际合成产物目录；路径参数始终加引号
poc_artifact_dir='artifacts/render-poc/RUN_ID'
# 读取实际格式、轨数、codec、色彩、timebase和独立解码帧数
ffprobe -v error -count_frames -show_streams -show_format -of json "$poc_artifact_dir/clip.mp4"
ffprobe -v error -select_streams v:0 -show_frames -show_entries frame=best_effort_timestamp_time,pkt_duration_time,key_frame -of json "$poc_artifact_dir/clip.mp4"
# 全片实际解码；退出码0才算该项成功
ffmpeg -v error -i "$poc_artifact_dir/clip.mp4" -map 0:v:0 -f null -
```

同样检查`.webm`，保存命令、工具版本、退出码和脱敏结果，不能把ffprobe只读header当全片decode。未来验证脚本以有理数timebase核对每帧PTS／duration和marker，用独立sharp解码PNG、独立ffmpeg解码视频并计算色块／几何／SSIM；不将命令日志里的源路径或metadata用于私有文件。无ffprobe／ffmpeg等独立解码证据时，允许完成adapter测试，**不得标记视频POC go**。

### 11.2 必测adapter断言

| 组 | 自动化必须注入与断言 |
| --- | --- |
| snapshot／timeline | 结构未知键、NaN／Infinity、越界、无源、无标注reveal、device3d视频拒绝；深冻结；90／150／240帧与所有T(i)／duration和；首末动作和关键帧边界。显式覆盖i=61／62／123：原始chunk整数PTS通过、截断getter少1μs仍不误拒绝、round恢复原整数；原始PTS错1μs／重复或未提交PTS／非safe integer／原始duration冲突仍拒绝，不能靠补时修正错误输入。缺duration的clone与转换后duration同测。 |
| prepare／frame | prepare同步抛错／reject／永不结束、晚session、返回前abort、render借用冲突；每个await成功和拒绝后abort、late raster立即release，dispose两次只清理一次。 |
| GPU | 无WebGL2／超过texture与viewport、初始化部分失败、context lost／恢复一次、着色编译超时、源图替换／字体变化；PNG capture render与copy间无调度间隙。 |
| PNG与共用协调器 | 原生同步成功／null／throw、超时、预先abort、执行中abort、重复旧callback、callback永不到；V2单张／Batch／模板／GPU／Video互斥；PNG result rejected仍busy、raster未清零、late callback只清理旧lease。 |
| codec／mux | supported=true但configure／encode失败、native error异步到达、metadata缺失／变化、packet顺序与μs↔秒单位、MIME假阳性；start／add／flush／finalize／cancel／validate分别throw／reject／never-settle；首帧前不await完整MIME。 |
| 背压／预算 | credit2与第3帧、encodeQueueSize、应用FIFO含当前add的2与+1包、单包2MiB／FIFO4MiB的exact与+1byte。description64KiB／packet数240／E8MiB／F8MiB／W9MiB各exact与+1；在copy／forward／位置块分配前拒绝相应超限。E恰好8MiB不保证加header后F仍合法，各guard分开断言。全池R=85.0625MiB、available=R与R−1byte、encoded容量96MiB及+1，未完整预约时不得construct Output／configure／add；证明无按add resolve退款。视频plan encoder64MiB／write96MiB累计、D2A PNG32MiB独立覆盖，不混作视频文件上限；probe／export／retry／丢弃字节不清零。 |
| 固定源码／慢writer | 对三个格式路径分别用**实际固定发布包**和可延迟≥500ms的sink；测试专用观测不进入生产适配器。MP4先送前15个30fps包，add均可resolve但约0.5秒payload仍由mux持有，第16包／finalize触发flush；断言应用FIFO≤2时M仍占完整池。构造连续flush>64KiB（例如15×32KiB payload），分别观察section copy／连续scratch／stream排队／sink引用，峰值按整池计，不能以writer块64KiB报告库内峰值。WebM检查单轨chunkQueue、最坏cluster／cue／回写路径与slow sink；用源码分配表核对实际路径，无BufferTarget成品或tracking副本漏项。 |
| target／证书边界 | 非负offset、end溢出／非法整数、洞、重叠回写、最终8MiB及+1byte、累计9MiB及+1byte。sink拒绝证明位置store不再分配，不能声称阻止已经发生的上游clone；上游预界靠源码证书。正确确认chunked:false；chunked:true／WebKit partial-copy、fastStart变更、第二轨、description变化、包版本／源码hash／API变化、缺任一格式证书，都在创建output前阻塞，不能沿用原预留或把block记unsupported。 |
| 取消竞态 | 每个await前后、callback内立即cancel且MP4仍保留上述15包、writer堵塞中cancel、最后一帧后flush前、finalize进行中cancel、finalize后validate前、ready前、下载前、close后late output；不新flush／finalize半片，无URL／自动下载／复活／unhandled rejection。cancel已resolve而原add／finalize／sink未结清时R与锁仍持有；部分失败／late settle仅释放同owner一次，never-settle不退款。 |
| 后台／清理 | hide／pagehide／锁屏模拟、timer暂停后大跨度resume、作业90秒无进展、stopping5秒超限；永不settle保留锁，不因换plan／卸载重建对象。所有frame／bitmap／URL／listeners／canvases唯一owner。 |
| 成品／下载 | 截断MP4／WebM、错误codec／MIME／后缀、黑尾、重复PTS、漏帧、音轨／尺寸不符、decoder失败；Blob构造前I＋B同时保留，构造throw／cancel不提前退款；验证压缩副本≤V，额外copy拒绝。下载拒绝／重复显式下载共享ready Blob，不重编；URL撤销但下载／播放器lease仍在时B不释放，最后lease与引用消失后只释放一次。 |
| 实际lab CSP | 检查最终文档响应含且仅含一份生效CSP，只有开启lab的media-src为'self' blob:；不能与旧default-src策略并发发送。用真实mux Blob URL在该策略下实际play／seek／ended并检查violation；MP4与WebM分别验证，远程媒体被阻断，production／禁用lab／其他路由不放宽。decoder单测不替代它。 |

fake 证明状态机与边界，不证明native／GPU／容器可用；真实浏览器套件禁止用fake encoder输出冒充真实文件。never-settle fixture用隔离document／模块和显式清理测试环境结束，不能在产品API增加“强制解锁”测试后门。

### 11.3 必交真实矩阵，当前全部 pending

| 证据层 | 覆盖与次数 | 当前状态 |
| --- | --- | --- |
| D2A自动浏览器 | Chromium／Firefox／WebKit各：6尺寸×3视角×3源fixture×2背景；空／非空标题均覆盖，下载真实PNG且独立解码。每引擎30次进入／退出／换源清理循环。 | pending，不能以V2替代。 |
| D3A自动浏览器 | 各引擎分别跑3画幅×3时长×3动作×3次；每种声称可用格式单列，先核验格式源码证书；所有产物非零且≤8MiB、载荷≤8MiB、累计write≤9MiB，独立全片decode并在实际lab CSP下Blob播放。每配置实际probe；未认证格记blocked-by-prerequisite，设备不支持格记unsupported，fallback另列。 | pending，三个格式路径均未完成发布包认证，无“默认MP4支持”。 |
| 桌面真实浏览器 | macOS Safari、macOS／Windows Chromium、Windows Firefox，记录具体OS／browser build／硬件；至少执行相同输出矩阵，性能样本各30次。Linux仅在目标范围需要时另列。 | pending；Playwright WebKit不补齐Safari。 |
| 实体手机 | 至少一台实体iPhone／Safari及一台中档Android／Chrome，可信HTTPS lab；D2A六尺寸／三角度，D3A三画幅／三时长／三动作各3次；视频≤8MiB，在实际响应CSP下Blob播放并记录保存后系统播放器回放。 | **pending；未测真机不得宣布手机支持。** |
| 故障／资源 | 各路线至少20轮生成／取消／重试，另D2A30轮初始化释放；后台／锁屏、OS资源回收、下载失败、context loss、超预算。D3A慢sink≥500ms、mux持包／大flush／finalize-cancel均记录各池reserved／observed与release证据。不能人为制造系统崩溃影响个人资料。 | pending；取不到RSS／显存写unknown，账本上界不当作native上界。 |
| 可访问性／隐私 | 390×844与桌面键盘流程、axe＋人工读屏、reduced-motion；同源网络allowlist、无截图／标注／文字外传、无权限／账号门槛、正式404。 | pending。 |

帧fixture要能发现重复画面而非只数metadata；额外合成时序用例在测试层绘制帧号marker并逐帧核对，不能给私图添加诊断标记。真实动作的静止段允许图像相同，应比较`expected(i)`，不能把所有相同像素判成坏帧。每条实际输出对应一个run row：UTC时间、repo SHA、依赖锁／实际包版本／源码证书ID与fingerprint、部署kind和secureContext／实际文档CSP、fixture ID、设备类别／型号（人工报告，不持久GPU指纹）、OS／浏览器完整版本、requested与observed配置、container／codec／color metadata、帧数／时间／轨数、产物SHA-256、耗时／应用FIFO与mux保留分别计数／各池reserved与observed峰值／累计量、独立工具版本与退出码、结果与原因。只有合成产物可打包；私图只留不含内容的本机结果，不留内容hash。

证据包建议为`manifest.json`＋合成probe／export文件＋独立`ffprobe.json`／decode结果＋颜色／marker断言摘要＋清理／取消计数＋人工操作记录。真实设备artifact可以由测试者主动下载并私下交给独立工具，不从lab自动上传。每格枚举 `pass/unsupported/fail/pending/blocked-by-prerequisite`，缺文件／缺独立decode／缺实机都不能记pass；fallback另有一行，不覆盖失败格。

### 11.4 决策出口

**D2A go-to-next-spec**：参考桌面、实体iPhone和Android的声明范围内全部静态PNG精确／画质／取消／资源／隐私／可访问性门槛通过，提交真实文件和清理证据。某设备仅flat时可提出缩窄支持范围，但该设备D2A仍未通过。2×、批量与正式产品化另写规格，不能凭本POC自动启用。

**D3A go-to-next-spec**：上述参考桌面与两类实体手机都有至少一条**源码认证齐全**的真实可用视频格式，8MiB文件／8MiB载荷／9MiB write与整池预留合同、精确时序、独立解码、实际CSP下Blob播放、资源、后台／取消、显式下载和隐私门槛全部通过；MP4／WebM按实际设备声明。需要统一MP4却有任何目标设备未通过，则“本地统一MP4”no-go，保留PNG并返回D3选择，不引入云／WASM／音轨。若只能部分设备通过，先提交受限建议及未通过格，不宣布普遍上线。

任何路线资源无界、释放无法证明、陈旧输出复活、错误文件报ready、私图外传、或依赖／许可证无法固定，均no-go；性能／颜色达不到初值则暂停该配置，先提出调整后的新实验合同再测。两POC分别给结论，一条失败不阻塞Gallery、另一POC或既有PNG。最终交付是**证据与下一步决定**，不是本轮已经上线的3D／视频功能。

## 12. 当前一手资料核验与版本／许可记录

以下均于 **2026-10-23** 重新浏览；滚动API与仓库main／dev不是版本锁。本文不宣称某个npm版本已经安装或“最新”；未来实施开始前固定实际发布版本、package-lock、源码revision／integrity、许可证与notices，在证据manifest记录，API不匹配则修订适配器合同后再运行。8.3的源阅读使用明确revision，仍不等于发布包已认证或预算测试已运行。

Mediabunny **研究快照**为 `f630141a4ac2936d00af14bf8ff2c5bb62b66150`；以下SHA-256对应本轮从该revision读取的原始源码bytes，仅作可复查fingerprint，不是npm integrity或运行证书：

| 文件 | SHA-256 |
| --- | --- |
| [src/isobmff/isobmff-muxer.ts](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/isobmff/isobmff-muxer.ts) | `8a1d5cf1a9f689ed75be84397485c071c7c2f18180be8d8ccfc0f56f648eb362` |
| [src/matroska/matroska-muxer.ts](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/matroska/matroska-muxer.ts) | `1e7f706380f85dc9571e1f210a3213d26815688db99c37161ce2b300f1331280` |
| [src/target.ts](https://raw.githubusercontent.com/Vanilagy/mediabunny/f630141a4ac2936d00af14bf8ff2c5bb62b66150/src/target.ts) | `5c85d8a8c587aef208775302183e8865e51d46a3b540542e98a49d9494ab64db` |

未来证书还必须记录实际包与源码对应关系、编译／bundled差异以及 `packet.ts`、`media-source.ts`、`output.ts`、`writer.ts`、`output-format.ts`、`isobmff-boxes.ts`、`matroska/ebml.ts` 和可达codec／demux／输入源helpers的fingerprint／分配点。API审计至少确认 fromEncodedChunk／clone 的copy语义、add／close、start／finalize／cancel（尤其finalizing时cancel提前返回）、StreamTarget选项／位置write事件／sink settlement。对每格式分别算H、M、A、V与对象数量式后，才可签8.3证书；**本轮只完成阅读与规格修订，这些发布包匹配／完整边界证明／运行验收均未执行。**

| 事实与来源 | 本规格采用的含义 |
| --- | --- |
| [Three WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) 当前使用WebGL2，r163起不支持WebGL1；提供dispose／compileAsync及读回API。 | 必须实际WebGL2探测；不宣传WebGL1／WebGPU替代线已测。 |
| [Three色彩管理](https://threejs.org/manual/pages/color-management.html)、[对象释放](https://threejs.org/manual/pages/how-to-dispose-of-objects.html) 区分工作／输入／输出空间及geometry／material／texture的独立释放；ImageBitmap需要应用处理。 | 明确sRGB与资源owner；移除mesh不是dispose证明，renderer缓存不强求全零。 |
| [Three MIT原文](https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE) | 软件分发保留版权与许可通知；不把引擎许可当外部模型／字体授权。本POC仅原创程序化几何／合成fixture。 |
| [WebCodecs 2026-10-19 Working Draft](https://www.w3.org/TR/2026/WD-webcodecs-20261019/) 与 [AVC注册](https://www.w3.org/TR/webcodecs-avc-codec-registration/) | 依实际配置／帧timing／原生关闭语义设计；草案和codec可选支持不是设备能力证明，浏览器API也不构成通用专利免责。 |
| [Mediabunny EncodedPacket](https://mediabunny.dev/api/EncodedPacket)、[EncodedVideoPacketSource](https://mediabunny.dev/api/EncodedVideoPacketSource)、[Output](https://mediabunny.dev/api/Output) | fromEncodedChunk转换单位，add传播背压且需正确metadata，start／finalize／cancel各有独立生命周期；封装不提供系统encoder。 |
| [Mediabunny StreamTarget](https://mediabunny.dev/api/StreamTarget)、[StreamTargetOptions](https://mediabunny.dev/api/StreamTargetOptions)、[Output formats](https://mediabunny.dev/guide/output-formats) | 位置写入；本合同chunked:false，应用64KiB块不限制库上游scratch／排队。避开BufferTarget成品与fastStart in-memory，仍须计MP4内建aux target；流不等于网络。 |
| [Mediabunny MPL-2.0原文](https://raw.githubusercontent.com/Vanilagy/mediabunny/main/LICENSE)、[Mozilla FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) | 主库是MPL-2.0，非MIT。组织外分发须按覆盖文件处理源码可得性、修改和通知；与独立应用文件区分。未来固定版本保存对应源码和通知，不把可选codec扩展自动视作同许可。 |

本地API研究不增加依赖或授权服务；本轮未安装Three／Mediabunny、未运行GPU或编码、未生成真实POC产物。主规格、Gallery迁移和账户供应商实现仍由各自负责人拥有。
