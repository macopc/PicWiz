# PicWiz V2 implementation-ready spec

Verdict：READY WITH RISKS，产品与技术两轮独立评审已通过，接受已列明的 native/内存/真机风险。2026-10-23。V1 baseline `09179ae`。Spec ID `PW-V2`。修改后在 `review.md` 记录评审响应与最终 verdict。

## 来源与去重

用户明确授权改名及 V2 四功能的研究、设计、规格、评审、实现、测试。无远程 issue tracker 或 git remote；本轮是本地规格，不创建 issue。已成功搜索 V1 README、`lib/domain.ts`、`lib/storage.ts`、`lib/canvas.ts`、`components/editor.tsx`、`tests/**`。预设增删改应用、三种尺寸、导入/PNG/clipboard 已有，需升级复用；batch 和 annotation 不存在，不重复搭建基础链路。研究证据：`market-research.md`。

## 路由与运行边界

- `/`：RSC 页面/HTML shell + client editor；浏览器承担 Canvas、Clipboard、拖放、本地数据和 ZIP。
- `/privacy`：服务器渲染的隐私与本地生命周期说明。
- `GET /api/health`：`app:picwiz,version:2`；随机 correlation ID，无用户数据。其他方法 405。
- 无 server mutation、账户、远程上传、对象存储、remote queue、第三方脚本或遥测。每个浏览器 profile 是唯一所有权边界；共享 profile 共享本地数据。V2 不请求新的服务凭据或权限。

## 模块与依赖合同

保留 Next App Router / TS 和已有 Canvas 适配器。拆出 `components/annotation-layer.tsx`、`components/preset-library.tsx`、`components/batch-export.tsx`、尺寸目录控件，避免继续向单个巨型 Editor 堆积所有逻辑。

- `lib/domain.ts`：六种 SIZES（保留 landscape/square/portrait ID，新增 story/linkedin/pinterest）；六项 STARTER_PRESETS；`applyLook(current,preset)` 仅复制 look 字段；`dimensions`；style 正规化。
- `lib/annotations.ts`：Annotation union、严格验证、添加/替换/移动、50 步 session undo/redo 的纯函数或小 hook 所需函数；不依赖 React。
- `lib/canvas.ts`：`compositionLayout(sourceSize,style,output?)` 导出精确图片/边框 rect；`renderComposition(canvas,source,sourceSize,style,output?,annotations?)`。注释、预览、PNG、clipboard、ZIP 共用这一个 renderer；可选 annotations 默认空以保持 V1 调用兼容。
- `lib/storage.ts`：V2 repository、旧键采用、严格写入、preset update/import/export、单图和 batch job 生命周期。
- `lib/batch.ts`：有界串行任务 runner；依赖注入解码/编码/render/clock 以测试；结构验证先于解码。
- `lib/zip.ts`：小型 stored ZIP writer，CRC32、UTF-8 名称、central directory、EOCD，复用 Blob parts，分块计算可取消。仅写入 PNG 与 manifest JSON，不接收 ZIP，不实现解压/ZIP64/加密。对照 [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)；独立 `fflate` 解码仅用于测试验证互操作性。没有新增生产库。

## 数据模型和迁移

单个新键 `picwiz:store`，schema version 2。旧键 `shinyshot:store` 只作兼容读取和回退备份，不在新 UI 暴露旧品牌。无新键时读取旧键；新键存在且损坏/未来版本时绝不回退掩盖问题。迁移成功后完整验证并原子写新键，旧键保持不动。确认清空需删除两键，错误不能宣称清空成功。

Migration 001 保持冻结 V1 默认定义；002 将有效 V1→V2。先使用冻结 V1 validator、背景与尺寸常量验证 V1（不把任意对象正规化成合法记录），保留当前源图、预设 ID/名称/时间戳/旧任务。新增 annotations=[]、job 计数字段。V1 的 padding/radius 按 `baseWidth/1600` 换算并四舍五入，保留旧构图；shadow 百分比不变。新空文档通过 001→002 初始化，不用 ad-hoc 建 schema。未知版本、畸形记录和写入配额失败保留原文档。迁移无网络。UTC ISO instants，不涉及本地日程。

### Composition

