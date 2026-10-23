# 模板库与 3D Mockup：待决策方案

> 历史比较：用户已选择 D1B CMS 模板库与 D2A 程序化 Three.js POC。当前合同见 [V3 实现规格](../v3/spec.md)，下文推荐保留为研究记录。

研究日期与外部链接访问日期均为 **2026-10-23**。状态：**仅研究和设计，等待用户决策；未实现、未安装依赖、未接服务**。

基线为 V2 `0704446`；已阅读 README、V2 PRD/spec/validation 和 `.interface-design/system.md`。V2 的 110 个单元/适配器测试及 57 个三引擎浏览器用例通过，是既有证据，不能证明未来 WebGL、模型或模板功能可用。下文以“事实”指已核对的本地实现或官方资料，“建议”指产品/工程判断，“待验证”指尚无实测或用户研究的假设。

## 建议及成本假设

**建议先选 D1A：Git 管理的第一方静态模板；3D 选 D2A：程序化通用设备 + Three.js WebGL2，但先批准独立 POC，再决定是否产品化。** 模板优先解决“如何说明这次更新”，3D 解决“把界面放进可信的空间构图”。二者均继续浏览器本地导出，不以账号、云存储或视频为前置条件。若当前优先级只是更快发布，先做模板、暂缓 3D 是合理选项。

先给预算模型，避免把客户端渲染误当成没有成本：

- 假设第一阶段约 6 个官方模板变体、1 名维护者、每月 1–2 次内容更新；3D 每次只有一个通用设备、一张截图，无实时动画、外部环境贴图或云渲染。这些是估算输入，尚非选定范围。
- 月增量成本 `C = 内容/资产制作摊销 + H维护×时薪 + 静态带宽×单价 + 构建/存储增量 + 可选CMS订阅/席位/API超额`。本地导出没有按张付费的服务器 GPU 项，但消耗用户设备的电量、内存与等待时间。没有报价、访问量和试用数据，不能给出可信的美元/月或每张利润。
- 带宽情景：`B = N×[G×(1-hG) + p3×(J+M)×(1-h3)]`；N 为月会话，G 为实际取到的模板缩略图/目录字节，p3 为进入 3D 的比例，J/M 为新增引擎/模型字节，h 为有效缓存命中率。**纯演算假设** G=0.5 MiB、J+M=2 MiB、p3=20%、h=0，则 1,000 / 100,000 会话分别约 900 / 90,000 MiB；这些字节数不是构建产物测量，也不是流量预测。程序化模型可减少 M，不能据此保证总包更小。
- 内存粗算：单张 RGBA8 表面 `W×H×4` 字节；3200×1800 约 22 MiB，2160×3840 约 31.6 MiB。2048² RGBA8 纹理约 16 MiB，完整 mip 链约再乘 4/3。真实峰值还包括解码图、深度、MSAA/resolve、读回缓冲、2D 合成、编码和保留 PNG；不能拿这些下界或 V2 的 64 MiB PNG 保留上限当总 RSS 保证。
- 视频是独立放大器：`帧数=时长×fps`，`总耗时≈初始化+逐帧渲染/读回+编码+封装`，流水线时以瓶颈阶段为准。10 秒×30fps 是 300 帧；1080² RGBA 全部保留约 1.30 GiB，因此必须有背压和有界帧队列。这里没有测量帧率、吞吐或设备成功率。

## 用户任务与产品边界

V2 **Look** 仅复用背景、留白、圆角、阴影、平面框和明暗，不改截图、标注、尺寸。未来 **Template** 应包含任务、内容槽、排版层级及各尺寸的重排规则；**Mockup** 是截图槽的一种呈现方式。不得把新增背景数量包装成模板能力。

优先任务是独立开发者把“一次产品变化”说明白：更新卡提供标题/版本或日期/主截图；细节卡从同一源图提取局部放大，与完整上下文并置。二者复用同一个 Look，并针对横图、方图、竖图重新安排内容。3D 的价值是通用手机/桌面设备的视角、厚度和遮挡，不能承诺提高点击或购买转化；过强透视让 UI 文本难读，应有正面视图和阅读尺寸提示。

