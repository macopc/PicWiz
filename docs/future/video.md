# PicWiz 后续方案：视频导出（D3，待用户决策）

> 历史提案：用户已选择 D3A 本地编码 POC。当前合同见 [POC 分规格](../v3/render-poc-spec.md)，此研究不代表视频已实现或普遍可用。

研究日期及官方资料访问日：**2026-10-23**。基线：V2 `0704446`；已阅读 [README](../../README.md)、[PRD](../v2/prd.md)、[spec](../v2/spec.md)、[validation](../v2/validation.md)。本文只提出产品与技术方案；没有实现、安装依赖、配置服务、申请凭据或运行视频 POC。

**建议：选择 D3A，先批准一个有停止条件的浏览器本地 POC，再决定是否交付视频 MVP。** 优先考察 WebCodecs + Mediabunny 的逐帧编码与封装；MP4/H.264 以实际输出探针通过为条件。允许经过检查的 WebM 作为用户明确选择的替代格式；都不可用时保留 PNG。MediaRecorder 留作对照实验，ffmpeg.wasm 不作自动兜底，云端不默认启用。若业务要求“所有浏览器和手机均保证 MP4”，目前证据不足，不能直接承诺。

本文中的 **事实** 指现有仓库记录或下面链接的官方资料；**建议** 指本方案的产品/工程取舍；**未测目标** 指未来 POC 的验收阈值。任何视频支持、性能、内存、费用场景均不继承 V2 的通过结论。V2 实测为 110 个单元/适配器测试和 57 个三引擎浏览器用例通过，覆盖的是现有图片能力；Playwright WebKit 和手机视口也不能证明真实 Safari/iOS 的视频编码可用。

## 1. 用户任务与范围

用户已做好一张截图，需要在产品更新、功能介绍、发布帖中用几秒钟的入场、轻微推进或重点显现，帮助观众看清变化。视频是当前截图构图的另一种发布成品，仍沿用“选图 → 选外观 → 标重点 → 选尺寸 → 检查 → 下载”的短流程。人群与价值是产品假设；没有用户访谈、支付意愿或视频需求占比证据。

建议首版只处理**当前一张截图、一个构图、一个动效、一份视频**：

- 入场：整体构图在前 20% 时间淡入，之后停留；不切掉原截图内容。
- 轻推：截图与其标注作为同一组，从 96% 缩放到 100%，在原有留白内移动，不放大裁切截图。
- 重点显现：截图先保持稳定，已有标注组在 30%–45% 时间淡入，后段充分停留；没有标注时提示先添加，不能导出一个没有意义的空效果。
- 默认 5 秒，3/5/8 秒三档；播放一次后停在最终帧，循环预览由用户手动打开。只提供一个强度档与少量命名选项，不要求编辑关键帧。

不纳入首版：视频文件导入/剪辑、录屏、摄像头/麦克风、音轨/配乐/配音、字幕轨、转场拼接、多截图故事、自由时间线、多尺寸批量视频、GIF、4K/2×、60fps、HDR/广色域、透明视频、任意第三方字体、第三方项目代码上传、平台自动发布。3D 动效是独立能力门槛，不能因为静态 3D 图能显示就纳入视频承诺。

成功结果应是“一个可播放、时长与尺寸可信、重点可读的短视频”，不是浏览器里看起来会动的 Canvas。是否提升发布效率与内容理解，应在自愿试用中观察；首版继续不装分析脚本。

## 2. 页面、流程、移动端和状态

### 2.1 桌面流程

1. 在现有导出区增加“视频”入口。无截图时显示入口说明和“添加截图”；不生成默认空视频，也不要求注册。
2. 打开视频面板，冻结前先允许调整动效、3/5/8 秒、画幅。显示“在此浏览器生成；不会上传截图”，同时标明视频尺寸与 PNG 设置分别管理。
3. 用户点击“播放预览”，观看基于真实截图、真实标注和相同时间函数的动态预览；可暂停、重播、拖动进度，查看起始/中间/最终帧。不能用装饰性 CSS 动画或预录示例替代实际构图预览。
4. 点击“检查并生成”。先做本地能力探针，再冻结内容快照。明确显示将生成的实际容器、编码、尺寸、30fps 和时长；探针不通过时给出可选路径，不默默更改格式或尺寸。
5. 显示“正在准备 / 已编码 83/150 帧 / 正在封装 / 正在检查成品”；不以时间流逝伪造进度或保证剩余秒数。整个过程可取消。
6. 成品通过结构与可播放性检查后，用该 **Blob 的 `<video controls playsinline>`** 显示真正的编码结果；标为“成品预览”，与生成前的“动效预览”有明确区别。用户可播放完整视频、拖动到尾部、检查压缩后小字与颜色，再点击“下载 MP4”或“下载 WebM”。无自动下载、无自动上传。

更改输入、外观、标注、动效或视频参数会使旧预览与成品失效；进入新快照前先释放旧结果。生成期间只锁定视频设置，不让 PNG 的输出尺寸被视频设置覆盖。点击关闭应说明会取消并释放本次视频；刷新后需要重新生成，历史元数据不等于可恢复的视频文件。

### 2.2 建议状态合同

| 状态 | 用户看到的内容 | 可用操作 / 下一步 |
| --- | --- | --- |
| empty | 需要一张截图 | 添加截图、返回图片编辑 |
| editing | 动效、尺寸、时长，预览尚未生成 | 播放/暂停/定位、开始检查 |
| probing | 正在检查本机编码与成品输出 | 取消；不调用网络服务 |
| unsupported | 如“此设备未通过 MP4 检查”及简短原因 | 选择已通过的 WebM、返回 PNG；较小尺寸须明确确认 |
| preparing / rendering | 快照版本、帧数进度、前台运行提示 | 取消；防重复提交 |
| finalizing / validating | 正在完成文件/检查播放 | 取消；不提前显示成功 |
| stopping | 已停止提交新帧，正在释放浏览器资源 | 等待；挂起时显示重新加载说明 |
| succeeded | 实际视频预览、实际字节/尺寸/时长/容器 | 下载、重新设置、关闭并释放 |
| failed | encoder / mux / playback / resource / timeout 分类 | 原因对应的重试、减小设置或 PNG |
| cancelled / interrupted | 本次未生成完整视频 | 显式重新开始；不把部分片段当成成品 |

生成过程切到后台或手机锁屏：建议首版将作业转为停止/中断并要求回到前台重新生成，以避免 MediaRecorder 录入停顿或移动系统资源回收导致的不可信输出。未来若要后台继续，需要单独实测和明确恢复合同，不能只依赖 `requestAnimationFrame`。

### 2.3 移动端与无障碍