PK `current`；createdAt/updatedAt；status empty/ready；source（规范化的 bounded raster URL、name≤120、width/height）；style；annotations≤30。empty 时 source=null 且 annotations=[]。只有当前图持久化。替换成功/移除清空标注；坏输入不变。删除当前图不删除预设或历史。

### StylePreset

新建 UUID PK（兼容 V1 已接受的有界非 UUID ID），name NFKC、trim/合并空白、1–40 字符、大小写不敏感唯一；createdAt/updatedAt；style（兼容完整 Style 储存，但应用与文件仅使用 look）。最多 24。内置六项是不可修改目录，不复制进用户表；可另存副本。更新保留 ID/createdAt，需明确覆盖确认。删除不影响当前图。缩略图现场从中性示例渲染，不保存用户截图。

预设文件 schema：`{app:'picwiz',type:'style-presets',version:1,presets:[{name,style:Look}]}`，不含 source、annotations、size、scale、token。≤100 KiB；1–24 entries；strict allowlist，拒绝未知字段/背景/数值。重名后缀 ` (2)`、` (3)` 确定性换名，保持≤40字符。超总容量或任一无效项，整批拒绝；一次保存提交，不产生半批记录。

### ExportJob

保留 V1 的 UUID/idempotency PK、FK compositionId=current、kind、status、createdAt/completedAt、width/height、error。V2 kind=`download|clipboard|batch`；status=`pending|succeeded|failed|cancelled`；新增 `formats:SizeId[]`, `total:number`, `completed:number`, `failed:number`。单图 total=1，formats 仅当前 size；batch total=1..30，formats=1..3，不重复。width/height 为首个 format 的实际像素；其余尺寸由有序 formats 和提交时 scale 推导，因此新增 `scale:1|2`。提交字段终态不可变；进行中不依赖计数器保证规则。完成统计必须≤total；非取消终态 completed+failed=total；成功要求 failed=0；部分成功 job=failed/error=batch_partial，同时保留 ZIP。最多最近 20 个，批次任务不逐项占满历史。

reload 将 pending 标 failed/interrupted 后一次保存；不可恢复源文件的 batch 显示重新添加提示。终态审计元数据仅保留到 20 条 retention 或确认清空；不可重写既有终态，重复 ID 拒绝。显式重试新 UUID。

## 功能合同

### PW-PRESET

六个 starter：Studio (violet,96,12,36,none,light)，Paper (paper,80,16,20,browser,light)，Midnight (midnight,96,18,55,browser,dark)，Mint (mint,112,24,28,none,light)，Sunset (sunset,88,16,45,device,light)，Ocean (ocean,104,14,40,browser,light)。可由设计微调名称/参数，但最终目录需在实现前固定并测试。应用不改 size/scale/annotations；自存功能延续，并增加 Update from current、JSON import/export 和真实中性缩略图。

### PW-SIZES

| ID | 基准像素 | 场景标签 |
|---|---|---|
| landscape | 1600×900 | Landscape · X composition |
| square | 1080×1080 | Square · 1:1 |
| portrait | 1080×1350 | Portrait · 4:5 |
| story | 1080×1920 | Story · 9:16 |
| linkedin | 1200×627 | LinkedIn Page link image |
| pinterest | 1000×1500 | Pinterest standard image ad |

不宣传未核验 Instagram 规范或统一 safe zone；YouTube 高分辨率项暂不加入。所有支持 1×/2×；dimensions 是唯一事实源，任何导出均用准确像素。V2 padding/radius 是 1× 输出像素；预览单位 `previewWidth/baseWidth`，2× 倍增。全图 aspect-fit，不能隐式裁切或拉伸。

### PW-ANNOTATE