建议模板 MVP 先做 **2 个任务族×3 个编排变体**，只引用当前一张截图；细节卡的放大区域引用同一来源，不复制图片。双图前后对比、跨平台双设备、多页轮播需要多源持久化与更复杂的适配，留下一阶段。市场、UGC、创作者上传/分成、任意设计编辑器、AI 生成素材、真实品牌设备库均是非目标。

## 流程、路由与界面合同

延续现有 DM Sans、ink/desk/paper/violet、4px 间距和画布主导的工作台。紫色仍表示选择/操作，状态配文字与图标。模板库使用可比较的输出预览，不增加仪表盘式统计卡或自动播放的 3D 卡片。

1. **发现**：`/templates?task=update&format=square` 展示官方示例、任务筛选、支持的尺寸和“需要 1 张截图”；`/templates/[slug]` 提供大预览、可编辑字段、支持能力与素材说明。编辑器内的模板入口打开同源目录对话框/手机面板，避免离开 `/` 丢失 session-only 编辑；公共路由供直接访问与分享。目录和详情仅含公开示例；无账号也可使用。URL 可含公开模板 ID/筛选项，不能包含文件名、用户文字或截图数据。
2. **试用**：公共详情的“使用模板”进入 `/?template=<id>&revision=<rev>`，编辑器内则在当前会话传入同样的公开引用；无图时显示“加入截图”及独立“使用示例”。已有图时在本地显示应用预览，列出受影响的布局/模板文案，保留截图、标注与输出选择；预览不落盘，确认应用后才进入现有本地保存流程，保存失败仍可 session-only 编辑，不自动导出。应用为一次可撤销的场景替换，取消返回原编辑状态；同一 query 不因重复渲染而再次覆盖编辑。Look 可由用户保留或显式采用模板建议，不能暗中改 V2 的 `applyLook` 语义。
3. **编辑**：画布旁“模板/内容/外观”分组；标题和元信息是画布内容字段，与截图内标注分开。更换模板按具名槽匹配，先报告不能复用的字段。源图标注仍锚定源图归一化坐标；局部放大自动重映射并裁切。模板控制内容安全区，切换六种尺寸显示完整重排预览；没有适配的组合明确不可用，不能拉伸蒙混过关。
4. **3D**：截图槽的“呈现：平面/通用设备”进入同一编辑器，不另建 3D 应用或路由。先选设备与前/左/右固定视角，再开放有限俯仰、缩放和背景。源图编辑/标注先在正面 2D 面板完成，再作为屏幕纹理更新，避免在透视平面上实现新的标注拖拽。进入 3D 后平面 frame 控件显示“不适用于当前呈现”，其原值保留供返回使用。
5. **输出**：继续现有 PNG/复制和显式下载轨道；准备导出前列出模板版本、尺寸、渲染模式和质量提示。模板多尺寸输出的预览用当前本地图；公共目录缩略图永远用虚构内容。第一阶段模板支持 PNG；3D POC 只验证单张 PNG，不把通过 POC 当作已支持批量 ZIP。

状态需覆盖：加载目录/缩略图失败但可读文字；无匹配结果及清除筛选；缺图/缺标题；字体未就绪；文案超行；模板版本不可用；模型加载/校验失败；WebGL2 不可用；上下文丢失；超资源上限；准备中/取消收尾中/失败可重试/可下载。仅阻塞受影响的操作，始终提供返回平面编辑及原图仍在的解释；不静默改变输出模式或分辨率。

390×844 下先显示画布和当前任务，内容/外观/设备为单一底部面板，导出栏不挡控件。没有 hover 才能看到的信息或仅靠拖拽的必经步骤；视角有按钮、角度有带标签数值输入/步进器及重置。原生按钮/输入、可见焦点、对话框焦点返回、状态 live region；按需更新画布，尊重 reduced-motion，默认不旋转设备。画布旁以 DOM 提供槽位/层列表和文字摘要；读屏用户能改字段并导出，不能只给一个没有操作替代的“3D 画布”。新关键触控目标建议 44px，不将其误写为所有 WCAG 场景的统一强制尺寸。

## 模板分发：D1A 静态目录，D1B Headless CMS