- 390×844 布局采用单列全屏面板：上方等比预览，下方动效/时长/画幅；末尾留出安全区和操作区，不遮住最后一项。触控目标建议至少 44×44 CSS px，无水平页面溢出；竖屏画幅预览允许缩小显示，导出像素不随 CSS 或 DPR 变化。
- 原生按钮和有名称的进度条；键盘 Tab 可到所有控件，Enter/Space 播放，方向键在获得焦点的进度条逐帧或按标明的步长定位；不能劫持文字输入的快捷键。无需拖拽也可设置时间、选择尺寸、取消和下载。
- 给出动效的文字说明，如“标注于 1.5 秒开始出现，2.25 秒完全显示”；Canvas 旁提供构图/标注的可读摘要。进度状态用适度节流的 `aria-live`，不逐帧朗读；失败后焦点进入错误说明，关闭回到视频入口。
- 遵从 `prefers-reduced-motion`：默认静态最终帧，不自动播放或循环；保留显式“播放动效预览”。同时说明此设置只影响界面预览，导出文件仍含所选动效；提供“改为淡入”或返回静态 PNG 的明确选择。不得在后台静默替换用户选定的视频。
- 不设计闪烁、快速反复缩放或依赖声音传达信息。全片无音轨；不是静音音轨。成品含动态视觉但没有对话，无需为不存在的语音伪造字幕。
- 手机下载/系统分享另行验证：优先显式文件下载；只有 `navigator.canShare({files})` 和真机流程通过时才展示“分享文件”。没有分享能力时仍保留下载；不以分享成功等同平台发布成功。

## 3. 输出合同与浏览器能力

### 3.1 首版精确规格（建议，尚未测量）

| 项目 | MVP 候选值 | 边界 |
| --- | --- | --- |
| 画幅 | 横版 1280×720；方形 720×720；竖版 720×1280 | 偶数尺寸；和 V2 PNG 的六尺寸/1×/2×分别定义，不偷偷改 PNG |
| 帧率 | 恒定 30fps | 3/5/8 秒分别 90/150/240 帧；不接受未说明的掉帧成功 |
| 时长 | 3、5、8 秒，默认 5 秒 | 最终帧的展示时长包含在总时长内 |
| 首选文件 | MP4，H.264/AVC，无音轨、不透明、8-bit SDR | 必须完成实际编码+封装+解码探针 |
| 替代文件 | WebM，优先 VP9，其次 VP8，无音轨、不透明 | 用户明确选择；不冒充 MP4，不承诺所有发布平台接收 |
| 码率候选 | 视频目标 4,000,000 bit/s；关键帧间隔不超过 2 秒 | 目标码率不是实际文件大小保证；小字清晰度/实际字节需验证 |
| 未纳入首版 | 1920×1080、1080×1080、1080×1920、4K、2×、60fps | 1080 系列可在后续独立探针和预算达标后开放，不能由 720p 支持推导 |

逐帧方案采用 `N = durationSeconds × 30`，第 i 帧时间戳为 `round(i × 1,000,000 / 30)` 微秒，帧持续时间取相邻舍入时间戳之差；避免把每帧都写成 33,333 微秒而累积漂移。`renderAt(i)` 和预览定位使用同一个帧索引，不依赖墙钟动画跑完。最终文件实际维度、帧率、帧数、时间戳、时长与音轨数均检查；扩展名必须与探测到的容器一致。

720p H.264 探针可以考察完整 codec string `avc1.42E01F` / `avc1.4D401F`，但这只是候选 profile/level；最终配置应记录实际被支持并产出文件的完整字符串。WebCodecs 的 AVC packet format 要与 MP4 muxer 匹配，包含实际 `decoderConfig` / 编码初始化信息；不能只把裸 `EncodedVideoChunk` 拼成 `.mp4`。具体 profile、像素格式及全范围/有限范围行为由 POC 确认。

### 3.2 已核实事实与正确的探测顺序