schema：`{id,type:'arrow'|'rectangle'|'text',x,y,width,height,color,stroke,text,fontSize}`，统一字段便于严格校验；shape 坐标是截图内部归一化值。x,y∈[0,1]，width,height∈[0.02,1] 且 x+width/y+height≤1；箭头从 (x,y+height) 指向 (x+width,y)，初版统一左下→右上，可通过属性 flipX/flipY 布尔值控制方向（两项也是严格 schema 字段）；rectangle 为框线；text 是纯文字≤140且输入最多3行；实际渲染也最多3行，超出文本框宽高则 clip，属性面板显示可能裁切提示。颜色 allowlist 为 #ef6351、#7756dc、#20a589、#2585e6、#23212b、#ffffff；stroke 2/4/8（参考图片宽1600的绘制单位）；fontSize 0.022/0.03/0.045（相对图片宽度，UI Small/Medium/Large）。每条都有 text/fontSize/flipX/flipY，非文字 text=''，便于排除隐藏载荷。

可添加、选中、拖动移动、编辑位置和宽高百分比、箭头翻向、编辑文字/色/粗细/大小、删除；方向键/Shift+方向键移动1%/5%，Delete 删除，按钮可替代快捷键。通过属性字段调整大小是必需的键盘/触控路径，直接拖角点为可选增强。无 drawing-only 的无障碍死路。Undo/redo 最多50步，仅当前 session 标注；拖动只在 pointerup 提交一步；预览 move 不写 localStorage。源图替换清历史；改变样式/尺寸不清。

renderer 先画 screenshot，再在 image rect 内 clip 画 annotation，最后保留 frame chrome；文字自动按注释框宽换行/裁切，选中框/控制柄不进 PNG。选择/编辑可聚焦；输入框内快捷键不拦截原生文本操作。文本不当 HTML，不宣称脱敏。

### PW-BATCH

输入：最多10张（包括可选当前图）；原始文件合计≤150 MiB，单张仍≤25 MiB/40MP/16384edge；输出1–3个不重复的 size，30张 PNG 上限；PNG总量≤64 MiB（生成后边界），ZIP+manifest≤65 MiB。结构/数量/字节预检在任何解码前；无效单图内容在该图处理时标失败，不破坏其他图。只持有一个解码后的图片和一个渲染 canvas，规范化后释放原图，组间释放 image/canvas。

当前图 snapshot 包含自己的 annotations；其他 File entries annotations=[]。当前图源图快照、style、scale、formats、输入稳定编号在开始时冻结；进行中配置禁改；不把当前注释复制到无关图。批量文件仅内存，刷新需重加，UI 必须预告。

runner 按输入顺序和 format 顺序串行，输出 state=`queued|running|succeeded|failed|cancelled`。每个 await 后检查 AbortSignal；点击取消立即禁止新任务和自动下载；取消收尾后可显式打包已完成结果，15秒只是应用层 soft timeout，不保证 native 操作结束；进入 stopping 并保留实际 native encoder 锁直到 callback settlement，不能虚假宣传硬中断。关闭进行中 dialog 等效取消。ZIP CRC 分块计算期间也检查取消并让出 event loop。

完成提供单个 ZIP 下载，不自动触发。名字固定 `01-source-name/{sizeId}-{width}x{height}.png`，源基名 sanitize 到 ASCII 字母数字短横线，≤60，编号防重和路径穿越；清单 `picwiz-manifest.json` 含版本、UTC、各条实际维度/状态/规范错误码，不含 data URL 或原始文件 bytes。失败保留成功 PNG 并明确“部分完成”；全失败不给空 ZIP。超过64MiB立即停止并标明资源限制，已有成功项可组成部分包，未执行项标 failed/resource_limit。

Retry failed 只处理失败项，保留已成功 blobs，不重复编码成功项；生成新 job ID，原 job 终态不改，retry 的 total=失败项数量；新 ZIP 可以包含合并后的成功结果，manifest 标明 attempts。采用原快照，配置改变清理结果并启动新批次。重试和下载都只有显式操作；session runner 禁止同时执行两次，重复提交 idempotency key 抛错。

## 测试矩阵与验收