**D1A，推荐**：仓库维护声明式 JSON、原创/已审许可的资源和预生成缩略图；PR 审核后与应用发布。固定 manifest 校验字段、尺寸变体、资产哈希和最小 renderer 版本；资源使用不可变路径，目录切换原子发布。无运行时 CMS SDK、内容凭据或第三方请求，沿用当前 self-only 网络策略。优势是可复现、回滚直接、维护面小；代价是编辑人员需要 Git 流程，新增复杂布局仍要开发，不因换成 JSON 自动成为无代码设计器。

**D1B，条件选项**：Sanity 等 headless CMS 提供非开发编辑、草稿与内容工作流；适合多人频繁更新、多语言、排期需求已经出现时。官方 Sanity API 区分 published/raw/drafts，草稿及私有数据需要鉴权，CDN 也有 perspective 限制。这意味着需要另外设计预览权限和发布边界，不能把草稿 token 放进浏览器。**建议即使选 CMS，也在构建阶段把已发布内容转换为同一份经过验证的静态 manifest，再把资源镜像到同源；不让截图编辑器直接请求 CMS。** [Sanity Query API](https://www.sanity.io/docs/http-reference/query)

CMS 不等于锁死数据：Sanity 支持导出文档与资产，但官方说明某些资产下载失败仍可完成导出，因此迁移还需逐件校验，不能把“导出成功”当作完整备份。D1A→D1B 的成本主要是字段映射、编辑权限与发布流水线；D1B→D1A 还要搬运资源、核验授权与重写查询。只要浏览器消费的 catalog/scene 合同独立于 CMS，已保存作品不应跟着迁移。[Sanity 数据导出](https://www.sanity.io/docs/content-lake/exporting-data)

建议重评 D1B 的触发条件为非开发维护者持续需要独立发布，或实测 Git 内容流程成为主要瓶颈；不以模板数量一个数字自动触发。CMS 的管理员账号不是 PicWiz 用户账号，也不构成引入用户登录的理由。这里未选择供应商套餐或许诺免费额度。

## 3D 选型：引擎与资产是两个独立决定

**D2A，推荐 POC：直接 Three.js + 程序化通用几何。** 用圆角机身、屏幕平面、受限相机与简化光照完成一个无品牌设备；几何可参数化适配截图，首次不依赖模型下载/压缩解码器。Three.js 为 MIT，当前 npm `latest` 核验为 **0.186.1**，WebGLRenderer 使用 WebGL2，自 r163 不再支持 WebGL1。引擎本身不要求 React；由客户端适配器拥有生命周期，可把 React 与渲染核心解耦。代价是交互/资源管理要自己做，复杂写实设备和材质工艺不擅长。[Three.js 发布元数据](https://registry.npmjs.org/three/latest)、[MIT 许可](https://github.com/mrdoob/three.js/blob/dev/LICENSE)、[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

**D2B：React Three Fiber 稳定 v9 + 逐件授权 glTF/GLB。** 适合确定需要多设备、复合场景、交互组件且团队偏好声明式场景的情形。R3F 是 Three.js 的 React renderer，不会替我们解决 PNG 导出、模型 UV、授权、GPU 限制或跨设备像素一致性。官方明确 v9 配 React19、v8 配 React18；研究时 v10 仍为 alpha。仓库 package 显示 9.8.1、MIT、React/React DOM peer `>=19 <19.4`、three `>=0.156`；这与本项目 React19.2 的主版本吻合，**不是已验证与 Next16.4.2/Three0.186.1 兼容**，也不把仓库版本当作已核验的 npm 最新发布。未来实施须固定发布版本及匹配的类型包，实际构建、挂载/卸载及三引擎导出后才接受。[R3F 官方版本说明](https://r3f.docs.pmnd.rs/getting-started/introduction)、[package/peer/许可声明](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/package.json)、[R3F MIT 原文](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE)

glTF 2.0 是运行时资产格式；GLB 可打包资源，但不能仅凭后缀认定没有外部 URI、复杂扩展或超量贴图。需要自定屏幕 mesh 名称、UV 区域、方向、物理比例和材质替换合同。原生 Three.js 同样可加载 glTF，R3F 同样可做程序化几何，不能把“采用模型”误解为必须迁移到 R3F。**本次 D2B 明确定义为 R3F＋授权 glTF 的组合路线。** “保留直接 Three.js、只增加授权 glTF”是另一种后续变体，不包含在 D2B 中；若用户希望此变体，应另写范围和成本比较后确认。[glTF 2.0 规范](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)、[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)

**2.5D：轻量 2.5D**：固定角度的原创设备图片/遮罩，加 Canvas 投影、裁切与阴影。适合只要一个倾斜视角且设备覆盖比真实空间更重要的产品；可免 GPU 场景，维护成本转移到每个视角的图层和投影资产。它不能提供任意旋转、真实遮挡/反射或可靠的连续相机运动。必须让像素投影真正进入 Canvas；CSS `transform`、CSS3DRenderer 或网页 DOM 的好看预览不等于能输出所见 PNG。若主张真实 3D，不应将 2.5D 作为同名替代；作为明确标注的“平面设备构图”降级即可。

**WebGPU：保留后端替换口，不作为首版门槛。** 不能再笼统称它“浏览器都不支持”：Safari26 已正式提供 WebGPU；Three.js WebGPURenderer 默认尝试 WebGPU，并提供 WebGL2 回退。但本项目没有设备矩阵、图像一致性或速度证据；R3F v10 的 alpha 也增加升级变量。是否迁移应由同一场景的启动、内存、读回和导出实测决定，不能承诺 WebGPU 自动更快。[WebKit Safari26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)、[WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html)

Next 接入遵循仓库已安装 16.4.2 的本地指南 `node_modules/next/dist/docs/01-app/{01-getting-started/05-server-and-client-components,02-guides/lazy-loading}.md`：目录壳可为 Server Component，WebGL/Canvas 只在客户端生命周期启动，用户进入 3D 后才加载引擎；需要 `ssr:false` 时在 Client Component 内声明，不能从 Server Component 直接用它跳过 SSR。不得在模块顶层创建 renderer 或读取 window，也不得把用户图片传到 RSC/Server Action。[Next 官方 lazy-loading 指南](https://nextjs.org/docs/app/guides/lazy-loading)

## 版本化场景、存储与当前 renderer 的衔接

事实：`lib/canvas.ts` 当前是同步 `renderComposition(canvas, source, sourceSize, style, output?, annotations?)`；`compositionLayout` 返回图/框区域；`lib/batch.ts` 的 renderer 适配器也是同步合同；`lib/browser.ts` 提供全局 PNG 原生编码锁。不能把 async 3D 函数直接塞进 V2 batch 并声称接口兼容。

建议新增独立、纯数据的 **Scene v1**，其版本不等于现有 `picwiz:store` schema2：

- Catalog：`catalogVersion / id / revision / rendererMinVersion / status / task / localizedCopy / variants[sizeId] / slots / assetRefs / licenseRefs`。revision 与资源哈希固定；只允许已知布局与参数，不能存可执行 JSX、HTML、shader、任意 URL 或表达式。
- Scene：`sceneVersion / templateRef(id,revision) / rendererVersion / layoutSnapshot / look / output(sizeId,scale) / sourceRefs / content / crop / annotations / presentation(flat|device3d)`；3D 再含 `deviceSpecVersion / assetRef+hash / screenBinding / cameraPreset+boundedOverrides / lightingPreset`。标注仍是源图空间，标题是画布空间；所有几何数值有限且有范围。
- 目录是应用公开资产；作品保存的是已解析布局参数和引用，避免模板“最新版本”改变旧导出。全局目录可 `draft→published→deprecated→withdrawn`；撤下后禁止新用，说明已有作品受影响程度，保留可合法继续分发的旧 revision。授权撤销或安全事件不能许诺旧模型永远可下载；缺资源保留场景，提供显式换模板/转平面。
- 第一阶段只有一张当前图：模板内容可跟随作品持久化；GPU 对象、object URL、解码图、模型实例和 PNG 不入 localStorage。Scene 需要的规范化源与现有当前图共享逻辑所有权，不能双存 data URL。持久化需单独批准 store2→后继版本迁移，完整备份、严格校验、未来版本只读/阻止盲写，延续冲突/配额/清空的恢复合同；本研究不写迁移。
- 多源模板将来需要另决 IndexedDB 资产仓库、配额/清除/备份及来源寿命，不能把第二张图悄悄塞入当前 store。是否引入多项目也应独立决策；导出历史依旧不是可下载资产库。MVP 不开放 Scene 文件或第三方模板导入，V2 appearance-only 预设文件继续维持原合同。

未来统一出口建议为 `prepare(snapshot, assets, capabilities, signal) → session`，`session.renderFrame({width,height,time}) → 可合成帧`，`session.dispose()`。flat-v2 后端原样调用现有 renderer，模板2D 后端与 3D 后端实现同一时间/尺寸语义。预览和导出解析同一 snapshot；导出冻结 revision、内容、相机与资源哈希，重试不用“当前最新”状态。新异步导出编排等待 prepare/render 完成，再进入现有 PNG 编码/下载；V2 同步路径及 batch 在明确扩展前保持自己的合同。

## 真正可下载的 3D PNG 与运行边界

建议管线：本地源图解码与限额 → 在透明 2D 层绘制源图及其标注 → 作为设备屏幕纹理 → WebGL2 渲染设备 → 把结果合成到最终 2D 模板画布 → 画布标题/元信息 → `canvasToPng` → 现有下载或剪贴板。未来实现需把当前私有的标注绘制抽成可复用的源图层能力，保留 V2 包装接口与像素回归，避免复制两套标注逻辑。3D 屏幕使用无光照材质并测试 tone mapping，避免产品 UI 被灯光染色；机身使用单独受光材质。按输出投影尺寸决定纹理分辨率，不能把整个带背景的 V2 成品贴进屏幕造成双框/双背景。色彩先限定 sRGB，测试纹理输入/输出转换和透明边缘，不承诺广色域一致。[Three.js 色彩管理](https://threejs.org/manual/pages/color-management.html)

静态 POC 优先比较“重新 render 后在同一任务内立即复制 WebGL canvas 到最终 2D canvas”与“独立 render target + 有界异步读回”两条路径，再择一；不能在 render 与复制之间等待用户操作。默认 drawing buffer 可能已被浏览器清掉，官方建议捕获前重新绘制。若走读回，还需验证 Y 轴翻转、alpha、颜色与缓冲寿命；不能只截图网页或导出空白 WebGL canvas。导出用指定像素尺寸，pixelRatio 固定为1后设置实际宽高，不能再乘设备 DPR。[官方 Canvas 捕获说明](https://threejs.org/manual/pages/tips.html)、[WebGLRenderer 读回 API](https://threejs.org/docs/pages/WebGLRenderer.html#readRenderTargetPixelsAsync)

隐私与资源建议：

- 所有截图/用户文字/纹理/导出仍在浏览器；仅取同源公开静态资产，不请求外域字体、模型 CDN、远程截图服务或默认云 fallback。公开目录访问会留下普通托管访问日志，不能把“不上传图片”写成“没有网络”。公共缩略图本地构建生成；用户实图预览不缓存到服务器、不进遥测。
- 启动时实际创建 WebGL2 context 并检查纹理、renderbuffer/viewport 和目标尺寸，不靠 UA 判断。建议 POC 初始限制为一个 renderer、一个活动场景、一次导出；预览最长边≤1024、DPR≤1.5；单屏幕纹理边≤2048（先检查文字可读性），测试后决定是否允许4096；先不启用 HDR 环境、后处理、DRACO/KTX2 workers 或任意模型导入。若选择 D2B，另建议试验入口预算为单 GLB≤5 MiB、≤50k 三角形、≤8 材质、总纹理≤8MP，并核算解码后占用，不能只看压缩文件大小。这些是未测的实验预算，不是设备能力或最终上线承诺。
- 不支持/资源不足时明确说明，提供重试、降低本次导出尺寸/倍率、转平面。降低分辨率必须由用户选择且更新实际输出标签；V2 原有 1×/2× 能力不受新 3D 限额改写。上下文丢失立即暂停当前任务，不自动不断重建；尝试一次显式重建，失败则回退选择。
- 每个 await 后检查 AbortSignal/generation；取消立即停止新工作和下载，丢弃晚到结果，但 shader 编译、GPU 已提交命令、同步 Canvas 及原生 PNG 编码不是硬中断。继续使用 V2 encoder lock；15秒超时不代表原生锁可释放。更换源图、离开编辑、清空数据须失效旧 generation，不能让晚结果重新保存已删内容。
- 结束/切换时停止动画回调、解绑事件、释放独占 geometry/material/texture/render target/renderer、close ImageBitmap、撤销 URL、缩小临时 canvas；共享资产用引用计数，防止误释放。仍被 GPU 读回/原生编码使用的缓冲延迟到实际 settlement 再释放，期间保持 stopping/锁定；清空使其结果无效，不能承诺立即擦除浏览器内部/GPU 的所有副本。只移除 mesh 不会自动释放 GPU 对象，GLTFLoader 的 ImageBitmap 也需专门处理；即便用 R3F，缓存和外部资源所有权仍要明确。[Three.js 释放说明](https://threejs.org/manual/pages/how-to-dispose-of-objects.html)、[GLTFLoader 说明](https://threejs.org/docs/pages/GLTFLoader.html)

## 素材授权、运维与安全

优先原创的中性设备几何、虚构界面和自行生成预览，名称用“通用手机/桌面显示器”，不宣称真实硬件精确还原或品牌背书。每件模型、贴图、环境图、字体及缩略图分别记录来源、作者、许可原文/版本、取用日期、修改说明、是否允许商业输出与**随客户端分发源资产**、署名要求及权利证明。网页把 GLB 交给浏览器就是分发，不能靠“不提供下载按钮”绕过许可；可商用渲染不自动代表可把模型放进在线生成器或模板包。MIT 的 notice 随软件分发保留，不能据此给所有资产盖章。

官方 Khronos 示例库要求看每个模型目录的独立许可，并非全库统一授权；Poly Haven 允许其 CC0 资产再分发，但网站预览图、文字、Logo 与 API 使用有各自条款，建议自己生成缩略图，不直接搬运网站展示素材。CC0 也不授予专利、商标或第三方肖像/隐私权。具体资产是否可用仍待逐件核查，品牌外观/商标风险不由文件格式或开源许可自动解决。[Khronos 模型许可说明](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/README.md)、[Poly Haven 许可与网站条款](https://polyhaven.com/license)、[CC0 官方说明](https://creativecommons.org/publicdomain/zero/1.0/)

发布流水线应校验 catalog/scene schema、路径/哈希、资源可用性与许可证清单；glTF 做离线格式验证及屏幕 UV/比例审查，拒绝外部 URI、未知扩展、超量网格/贴图/动画。文本按纯文本绘制，不运行模板代码、不读取任意远程 URL；自托管必要解码器才能保持 CSP，不为了模型便利放开 `connect-src *`。无 UGC 减少了输入面，但第一方供应链仍需固定版本、审查依赖/许可、验证分发资产与构建产物。

诊断在用户主动导出时只给版本、渲染后端、错误码和所选输出，不记录文件名/截图/标题或持久 GPU 标识。`/api/health` 仍只证明服务路由健康；浏览器应有本地能力诊断。目录发布失败保留上一份完整版本；许可/安全下架须有撤回目录、替代场景和受影响 revision 清单，不把用户本地作品删除作为下架方式。

## 分期、验证门槛与可逆性

**阶段 G：先验证模板任务。** 6 个变体、单源、标题/元信息、两类任务、六尺寸明确适配、保留 Look 和源图标注、应用可撤销、本地恢复。建议邀请 5 位目标创作者，用自己的非敏感截图完成“选模板→填写→两尺寸 PNG”；目标为至少4人无指导完成、能说明与 Look 的区别，并记录完成时间/卡点。样本与阈值是建议，尚未招募或测量，不能当市场结论。若只是选背景，先修正模板价值，再扩目录。

**阶段 D：独立 3D POC。** 先一个原创通用手机、三个固定视角、单源静态 PNG；不改 V2 对外合同。建议验收目标如下，**全部尚未实测**：

- 在记录型号/OS/浏览器的桌面 Chromium、Firefox、真实 Safari，以及真实 iPhone Safari、Android Chrome 上验证；Playwright WebKit/手机 viewport 是补充，不能代替真机。软件渲染器通过也不代表移动 GPU 通过。
- 六尺寸×1× PNG 必须能解码、尺寸精确、非黑/空白，含正确朝向的合成截图、标注、机身和画布标题；2×作为明确的扩展能力单独测，不以1×结果宣传2×已支持。固定测试图检查灰阶/色块、alpha 边缘、细小文字、UV/透视裁切、截屏外观与实际输出；跨 GPU 用结构/容差断言，不要求逐像素相同。
- 作为提案门槛：缓存后 1024px 预览可用≤2秒，视角调整到反馈 p95≤100ms，1080²单张 PNG≤5秒；桌面/手机分开报告，记录冷启动、编码、读回与失败耗时。未达到时缩小场景/调整预算或不发布，不将这些数字写成现有性能。
- 连续30次进入/退出及替换源图后，应用拥有的 texture/geometry/render target 数量回到可解释基线，不持续单调增长；renderer 内部缓存不强求归零。另记录可获得的 CPU/GPU/进程指标及测量局限，不能单凭 JS heap 声称峰值内存安全。
- 覆盖无 WebGL2、context lost/恢复、超尺寸、字体/资源失败、编码超时、取消后晚回调、清空/换图竞态；无意外下载、无陈旧写回、无图片/文字外传。人工键盘/读屏/触控与 axe 共同验收。

**Gallery 产品化独立推进。** 用户选定 D1 并批准该阶段实现规格后，按模板任务验证结果交付 2D 布局、版本化场景持久化迁移、真实输出缩略图及完整导出恢复路径。**不依赖任何 GPU POC，也不要求选择 D2A 或 D2B；D1A＋D2C 是完整可交付组合。**

**3D 产品化单独过关。** 用户选择 3D 路线、对应 POC 达标并继续批准实现规格后，才接入异步 3D adapter、场景中的设备参数及单张导出错误路径；可复用已经交付的 Gallery 场景合同。3D 批量是后续单独 gate，须验证每组释放、失败保留、重试快照及累计 PNG/ZIP 预算，不能直接沿用 V2 吞吐结果。扩大授权模型库和 CMS 又是各自独立选择。

对视频的依赖顺序是：`版本化Scene/资产寿命 → 确定性renderFrame(time,尺寸) → 单帧像素导出/取消/清理 → 有界逐帧管线 → 视频编码/封装适配器`。3D 视频还依赖相机关键帧和跨帧纹理/资源复用；**2D 视频不需要等3D完成**。账号及 CMS 不在本地视频的必经路径；云渲染若将来成为选择，需重新决定上传同意、费用和保留期，不能自动作为浏览器失败补救。

D1A→CMS 的逆转成本低至中，前提是保存稳定模板 ID/revision 与同一导出 manifest；D2A→授权 glTF 通常是中等资产/UV/验收成本，不一定换引擎；D2A→R3F 需重写场景生命周期/组件并重测 React 集成，但独立 scene/renderer 合同可保护作品；2.5D→真3D 需重建几何、材质、相机与投影，固定视图资产复用有限。若让 JSX、Three 对象或供应商查询直接进入持久化文档，这些逆转会显著更贵。

## 留给用户的选择与尚缺证据

- **模板**：D1A 静态官方目录（推荐）／D1B 构建时 CMS；是否接受首版只做单源两类任务，推迟双图对比。
- **3D**：先 D2A 的小型真实 PNG POC（推荐）／D2B 的 R3F＋授权 glTF 组合路线／D2C 暂缓3D。若偏好直接 Three.js＋授权 glTF，或明确命名的 2.5D 固定平面构图，应另行确认变体范围，不复用 D2B 的选择编号。
- **未决输入**：真实用户对模板任务与3D的优先级、可接受画质/等待时间、最低设备矩阵、资产采购预算与具体许可证、目录维护人、2×/批量的重要性。实际 bundle、峰值内存、成功率、功耗、跨GPU颜色/字体一致性和任何商业提升均未知。

本提案不把以上建议视作实施授权；下一步等待用户选择范围与取舍。