**事实：** WebCodecs 暴露低层帧与编码器，不替应用提供完整 MP4 文件；Chrome 官方工作流也区分编码与 muxing。Mediabunny 可以写 MP4/WebM 等容器，但其文档明确说浏览器 codec 可用性不能由库保证。[Chrome WebCodecs 工作流](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)、[Mediabunny 格式与编码](https://mediabunny.dev/guide/supported-formats-and-codecs)。

**事实：** `VideoEncoder.isConfigSupported()` 检查指定配置；它不是对未来整个作业的成功保证。规范存在异步编码错误、资源回收和 `close/reset` 语义。Mediabunny 的通用 `canEncode('avc')` 默认仅检查典型 1280×720 配置，不能替代对实际尺寸/帧率/码率的检查。[W3C WebCodecs，2026-10-19 工作草案](https://www.w3.org/TR/2026/WD-webcodecs-20261019/)、[Mediabunny encodability](https://mediabunny.dev/guide/supported-formats-and-codecs#querying-codec-encodability)。

建议每次导出按以下顺序判断，不以浏览器名称、版本表、`VideoEncoder` 存在、硬件加速偏好或能播放 H.264 作为编码可用结论：

1. HTTPS/localhost、安全上下文、所需 Canvas/Worker/编码 API 是否存在；Worker 或 OffscreenCanvas 不可用时，只有经过同等测试的主线程串行适配器才可启用，否则 PNG。
2. 检查所选容器与 codec 组合，再用实际 `width/height/framerate/bitrate`、完整 codec string、AVC format 做配置探测。`hardwareAcceleration: 'prefer-hardware'` 只是偏好，不能说明设备具备某个编码器。
3. 用本地合成色卡和帧编号，在**同一目标尺寸**实际编码 1 秒/30 帧，flush、封装，解析容器和时间戳，再用本机实际解码验证首/中/尾；全过程有超时、预算和清理。通过才显示“本次可生成 MP4”。同一页面可短期缓存相同配置，但编码失败、恢复前台或资源变化时失效；真实作业仍可能失败。
4. 作业完成后再次检查实际文件结构，并在 `<video>` 中加载和播放，不能把 `canPlayType()` / MediaCapabilities 的肯定结果当实际成品证据。生产可做有界结构与抽帧检查；POC/回归用独立解码器检查全片，不让同一编码库自证正确。
5. MP4 不可用：明确提供已通过探针的 WebM；若较小画幅可行，先展示真实的新尺寸再由用户选择。均不可用或探针挂起：禁用视频生成并保留 PNG。不得自动上传或循环换编码器无限重试。

**事实：** Safari 18.4 官方发布记录已加入 MediaRecorder 的 WebM/VP8/VP9 与更多视频格式；继续沿用“Safari 只能录 MP4”的 2020 年旧结论是不准确的。但这些发布记录也不能说明当前所有设备/OS 对所有编码路径都支持同样配置。[WebKit Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/#media)。

**建议：** 支持声明按“浏览器构建 + OS 版本 + 设备 + 实际 API/编码配置 + 成品解码”记录。Chromium、Firefox、WebKit 各自都执行能力检测；Chromium 的系统媒体组件/发行构建差异、Firefox 的平台媒体实现、Safari 的设备硬件/OS 都应进入测试矩阵。一个 OS 上可播放 MP4、WebRTC 可用 H.264、或浏览器声称支持 WebCodecs，均不足以推导该设备可以用目标参数导出 MP4。此处不宣称未经测试的全平台编码覆盖。

## 4. 四条技术路径比较

以下工程成本是相对判断，不是报价或工期承诺；包括失败/取消、真实成品检查、三引擎及真机验证，不能只按“导出示例代码”的行数计算。

| 路径 | 真实工作流 | 优点 | 主要成本 / 风险 | 判断 |
| --- | --- | --- | --- | --- |
| MediaRecorder + Canvas `captureStream` | 前台按实时节奏绘制 Canvas → capture track → recorder 分片 → stop → 合并/检查文件 | 浏览器负责封装；最短可行实验；仍可本地完成 | API 与 MIME 均需检测；录制受绘制/调度影响，通常至少花费片长；精确帧数、后台暂停、尾帧/时长、分片峰值和 stop 收尾须实测；低初始成本、中高产品化成本 | POC 对照或后续明确标为“实时录制”的模式，不能无条件代替逐帧合同 |
| WebCodecs + Mediabunny | 纯时间函数出帧 → 本机 encoder → MP4/WebM mux → 检查与下载 | 不需实时等待；时间戳/帧数可控；共用 Canvas/未来 3D 出帧；仍保留本地隐私 | 原生 codec/OS 可用性；异步队列、编码器资源、mux 正确性、字节预算和清理；中高工程成本 | **首选 POC；通过后优先 MVP** |
| ffmpeg.wasm | 本地载入固定 WASM core → 写入帧序列或中间文件至虚拟 FS → 软件编码/封装 → 读回 → 清理 FS/worker | 固定 build 可提供其包含的软件编码器；不依赖 WebCodecs 的同一 native encoder | 冷启动与大资源包、FS 拷贝、帧序列/输入/输出同时驻留、CPU/耗电、移动内存；多线程部署隔离要求和 GPL 组件核查；高成本 | 不自动下载、不作“兼容所有浏览器”的万能 fallback；只有独立 POC 达标且用户愿接受负担时考虑 |
| 自有云 worker：原生 FFmpeg 或 Remotion | 经确认上传快照 → 私有存储 → 队列 → 固定版本 renderer/FFmpeg → 验证 → 短效下载 → 清除 | 可控制服务器 codec build、资源与渲染版本；有机会满足更统一的 MP4 交付 | 改变零上传承诺；新增身份/所有权、队列、数据库/状态、存储、重试/计费、运维与数据删除；最高总体成本 | 仅在“统一 MP4 高于本地隐私”且另行批准后启动 |

**事实：** Canvas capture 的 `requestFrame()` 控制何时请求抓帧，不是离线编码时钟；alpha 也可能被后续消费者丢失。MediaRecorder 的 `isTypeSupported()` 成立时仍可能因资源不足录制失败；分片不是独立可播放成品保证。[W3C DOM capture](https://www.w3.org/TR/mediacapture-fromelement/)、[W3C MediaStream Recording，2026-03-16 工作草案](https://www.w3.org/TR/2026/WD-mediastream-recording-20260316/)。因此 MediaRecorder POC 必须检查实际输出，不能通过 `captureStream(30)` 的参数宣称精确 30fps。

**事实：** ffmpeg.wasm 官方示例提示 core 约 31 MB，多线程要求 SharedArrayBuffer；这涉及跨源隔离部署条件。其性能页给出的是旧版 core/Chrome 116 在指定 Linux 机器上的结果，不能当作 PicWiz 或 2026 手机基准。FAQ 仍记载 2 GB 输入上限，也不是安全内存预算。[ffmpeg.wasm usage](https://ffmpegwasm.netlify.app/docs/getting-started/usage/)、[performance](https://ffmpegwasm.netlify.app/docs/performance/)、[FAQ](https://ffmpegwasm.netlify.app/docs/faq/)。本地自托管 WASM 可避免第三方 CDN，但不会消除内存和 CPU 成本；不得为了加载库宽泛放开当前 CSP。若研究多线程，应逐项验证 COOP/COEP、同源资源和现有交互的影响。

Remotion 是可选的 React 场景/帧渲染工具链，**并非付了授权费就获得代管云渲染服务**。可在自有 Node worker 用固定模板生成帧/视频，或另行部署 Remotion Lambda；需自己承担基础设施。它的浏览器渲染仍依赖浏览器编码能力，不能解决所有 MP4 不支持问题。[Remotion 渲染路径](https://www.remotion.dev/docs/render)、[Remotion 条款的服务/基础设施说明](https://www.remotion.dev/docs/terms)。

若云端只处理已定义的 2D 入场/淡入，固定 FFmpeg filter graph 或共享确定性帧 renderer 较直接；若未来确需 React/3D 场景、复杂模板与跨端预览，再衡量 Remotion 的复用价值。无论用哪条云路径，禁止用 FFmpeg 的 URL 输入接收任意外链，禁止执行用户上传的模板代码。

## 5. 共享场景、时间线与版本化导出计划

建议把视频作为静态构图的时间维度，定义下面的概念边界，而不是为每种编码器复制画面逻辑。以下是未来接口/数据设计，不是本次新增模块。

| 边界 | 建议职责与数据 |
| --- | --- |
| SceneSnapshot | 不可变的 source 本地引用/内容摘要、源尺寸、look、annotations、构图几何、字体清单、templateId/templateVersion、rendererVersion；不保存 DOM 或任意可执行脚本 |
| MotionTimeline v1 | 一个 scene、motionPresetId/version、durationFrames、受限参数；`evaluate(frameIndex)` 输出平移/缩放/opacity 等确定性值。无自由关键帧编辑 UI |
| ExportPlan v1 | schemaVersion、sceneHash、timelineVersion、width/height、fps、frameCount、实际完整 codec/container 配置、color/alpha/audioPolicy、engine/adapterVersion、预算、job/attempt ID；冻结后不能变更 |
| SceneRenderer | prepare(snapshot, signal)、renderAt(frameIndex, target)、dispose；只出帧，不选择编码器、不上传、不下载 |
| CapabilityAdapter | probe(actualConfig, budget, signal) → 支持/失败原因/实际输出证据；不能只返回 API 存在性 |
| LocalEncoderAdapter | begin(plan)、逐帧有背压的 add、finish → 完整 artifact、abort、dispose；明确帧所有权、实际 codec metadata、错误和 resourceSettled 状态 |
| ArtifactValidator / DownloadAdapter | 独立解析/解码检查、生成本地成品预览、显式下载和撤销 URL；renderer 不掌握保存位置 |
| FutureRemoteAdapter | create/putAssets/submit/get/cancel/delete；只接收经过授权的版本化计划和受限资产，详见云端章节 |

2D 适配器应复用 V2 `compositionLayout` / `renderComposition` 的截图比例、标注坐标、frame 与阴影语义；动效变换作用于对应图层组，不让标注在缩放后漂离截图。静态 PNG、动态预览、视频出帧共享同一 scene 解释；预览允许降分辨率，但不能改裁切、文本换行或时序。

3D 由另一适配器将批准的模型/材质、相机、灯光与截图纹理在某一帧绘成相同尺寸的 raster。视频 exporter 只消费 raster 帧，不负责模型选择和姿态编辑。3D renderer 还须具有固定 seed、固定帧采样、已加载纹理/字体/模型、GPU/context-loss 处理、材质/纹理/render-target 的 dispose，以及准确的色彩/alpha 合同。静态 3D MVP 不自动获得视频支持；未经实测的动画模板标明 `videoSupported:false`，拒绝静默退化成不匹配的 2D。

模板目录未来可声明允许的画幅、motionPreset、所需 rendererVersion 和 `supportsVideo`；普通外观预设仍只保存 appearance，不夹带 screenshot、时间线、账号信息或二进制视频。未知 plan/schema/template 版本明确拒绝或走有测试的迁移；不能用“最新模板”重渲旧计划并宣称同一快照。字节级编码结果可能随 OS/encoder 变化，版本冻结保证的是构图/时序和可审计配置，不承诺跨设备二进制完全相同。

建议首版视频设置、计划和 Blob **仅当前会话**；不扩展当前 schema 2、不把大视频塞进 localStorage、不擅自更改 V2 已冻结的 ExportJob 类型。后续若要持久化视频历史或项目，再批准独立迁移；pending 恢复只能标记 interrupted，不能声称视频可续传或从元数据重新下载。共享浏览器 profile 的本地所有权边界、明确清除和本地备份隐私说明继续适用。

## 6. 颜色、字体、alpha 与音频

建议 MVP 使用明确的 8-bit SDR sRGB 输入/画布意图，输出色彩转换与标签必须在 POC 检查。Canvas RGB 转编码 YUV、色度子采样与播放器色彩管理会影响小字和彩边；sRGB 与 Rec.709 不能仅靠换标签假装同一种传递函数。记录实际 encoder/mux 的色彩元数据，防止 full-range/limited-range 被重复转换；不承诺和 PNG 逐像素相同。测试灰阶、深浅背景、红蓝细字、渐变与中性色，必要时比较独立解码后的 RGB。

背景在出帧时先合成为不透明；不输出透明视频。不要用 WebM 能携带某类 alpha、Canvas track 有 alpha，推导跨浏览器透明成品。没有音频需求，因此不配置 AudioEncoder、不生成 AAC/Opus，也不为了满足某个容器示例而访问麦克风。若某平台拒绝无音轨视频，先记录真机/平台证据并重新决策，不自动添加音乐或申请权限。

所有字体在本地可用且 `document.fonts.ready` / 指定字体加载检查完成后才冻结画面；缺字/加载失败须给出提示。V2 标注合同仍是 Arial/Helvetica/sans-serif，各 OS 可能有字形差异；现有 UI 的本地字体不等于标注字体已完全统一。首版先保证同一次生成中预览与导出使用同一已解析字体；若要跨设备完全一致，需另选可商用、含目标中文字符的本地字体并核实授权、体积和换行变化，由后续决策批准，不在本次接入在线字体。

## 7. 预算、背压、资源所有权与取消

### 7.1 建议限制（全部待 POC 校准）

- 一个标签页最多一个视频作业；与 PNG/批量导出协调同一资源调度器，首版不同时跑重导出。允许继续阅读/取消，不同时持有第二套 encoder 与预览缓存。
- 一张当前截图；视频额外预检要求源图 ≤12 MP、单边 ≤8192，原文件仍不得突破现有 25 MiB。超过视频门槛时提示选较小截图或继续 PNG，不能因 V2 允许 40 MP 就直接用于视频，也不静默改图。
- 通过输入预检后，视频专用纹理最长边建议 ≤2048；以等比方式准备，显示可能降低文字细节。只保留所需规范化源，尽快关闭原始 decode；前处理也必须服从预算。
- 首版最多 240 帧、1280×720/720×1280 级输出；应用拥有的活动 raster/帧/canvas 账本建议 ≤96 MiB，累计接受编码数据/当前成品 ≤32 MiB；瞬时封装/Blob 可能有额外副本，不能把两项相加说成浏览器总内存保证。
- 生产者至多持有一个正在准备的帧，encoder 在途帧建议 ≤2；直接使用 WebCodecs 时 `encodeQueueSize >= 2` 就停止生产，等待 dequeue 或终止信号。使用 Mediabunny 高层 source 时必须 `await source.add()`，并验证实际队列/资源上限，不在外层另建无界帧数组。
- `width × height × 4` 只是 RGBA 账本：1280×720 一帧约 3.52 MiB，240 帧全存约 844 MiB；因此禁止先生成所有帧。12 MP 源图单个 RGBA decode 约 45.8 MiB，也说明压缩文件 25 MiB 上限不代表 decode 内存很小。GPU/driver/native encoder 和浏览器页面内存另测。
- Probe、真实编码、封装、验证、预览解码与重试共享 session 资源账本。旧 artifact/URL 未释放不能“重试刷新配额”；丢弃的视频不保留全量 encoded chunks；每个重试新 attempt，但同一 plan 的 retainedBytes 总额度不重置。
- 同一 plan 的累计工作预算建议为：最多 3 个候选 codec 探针、最多 2 次完整生成 attempt（含手动重试）、累计提交编码帧≤600、累计产生编码字节≤64 MiB、累计活动处理时间≤210 秒；达到任一项即停止，丢弃数据不返还累计工作额度。更改 plan 不是绕过挂起锁的方式；页面另设串行调度与用户可见的冷却/资源限制。上述累计工作量与“同时保留≤32 MiB”是两个独立计数。

**事实：** Mediabunny 的 source.add Promise 与 StreamTarget 都提供背压传播；不等待 Promise 会破坏整个链路的有界性。[Media sources](https://mediabunny.dev/guide/media-sources#backpressure)、[Writing media files](https://mediabunny.dev/guide/writing-media-files#applying-backpressure)。建议首版采用受限的内存成品以维持各浏览器显式下载流程；File System Access/OPFS streaming 只能作为另行探测的优化，不使其成为 Safari/Firefox 完成任务的必要条件。选择 streaming 也需要保留字节上限和取消时的临时文件清理。

帧所有权必须写进适配器合同：生产者创建 `VideoFrame`，同步提交给 native encoder 后在 `finally` 中关闭应用持有的引用；若适配器异步接收，则明确由哪方在何时关闭，不能双方都以为对方负责。`ImageBitmap`、preview decode frame、encoder/decoder、capture track、Canvas backing store、worker、mux target、Blob/URL 各有唯一 owner；prepare/probe/encode/validate 任一阶段失败都走同一幂等 dispose。正常 finish 需要 flush 和 mux finalize；失败/取消不 flush 以求一个“半成功视频”。

### 7.2 原生操作、软超时与挂起

**事实：** WebCodecs `close()` 的规范语义是中止未完成工作并释放资源；`reset()` 清状态。ffmpeg.wasm 提供命令 timeout 和 `terminate()`，后者结束 worker，重新使用需 load。两者均不能推导“应用能在所有 OS 上硬性杀掉 GPU/驱动中的原生任务并马上回收物理内存”。[W3C WebCodecs](https://www.w3.org/TR/2026/WD-webcodecs-20261019/)、[ffmpeg.wasm FFmpeg API](https://ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/ffmpeg/)。

建议取消语义与 V2 保持一致，同时区分各适配器的实际终止能力：

1. 点击取消立即置 abort/generation fence；停止新帧、后续步骤和下载，并进入 stopping。所有 await 前后检查 signal；晚到 encoder output/mux 完成/验证结果不得创建 URL、写状态或复活已取消任务。
2. WebCodecs 调用适配器 abort/close；MediaRecorder 停止绘制、调用 recorder.stop、停止全部 capture tracks，丢弃随后到来的 dataavailable，等待 stop/error 清理；WASM 调用 terminate 并丢弃 FS/worker 引用。关闭视频面板等同取消。
3. 建议软阈值：能力探针 10 秒；作业无进展 15 秒；完整作业 90 秒；取消收尾 5 秒。未测阈值只决定 UI 与调度，不宣称 native 硬超时。不使用永不结束的 flush 来“完成取消”。
4. 收尾超阈值进入 resourceBusy/hung，显示“已停止继续处理，浏览器资源尚未确认释放；请重新加载后重试”。保留逻辑资源锁，禁止并行探针/新编码；不能只因 Promise.race 超时就释放锁、悄悄重建更多 encoder。若 worker 已终止且该适配器能证明所有自有资源结束，可释放应用锁；对 native 失联仍不承诺底层回收。
5. 迟到回调只能完成清理，不能把 failed/cancelled 改成 succeeded。失败或取消的片段不提供下载；MP4 缺失尾部 metadata 不能当有效结果。成功视频的重新下载可复用同一 Blob，无需重编；主动重试必须新 attempt，原快照不变。修改配置则是新 plan。

MVP 不自动重试：encoder_error 可在资源确实释放后显式重试一次；codec_unavailable 转其它已通过格式；resource_limit 要更小输入/设置；mux_failed 和 artifact_invalid 需记录诊断后显式重试，不能反复耗电；timeout/hung 须先清理或 reload。日志只存随机 job ID、阶段、通用错误、耗时/计数，不记录截图、文件名、标注文字、字体内容或可下载 URL。

## 8. 许可证与商用条件（资料核对，不构成法律意见）

| 组件 | 2026-10-23 官方信息 | 对 PicWiz 的含义 |
| --- | --- | --- |
| 浏览器原生 API | 使用浏览器 API 不等于本项目分发一个编码器库 | 不宣称因此免除所有 codec 专利/分发义务；若分发软件 encoder，另核查实际 build 与地区/商业用途 |
| Mediabunny | 主项目为 MPL-2.0 | 可用于商业及闭源更大作品；分发时保留通知并提供覆盖文件源码，修改覆盖文件的义务与独立应用文件分开。不能写成 MIT，也不能认为扩展 encoder 都自动同许可 |
| ffmpeg.wasm | `@ffmpeg/ffmpeg` wrapper 为 MIT；core 遵循 FFmpeg 与所编入外部库的许可 | 逐项审计固定 core 的 build flags、x264 等外部组件、源码/通知与再分发方式；wrapper MIT 不覆盖整个 core |
| 原生 FFmpeg | 基础为 LGPL 2.1-or-later；启用可选 GPL 组件会改变对应 FFmpeg build 的许可 | 云端和浏览器分发路径分别审视；不把“云上跑”解释为所有义务消失，不把启用 nonfree 的 build 当可任意分发 |
| Remotion | 自定义 Free/Company License，非 MIT/Apache 的一般开源许可 | 需要核对使用主体、团队/合作方人数、具体版本、自动化用途与遥测；不能用“个人可免费”替整个 SaaS 项目定论 |

来源：[Mediabunny LICENSE](https://github.com/Vanilagy/mediabunny/blob/main/LICENSE)、[Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)、[ffmpeg.wasm FAQ](https://ffmpegwasm.netlify.app/docs/faq/)、[FFmpeg legal](https://ffmpeg.org/legal.html)、[Remotion 当前 LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)。建议依赖候选确定后锁定具体版本/源码提交及 notices，不能仅保存随时变化的 main 链接。

### Remotion 必须区分当前许可、定价页与未来条款

- 当前仓库 LICENSE 允许个人、最多 3 名员工的营利组织、非营利组织，以及尚未商业使用的评估免费使用；不符合条件需要 Company License。它也禁止为了出售/出租/再许可 Remotion 自身衍生品而复制或修改代码。免费商用不等于可以重新销售 Remotion。[当前 LICENSE](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md)。
- 官方当前定价页列出：Company 的 **Automators 为 $0.01/成功 render，月最低 $100**；Creators 为 **$25/人/月**。PicWiz 若属于需要 Company License 的自动化视频产品，不能按一张 Creators seat 代替 Automators。Player 预览本身不按导出次数计费，但官方 FAQ 将嵌入 Player 的自动化产品也归入 Automators；免费资格仍可覆盖自动化。基础设施另计。[License & Pricing](https://www.remotion.dev/docs/license/pricing)、[License FAQ](https://convert.remotion.dev/docs/license/faq)。
- **版本警示：** `/docs/terms` 当日明确标为 “Upcoming document”，要等 Remotion 5.0 发布才适用于 5.0 及之后版本，并链接 [v4 当前条款](https://www.remotion.pro/terms-4-0)。不能把 v5 的所有细则写成今天 v4 已生效的合同。v5 文本对合作方人数合计、终端用户自带 Remotion 代码的 rendering service 限制、许可遥测等有明确规定；固定 PicWiz 模板参数化的路径与任意代码渲染服务不同，但在选定版本/主体前仍需复核对应条款。[v5 待生效条款](https://www.remotion.dev/docs/terms)。
- 遥测有独立现实影响：官方文档说明浏览器 `@remotion/web-renderer` 每次成功或失败渲染均发送事件，取消除外；FAQ 说明该客户端遥测不能禁用。服务端当前仅在设置 licenseKey 时发送，v5 将对 Automators 公司客户要求设置；不能把这个未来要求混写为所有 v4 用户已经强制。[Telemetry](https://www.remotion.dev/docs/telemetry)、[License FAQ](https://convert.remotion.dev/docs/license/faq)。这与 V2 无第三方遥测/CSP 边界存在冲突，不能作为本地首选无感替换。遥测并不等于上传视频内容，但仍必须说明网络、IP/域名等信息和许可条件。

团队规模、合作外包关系和将选用的 Remotion 版本均未知；本次不判断 PicWiz 一定免费或一定付费，也不购买许可。上述美元是当日官方发布价格，不是 PicWiz 售价或未来价格承诺。

## 9. 云端备选：隐私、部署、集成与成本

### 9.1 只有用户选 D3B 后才成立

云端备选真实流程是：身份/作业所有权校验 → 展示上传内容/区域/保留期并取得本次明确同意 → 生成短效上传凭证 → 上传**当前选中快照**与必要字体/受控资源 → 验证内容摘要 → 提交作业 → 排队/渲染/封装/成品验证 → 私有短效下载 → 清理。不能在本地不支持时自动上传；用户拒绝仍可用 PNG。确认页应写明上传的是截图/标注/构图数据、将在哪个区域处理、何时删除、费用/配额、取消后可能已有算力费用，以及“清除浏览器数据”不等于删除服务端数据。

若已将截图和标注合成为一个不可变场景纹理，可少上传独立标注字段，但纹理本身仍包含这些内容。3D 路径可能需要原纹理与独立场景参数，必须如实列明。云方案改变 README 的“没有账户/数据库/对象存储/remote worker”架构，需要与 accounts 的所有权决策一起批准；本报告不替 D4 选择身份供应商。

### 9.2 建议接口与生命周期

| 接口 / 数据 | 建议合同 |
| --- | --- |
| createJob(owner, planHash, idempotencyKey) | 先验证额度、schema/version、允许的模板/尺寸/帧数；同 owner+key+hash 返回同一 job，key 相同 hash 不同报冲突；不同用户不跨租户合并 |
| authorizeUpload(jobId, assetDigest, bytes, mime) | 服务端分配 owner/job 范围随机 object key，短效、限定方法/长度/摘要；不接受任意 bucket/path/URL |
| submit(jobId) | 仅服务器确认上传完成且校验通过后入队；原子状态转换和 transactional outbox/等价可靠入队，处理“状态写了但消息未发” |
| worker lease | 消息只含 job ID；worker 读取已冻结 plan，抢 lease/attempt，心跳与租约超时；输出写 attempt 临时路径，校验后 CAS 提交一个终态 artifact |
| getJob / download | 每次校验 owner；状态不泄露他人 job 存在；仅 owner 获得短效下载，不能公开 bucket 或永久猜测式 URL |
| cancelJob / deleteJob | 先写 cancellation/deletion fence，停止排队/新工作，通知活动 worker；晚结果不发布；删除和下载授权互斥，幂等清理 assets/临时产物/最终产物 |
| retryJob | 明确新 attempt；同一成功 job 不重新渲染/重复扣费；暂态最多建议 2 次，资源/输入/许可失败不自动重试；重试仍占用同一累计计算/字节配额 |

建议云 job 状态为 `created → uploading → queued → leased → rendering → finalizing → validating → succeeded`，并有 `cancel_requested → cancelling → cancelled`、`failed`、`expired`；删除记录是 fence，不允许晚 worker 重建。状态机和 attempt 独立，终态不可重写；worker 进程退出确认/lease 到期前不能声称计算已经停止。FFmpeg 用受控 argv，先 SIGTERM/限定宽限再终止进程组；Remotion 使用其 cancel signal 并仍设置 worker 的外部 deadline。服务重启依靠 lease 恢复，不把客户端断线当作取消或另起重复付费任务。

**事实：** SQS Standard 可能重复投递，官方要求应用具有幂等性。队列“至少一次”并不提供“只渲染、只收费一次”；租约、CAS、fence 和账本需由产品工程实现。[AWS SQS at-least-once](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html)。

安全与保留期建议：

- 不可执行的严格 JSON schema，受控模板/模型/字体版本；拒绝 HTML、脚本、任意 Remotion 代码和远程 URL。图片解码先查字节/像素边界；worker 沙箱、最小权限、无任意公网出口，防 SSRF、命令注入、路径穿越和解码资源攻击。
- worker 只读取本租约 job 的私有资产；下载链接是 bearer capability，短效且不进日志。跨用户状态/取消/下载/删除必须返回统一的不可访问结果；CSRF/会话鉴权、速率限制、并发与总算力额度都在服务器执行。
- 建议原始快照和中间文件在终态后 1 小时内应用主动删除，最终视频最多 24 小时；用户可立即请求删除；孤儿上传/失败 multipart 有清理任务。对象生命周期作为兜底，不宣称配置 TTL 就在精确时刻物理擦除。
- 元数据建议保留 7 天用于重试/幂等，删除 fence 只留最小随机 ID/终态信息；不存文件名、截图摘要的跨用户索引或可恢复内容。版本化对象、备份、访问日志、故障队列中的残留及供应商实际删除时延需单独确认；不能宣称“删除后没有任何副本”。
- 授权用户拥有输入/输出及删除权；账户删除须取消作业、吊销下载、清对象与残留，不能只删本地 profile。账户迁移/地域/处理方条款是 D3B 的阻塞项。

### 9.3 可能需要的配置（仅设计，不创建 env 文件）

本地方案：无新增 secret、数据库、bucket、队列或用户账号；Mediabunny 代码与字体同源发布。浏览器 adapter 通过能力检测选择，不靠 `NEXT_PUBLIC_*` 暴露秘密。

云方案的应用配置命名候选：`VIDEO_RENDER_BACKEND`、`AWS_REGION`、`VIDEO_ASSET_BUCKET`、`VIDEO_RENDER_QUEUE_URL`、`VIDEO_RENDER_FUNCTION_NAME` 或 worker deployment ID、`VIDEO_TEMPLATE_VERSION`、`VIDEO_MAX_CONCURRENCY`、`VIDEO_MAX_JOB_SECONDS`、`VIDEO_ASSET_TTL_SECONDS`、`VIDEO_RESULT_TTL_SECONDS`。这些是拟定的 PicWiz 配置名，不是已存在变量或全部供应商强制要求。

服务器身份优先用 workload identity / IAM role，不往前端或仓库写 AWS 长期密钥。云控制面还需要作业数据库连接/既有账户 session 验证适配器；由 accounts 架构确定其变量。若选择 Remotion 并需 license key，则仅以服务器 secret 管理 `REMOTION_LICENSE_KEY`；若采用 worker 回调，还需要单独存储的签名密钥、时间戳/重放窗口和事件 ID 去重。未批准方案前不申请这些值，也不新增 `.env`。

### 9.4 成本公式与可核查场景

浏览器首选没有逐次云渲染、存储和视频下行费用；仍有应用静态资源带宽、工程维护，以及用户设备的时间/电量成本。不能称总成本为零。

云端总成本建议按以下口径估算，币种美元，税/优惠/免费额度另算：

`C = Σ(每个 attempt 的 GB·s × computeRate) + worker/API 调用 + queue 请求 + 状态数据库 + 原图/中间件/成品的 GB·month + PUT/GET/多段请求 + 实际下载/预览 GB × egressRate + 日志/密钥/网络/NAT + 可选 Remotion 许可`。

**当日已查到的官方发布单价：** AWS Lambda x86 按需计算示例采用 `$0.0000166667/GB·s` 与 `$0.20/百万请求`；[Lambda 官方价格页](https://aws.amazon.com/lambda/pricing/)。S3 us-east-1 当前官方 price list（publicationDate `2026-10-15T17:35:40Z`）列出 Standard 首 50 TB `$0.023/GB·month`、PUT/COPY/POST/LIST `$0.005/千次`、GET 等 `$0.0004/千次`；[S3 官方区域价格数据](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json)。SQS us-east-1 官方 price list（publicationDate `2026-09-11T12:46:07Z`）首档 Standard 为 `$0.40/百万请求`；[SQS 官方区域价格数据](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSQueueService/current/us-east-1/index.json)。选择区域、架构或服务后应重新取价，不能把这些价格无条件套到别处。

AWS Data Transfer 的 us-east-1 官方 price list（publicationDate `2026-09-16T13:22:08Z`）给出全局免费额度以外首 10 TB/月出站单价 `$0.090/GB`；[AWS Data Transfer 官方区域价格数据](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/us-east-1/index.json)。S3 区域列表中对应出站 SKU 的零价不能单独解读为所有公网下行免费，应同时核对 Data Transfer 和账户计费规则。

**未测场景，只用于判断数量级：** 每月 1,000 个成功视频；每个 10 MiB 输入、5 MiB 输出、单次 worker 2 GB×30 秒；5% 作业额外完整重试一次，总 1,050 次 attempt。假设成功后输入留 1 小时、成品留 24 小时，所有任务均匀发生于 30 天；每个成功成品预览一次、下载一次，均读完整 5 MiB；暂按 2 PUT/attempt、1 输入 GET/attempt、2 结果 GET/成功、3 队列请求/attempt、1 Lambda 调用/attempt 计算。

- 计算：`1050×2×30×0.0000166667 ≈ $1.0500`；Lambda 调用约 `$0.00021`。这不证明 2 GB/30 秒足够，Remotion 并行 frame 分片会有更多 invocation/存储请求，不能沿用这个单 worker 假设。
- 标准存储：输入约 `1050×(10/1024)×(1/720) = 0.01424 GB·month`，成品约 `1000×(5/1024)×(24/720) = 0.16276 GB·month`，合计约 `$0.00407`；不含处理中/失败残留、额外临时文件与实际到期延迟。
- 请求：PUT `2100/1000×0.005=$0.0105`，GET `3050/1000×0.0004=$0.00122`；SQS `3150/1,000,000×0.40=$0.00126`。轮询、心跳、empty receive、重驱、multipart、状态库会增加费用；不能把 SQS 三次当作所有架构的上限。
- 下行总量约 `1000×2×5/1024 = 9.7656 GB`；若账户共享免费出站额度已被其他业务耗尽且落在上述首档，约 `$0.879/月`。若仍有额度则可能减少；重复查看、重下、Range 请求与外链泄露都会增加流量，生成一次不是只下载一次。
- 上述**已列的计算+存储+请求小计约 $1.067/月，连同全额首档下行约 $1.946/月；仍未包含状态库、API、监控、NAT、空闲服务等**，绝不是整套产品报价。若不具备 Remotion Free License 资格，Automators 再加 `max($100, 成功 renders×$0.01)` 的当月许可口径；本例 1,000 次成功输出因此是至少 $100 的许可，而非 $10 的账单。许可与算力分开。

AWS S3 价格页可查区域相关下行/其他费用；本次不把不同区域或历史文章的单价伪装成 us-east-1 最新总报价。[S3 官方价格页](https://aws.amazon.com/s3/pricing/)。如果用户决定云端，必须复核最终区域与下载路径、状态存储/API/网络部署成本及实测 GB·s，再提交完整预算。免费额度未扣除，不能靠免费额度保证长期成本；失败重试即使不计 Remotion 成功 render 也消耗云算力。按 job/attempt 记账、限制每用户/每日总预算、在入队前预留额度，并对成功幂等提交结算一次。

## 10. POC 的量化通过/停止条件（尚未执行）

POC 只在用户选 D3A 后开展，使用合成截图、字体/色卡/帧编号；不以真实用户截图做网络或云测试。建议先固定参考设备与浏览器/OS 版本，再记录所有结果，包括“不支持”的配置；不把 fallback 次数当成功 MP4 数量。

| 试验 | 建议验收值 | No-go / 分支 |
| --- | --- | --- |
| 三引擎基本覆盖 | 当前 Chromium、Firefox、WebKit；三个尺寸×三个时长×三个动效，每个目标组合重复 3 次；分别记录 MP4/WebM 原生探针、真实文件结果 | 任一引擎无视频能力可安全退 PNG；但不能宣布“三引擎视频支持”。MVP 若要求三引擎视频，须各有至少一种实际可交付格式 |
| 真机与 OS | 至少一台实体 iPhone/Safari、一台中档 Android/Chrome；桌面补 macOS Safari、Windows Chromium/Firefox，必要时 Linux 发行构建；记录硬件、OS、温度/前后台条件 | 无实体设备证据不开放“支持手机视频”声明；Playwright WebKit 不是 Safari 编码器替身 |
| 精确输出 | 独立 ffprobe/解码器检查尺寸、1 视频轨/0 音轨、codec、90/150/240 帧、单调 PTS；总 duration 误差≤1/30 秒；全片解码无错 | 任意空文件、黑尾、漏帧、重复时间戳或容器与扩展名错配阻塞该路径 |
| 画面与 meaningful preview | 首/中/尾与 renderAt 期望位置相差≤1 输出 px；小字/渐变/标注在实际成品预览可读；平坦灰块独立解码 RGB 误差目标≤8/255，结构相似度目标 SSIM≥0.98（剔除已定义动画差异） | 颜色范围错误、首帧闪黑、文字跳动或预览与成品构图不同则阻塞；质量阈值不达标先调方案，不承诺 PNG 无损 |
| 性能与交互 | 5 秒 720p：参考桌面端到端 P95≤15 秒、参考真机≤30 秒，30 次记录；取消/按钮反馈≤100ms；生成中界面主线程长任务最大目标≤200ms | 不达标可缩范围或延后；不能用一台高端机器均值替代 P95/手机结论 |
| 背压与资源 | 在途帧≤2、自有活动 raster≤96 MiB、累计接受编码数据≤32 MiB；满额/+1 byte 边界正确；至少连续 20 次生成/取消/重试无队列或 URL/帧泄漏，稳定后 retained memory 无单调增长 | 未获得可信 RSS/显存测量时如实报告；任何累积失控或进程崩溃阻塞，不以账本上限冒充总 RSS |
| native 故障与晚取消 | 在 probe、prepare、add、flush、finalize、validate、下载前逐 await 注入取消；最后一帧后、成品产生前及 close 后迟到输出；模拟 encoder async error、mux exception、永不 settle 和 worker 终止 | 100% 无自动下载、无终态复活/双作业；挂起保持锁并呈现 reload 路径；不得等 90 秒后又默默成功 |
| 累计预算与幂等 | 双击提交、失败重试、probe+真实 export、旧成品尚被预览占用、重复 finalize/晚回调均计入同一资源账本；600 帧/64 MiB 累计产出/210 秒及 32 MiB retained 分别测边界与越界 | 重试重置配额、复制 blob 后漏计、取消后重建对象 URL 任一项阻塞 |
| 后台/锁屏与 GPU 回收 | 切页、隐藏 tab、锁屏、context loss、浏览器主动回收 encoder、下载失败或文件分享拒绝，均有明确终态/恢复入口 | 无期限“正在导出”、坏文件报成功或默认转云均阻塞 |
| 隐私与本地依赖 | 生产 CSP 下，全流程网络拦截验证：除批准的同源应用资源/健康请求外，没有 screenshot/标注/计划内容发送，无 CDN 字体、分析或许可遥测；无权限弹窗 | 任何图片上传或未经批准遥测阻塞浏览器本地方案 |
| a11y / mobile | 390×844 无溢出；键盘完成全流程；真实屏幕阅读器状态/焦点；reduce-motion 无自动播放；实际成品可暂停/定位；下载和真机回放均验证 | 只能看 Canvas 动画、无法操作进度/取消、手机不能保存可播放文件则未完成 |

单元/适配器测试应覆盖确定性时间戳、严格 plan validator、状态机、同计划重试预算、资源清理与取消竞态；真实浏览器测试必须编码并下载视频文件，不能用假的 encoder callback 代替 codec 证据。独立原生解码工具只作为后续测试工具候选，本次未安装。

建议 Go：至少完成参考桌面与两台真机的本地可用路线，全部正确性/隐私/取消/预算门槛通过；如某引擎只可 WebM，则按此受限支持写清楚并由用户接受。若产品要求 MP4 全覆盖而某目标配置失败，判为本地统一 MP4 **No-go**，回到 D3 决策，而不是自动加入 WASM 或云服务。若性能失败，先考虑只交付更短/更小的本地视频，不能暗中下调已选择的规格。

## 11. 未知项与 D3 决策

尚未知：目标客户实际发布平台是否接受 WebM/无音轨；720p 小字是否足够；用户更看重隐私还是所有设备统一 MP4；目标真机与 OS 的 encoder 输出、耗电、热降频、内存；实际 H.264 profiles 与色彩转换；3D renderer 是否能稳定逐帧；Remotion 使用主体/合作方人数与具体版本；最终云区域/下载路径、完整服务预算、账户架构及保留策略。上述 POC、平台手动回放和用户试用均未运行。

| D3 选项 | 用户实际批准的范围 | 后续停止点 |
| --- | --- | --- |
| **D3A：本地优先，先验证（推荐）** | 只批准隔离视频 POC；单图、三个 720 系列画幅、30fps、3/5/8 秒；MP4 真实探针通过才可用，接受明确选择的 WebM/PNG 替代；无云、无账号、无上传 | 返回实际设备/文件/性能证据后，再批准 MVP 实现；失败不自动扩依赖/服务 |
| D3C：暂缓视频 | 继续现有 PNG/ZIP 发布路径；保留本设计供以后评估 | 不做 POC 或实现 |
| D3B：统一 MP4 优先，评估云端 | 另行研究有明确上传同意的云渲染、所有权/账号依赖、固定区域、许可和完整预算；不是批准立即上传或开通付费服务 | 完成具体隐私/技术/费用方案，再由用户决定是否接入 |

不建议在没有设备输出证据前直接承诺浏览器全覆盖，也不建议把视频首版与账号、模板市场和 3D 一次性绑定。共享 scene/plan 接口可提前对齐，但每项功能有自己的可用性与授权边界。**当前等待用户选择 D3；研究文件本身不授权 POC、实现、依赖安装、账号/存储/队列接入或任何云上传。**

## 官方资料索引

以下均于 **2026-10-23** 访问，仅列本报告使用的第一方资料；工作草案、滚动文档和 main 分支以后可能变化。落地前应复核并冻结实际版本。

1. W3C：[WebCodecs 2026-10-19 Working Draft](https://www.w3.org/TR/2026/WD-webcodecs-20261019/) — 配置检查、队列、时间戳、资源与 close/reset。
2. W3C：[MediaStream Recording 2026-03-16 Working Draft](https://www.w3.org/TR/2026/WD-mediastream-recording-20260316/) — MIME、资源失败、分片与 stop。
3. W3C：[Media Capture from DOM Elements](https://www.w3.org/TR/mediacapture-fromelement/) — captureStream/requestFrame、origin-clean 与 alpha 边界。
4. Chrome for Developers：[Video processing with WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — 编码/解码与封装工作流。
5. WebKit：[Features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) — 已公布的 MediaRecorder 格式变化；不是所有设备的实时可用性证据。
6. Mediabunny：[Supported formats & codecs](https://mediabunny.dev/guide/supported-formats-and-codecs)、[Media sources](https://mediabunny.dev/guide/media-sources)、[Writing media files](https://mediabunny.dev/guide/writing-media-files) — 容器、实际参数探测、背压和输出目标。
7. Mediabunny：[LICENSE](https://github.com/Vanilagy/mediabunny/blob/main/LICENSE)；Mozilla：[MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) — 许可与覆盖文件义务。
8. ffmpeg.wasm：[Usage](https://ffmpegwasm.netlify.app/docs/getting-started/usage/)、[Performance](https://ffmpegwasm.netlify.app/docs/performance/)、[FAQ](https://ffmpegwasm.netlify.app/docs/faq/)、[FFmpeg API](https://ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/ffmpeg/) — WASM/core、隔离要求、历史基准及终止语义。
9. FFmpeg：[License and Legal Considerations](https://ffmpeg.org/legal.html) — LGPL/GPL 与外部库。
10. Remotion：[当前 LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)、[Pricing](https://www.remotion.dev/docs/license/pricing)、[License FAQ](https://convert.remotion.dev/docs/license/faq)、[v4 terms](https://www.remotion.pro/terms-4-0)、[v5 upcoming terms](https://www.remotion.dev/docs/terms)、[Telemetry](https://www.remotion.dev/docs/telemetry)、[Render](https://www.remotion.dev/docs/render) — 按版本区分许可、费用、遥测及自有基础设施。
11. AWS：[Lambda Pricing](https://aws.amazon.com/lambda/pricing/)、[S3 Pricing](https://aws.amazon.com/s3/pricing/)、[S3 区域 price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json)、[SQS 区域 price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSQueueService/current/us-east-1/index.json)、[Data Transfer 区域 price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/us-east-1/index.json) — 场景中的公开单价及尚需核价项。
12. AWS：[SQS at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html) — 重复投递与应用幂等要求。