- Unit：style/look 分离、6尺寸12输出维度、annotation bounds/文本/移动/undo、V1严格迁移/新旧键冲突/配额/未来schema、preset JSON事务/重名、batch预检/生命周期/idempotency/cancel/retry/budget、ZIP CRC/路径/互操作。
- Adapter：成功、拒绝、超时、取消；ZIP 用独立 fflate 解压与比对；batch 注入单项失败/编码超时；不得使用真实用户截图。
- E2E：完整预设流程（内置、自存、更新、导入导出）；三种 annotation 编辑/删除/undo/跨size像素定位/持久化；3图×2尺寸 ZIP 解码图数及逐张维度/背景/annotations；坏图部分成功+retry+cancel；旧键迁移；实际clipboard权限失败fallback；手机键盘路径；保持 V1 竞态和4K测试。
- Chromium、Firefox、WebKit 配置并实际跑适当完整关键流程；不能把“配置了项目”写作“通过”。缺少真实Safari/iOS/Android设备，报告模拟边界。
- `npm test` 为单命令typecheck+unit+browser，`npm run build`生产构建；CI运行相同检查。视觉QA桌面1440×900/手机390×844，native dialog无裁切，无页面横溢，导出按钮不遮挡末尾控件。
- 网络检查零图片/标注/预设上传；CSP继续self-only，ZIP无需worker或外域。server logs不加用户内容。

## 验证与交付

`docs/v2/review.md` 保存真实审查意见及逐条响应；`validation.md` 保存命令、环境、结果、基准和限制；README 更新为PicWiz V2，含迁移/回退/批量资源/预设文件/annotation隐私。清除本地数据验证两键与源内容均移除。V2完成后才启动下一阶段四功能的产品、架构、外部依赖、费用与选型分析；这些方案保持待决策，不实现。


## 评审后合同补充（权威细则，2026-10-23）

下述明确解决首轮产品和技术评审；与上文概述有冲突时以此为准。

### R1 — 原生操作、取消与结果保留

`canvasToPng` 在浏览器模块中维护所有单图/批量共用的 native encoder lock。15秒超时或 AbortSignal 只能让应用 promise 失败，不释放原生锁。真正 callback（成功/失败）到来才释放，晚结果通过 generation 丢弃。锁存在时禁止新 encoder 和重试，UI 显示“等待浏览器完成；若一直没有响应请重新加载”；绝不能宣称 native 已中断。单图 timeout 同样处理。解码超时清 onload/onerror、移除 src、撤销 object URL；规范化同步 Canvas 调用有输入分辨率边界，但不承诺硬时限。

batch UI/runtime 允许 `stopping`，立即回应取消并停止开始新工作；runner 返回后进入 cancelled。当前不能中断的 native 回调可以更晚才释放锁。取消后保留已经接受的 blobs，可显式 Download completed results；这个动作重新运行 ZIP 包装而不重绘 PNG，绝不自动下载。正常关闭批量面板会取消并释放 session 文件/结果，重新打开为空；关闭按钮的文案/说明应告知此行为。超时锁仍然保留到实际 callback 或页面 reload。

### R2 — 预算、失败分类、重试

10源/3尺寸/150MiB输入/64MiB累计接受PNG的上限仍生效。每个 PNG 只在 `retainedBytes+blob.size <= budget` 时接受；超额 blob 立即丢弃，当前及未开始 pairs 标 resource_limit。合并重试结果共享同一64MiB预算，不重新获得配额。ZIP之前释放前次ZIP引用并撤销旧URL；CRC逐个 Blob bounded slices读取（≤1MiB），不得读取整个archive成ArrayBuffer。允许的瞬时占用包括1个原始decode、1个规范化canvas和1个规范化decode，返回后立即移除原始src/释放canvas；组间只保留源File引用和已接受PNG Blob，不保留所有decoded images。

session plan 是稳定的 `(sourceIndex,sizeId)` pairs，附 job/attempt ID、状态、规范error code、optional PNG Blob。重试只提交当前 failed 且可重试的 pairs；复用成功 blobs，计数只统计此次提交，合并archive数量另报。retry job 的 formats/首尺寸取实际subset，total=本次pairs数。image_read/image_timeout/png_encode/png_timeout/zip_failed 等暂态错误在原生锁释放后可重试；bad type/invalid image/dimensions、resource_limit 是需改变输入或设置的错误，不提供同配置重试。cancelled pairs 不自动当failed重试，改为“Start again”。对resource_limit显示 Download completed results 和 Start a smaller batch（减少图、尺寸或倍率）；对坏图显示移除/替换或重新开始。

ZIP构建失败不等于PNG失败：job可 failed/error=zip_failed，completed=total、failed=0；UI提供“Prepare ZIP again”，用已有blobs开启新的包装attempt，不重新解码/绘图。取消后打包已完成结果也形成新的batch包装attempt，total是此次包装的有效entries数。没有成功PNG时不创建空包。

### R3 — 数据恢复、清除与兼容

旧键是回退备份，保留到用户确认 Clear all local data；Remove screenshot 仅移除当前V2 workspace图，不宣称清除旧备份或原文件。隐私页明确说明旧键保留。升级首次成功时非阻塞提示“PicWiz已保留本地图与预设；预设现在只应用外观，框/阴影可能微调”。市场研究中的“外观保持”指源图/设置/输出尺寸兼容，几何允许换算误差，不宣称逐像素相同。

所有 save/adoption/direct-save 必须验证权威raw文档；新键优先，存在时禁止旧键掩盖错误；新键缺失时旧键也必须验证。snapshot包含两键的相关raw值，防止旧键在首次采用期间被旧tab改写。任一key事件及 key=null 的storage事件都阻止盲写。导入与清除要失效 pending save/import/export generations，防止清除后旧任务复活数据。Clear顺序legacy→new，verify两键不存在，随后可写不含源图的全新V2空store；部分失败明确报错、保持写入blocked，不被late callback重建旧数据。

迁移失败/配额/不可用/未来schema都显示恢复bar：原因、Backup local data、Session-only editing、Retry saving或Reload、确认清空。backup仅下载本地JSON包装（两键原始字符串、不解析丢弃损坏内容），无上传；文件含截图要提示私下保存。读不出时说明不能备份。阻止保存不阻止选择新图、标注、PNG/clipboard；任何保存失败均不得显示Saved。

V1 frozen validator保留以前的有界ID格式。旧job由准确旧尺寸推断size/scale，total=1，succeeded→completed1/failed0，failed→completed0/failed1，pending→0/0。终态比较采用迁移后的表示。新job计数非负整数；提交字段含深比较formats及scale/total/dimensions不可变，pending计数单调；reload pending变failed/interrupted，failed=total-completed。除新增job导致裁剪最旧至20条及确认reset，不允许任意删除历史记录。

### R4 — 精确绘制与标注细节

布局 `u=output.width/SIZES[size].width`；padding/radius、browser44px top/device10px边+30px top+16px bottom均乘u，shadow opacity=shadow/100×0.55、blur=shadow×0.7×u、offsetY=shadow×0.28×u。使用同一compositionLayout导出imageRect；预览/导出比一致。标注stroke=stroke×imageRect.width/1600；fontSize=relativeSize×imageRect.width；字体固定Arial/Helvetica/sans-serif，line-height=1.25；按单词/长词分段换行，最多3行，同时裁切文本框和imageRect，UI提醒文本框溢出。

所有标注字段必须有限数值、ID唯一且有界，未知键拒绝；非文字text=''、fontSize固定默认0.03，所有flip字段规范布尔值。移动clamp到图内；pointercancel回退临时位置、不写入history。坐标通过canvas CSS rect→backing尺寸→imageRect映射，zoom/DPR下测试。选中层可键盘选择，包括重叠对象；删除后焦点回到临近layer或Add按钮，undo后焦点回到恢复对象；输入字段保留原生快捷键。

### R5 — 测试加强与预设导入幂等

除了fflate解压互操作，还用已知CRC32向量（空串和123456789）、独立header/offset/CRC断言与坏CRC检出，不能把fflate默认解压成功当作CRC校验。验证预算恰好上限和+1字节、late PNG callback、每个await取消、重复retry累计预算、迁移配额与采用竞争、终态改写、标注越界/clip、最大数量批次。fflate仅dev dependency并由lockfile固定。

预设导入在完全验证后一次提交。同名同外观跳过；同名不同外观依次尝试后缀（含截断以≤40字符），如果相同候选名/外观已存在则跳过，因此重复导入同一文件幂等。导入反馈 added/skipped 数；总容量在去重后检查，不部分落盘。

后续交付明确包含 template gallery、3d mockups、video exports、accounts 的产品设计、依赖、隐私、费用/单位经济、替代选型、迁移和取舍，用户决策之前保持未实现。
