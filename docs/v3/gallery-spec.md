# D1B Gallery：Sanity 构建时目录与单源模板实现规格

2026-10-23 · **READY WITH RISKS，已完成独立工程R2和产品复审；不是实现或上线验收记录。** 本文只规定 Gallery。用户已选择 D1B，故采用 Sanity 作为具体 CMS 默认项，替代旧提案的 D1A 推荐。本轮不安装包、不创建 CMS 项目、不修改应用、不迁移浏览器数据、不部署。

## 1. 权威、基线与交付边界

[spec.md](spec.md) 是跨功能和存储规则的共同权威；本文定义 `TemplateSceneV1` 的精确字段、模板产品行为与内容发布协议。父任务负责最终整合 store v3／迁移 003；本文不另创迁移链、工作键或账户模型。

已读 `AGENTS.md`、README、`docs/future/{product-design,gallery-and-3d,decisions,review}.md`、V2 的 `lib/domain.ts/storage.ts/annotations.ts/canvas.ts/browser.ts/batch.ts/image-format.ts`、迁移 002／注册器、编辑器与现有路由、`next.config.ts`、`.interface-design/system.md`。应用基线是 `0704446`，提案提交是 `9c4e899`。本地已有六尺寸、六个 starter Look、PNG／复制、单源标注和 V2 平面 Batch；未发现 Gallery 运行实现。这里的六模板不是现有六个 Look 的重命名。本地范围已去重；不声称完成远程 issue 去重或任何新功能测试。

**交付 G：** 六个自有策展单源 2D 模板，更新卡／细节卡各三种，覆盖 V2 六尺寸及 1×／2×；公共图库和详情、编辑器内发现／暂存／应用、纯文本字段、同源细节裁切、一次整体恢复、真实 Canvas PNG／复制、本地重载恢复、Sanity 内容编辑和受控构建发布。

**独立性：** Gallery 不加载 Three.js、WebCodecs、Clerk SDK，不要求登录、GPU、视频 POC 或账户数据库。用户选择的 D2A／D3A 是独立 POC，D4C 只同步 Look。Gallery 的标题、裁切、模板引用、截图和标注均不得进入账户 DTO。这里不定义 3D 模板、模板 Batch、市场／UGC、多源、多项目、任意画布层、模板文件导入、实时 CMS 预览、排期服务或上传截图。

## 2. 产品假设、可见界面与路由

首期假设为一个内容负责人、少量受信编辑、六模板和低频内容更新；维护者可接受内容发布后手动发起应用构建。CMS 解决非开发者编辑文案、示例与目录状态，不提供任意布局代码编辑器。这些是本规格的产品假设，尚无用户任务研究或实际成本证明。

沿用 paper／violet、DM Sans、4px 间距、画布优先的 V2 设计。卡片用同一虚构界面和相同比例，显示“1 张截图 · 可编辑标题”；不自动播放、不展示使用量统计。桌面目录三列，390px 视口两列，详情单列；筛选和卡片不靠 hover 才可操作。新主要触控目标至少 44px，面板在 390×844 下可滚动且不被底部导出栏遮住。状态同时有文字和图标。

| 精确拟议路由／入口 | 行为与边界 |
| --- | --- |
| `/templates?task=update\|detail&format=<SizeId>` | Server Component 输出全部公开卡片文字；小型 Client Component 根据白名单 query 筛选。未知筛选值忽略并显示全部，提供清除筛选；无 JS 仍可读六模板与普通详情链接。不得在 URL 放用户标题、文件名、裁切或图片。 |
| `/templates/[slug]` | 从随应用构建的 manifest 解析固定 slug 与当前展示 revision。服务器输出虚构示例、尺寸、可编辑字段、许可摘要与本地截图说明；客户端切换六种示例格式。已知撤架项显示说明和替代项，未知 slug 为 404。slug 首次发布后固定且永不重用。 |
| `/?template=<id>&revision=<positive-int>` | 只解析公开标识，精确解析指定 revision，进入审阅；绝不把旧 revision 偷换成最新。仅有 id 时列出当前 revision 并等待审阅；不自动提交。非法／未知／未来版本提示并保留当前作品。 |
| `/` 内“模板”入口 | 在当前编辑器打开目录对话框，手机为可滚动全屏面板；不导航离开 `/`，避免丢失 session-only 作品。复用公共目录数据。 |
| `/` 的模板审阅面板 | 显示本地预览、将改变的布局／文字、保留的截图／标注／尺寸；提供标题、元信息、细节区域、尺寸选项和 Look 选项。主操作“应用模板”，次操作“取消”。无图仍可编辑并应用占位场景，下载／复制禁用且说明需加入截图。 |
| `/` 的“内容”面板 | 编辑标题／元信息；细节模板显示完整源图、裁切框及百分比数值输入。标注仍在源图编辑面板操作，不能在缩放后的细节副本上另建标注。 |
| `/` 的“恢复应用前画布”／“返回平面” | 两个不同动作：前者恢复一次完整检查点；后者确认丢弃当前模板布局／文字，令 scene=null，保留当前 source/style/annotations。不能以返回平面冒充恢复。 |

公共详情链接和 editor 内选择都必须经过同一个 apply controller。同一 query 在 React 重渲染、Strict Mode effect 重跑、历史导航后不得重复应用；进入审阅时生成一次 session request ID，消费后用 `history.replaceState` 仅移除 template/revision，保留其他安全 query。用户再次明确点击模板才创建新请求。

对话框有初始焦点、Tab 约束、Escape 取消及关闭后焦点返回；读屏提供模板结构／字段／真实输出尺寸的 DOM 摘要和礼貌 live region。加载占位保留图像宽高，单张缩略图失败保留文字和重试；无匹配、缺标题、缺图、文字溢出、字体失败、版本不可用各有独立文案。尊重 reduced-motion，首期无需装饰性动画。

## 3. 六个模板、六尺寸与确定性布局

模板 ID、slug 和 `layoutId` 首期相同且固定。所有模板只有一个主源槽 `main`；细节槽 `detail` 只引用同一 composition.source 的裁切。标题 `title` 与可选元信息 `meta` 是画布文字，不是 Annotation。

| ID／slug／layoutId | 中文名／任务 | 构图与默认展示格式 |
| --- | --- | --- |
| `update-heading` | 标题在上／update | 标题、元信息、主截图依序；建议 landscape。 |
| `update-split` | 侧栏更新／update | 宽图文字与截图并排，窄图转上下；建议 landscape。 |
| `update-caption` | 图先说明／update | 主截图在上，标题和元信息在下；建议 square。 |
| `detail-pair` | 全局与局部／detail | 完整图和细节同等对照；建议 landscape。 |
| `detail-focus` | 细节主角／detail | 完整上下文较小、细节较大；建议 portrait。 |
| `detail-inset` | 局部浮窗／detail | 完整图＋右下角细节浮窗，浮窗为唯一允许的图槽重叠；建议 square。 |

每个 revision 必须适配以下六个 SizeId，缺一个即拒绝发布；这里的 format 指画布尺寸，输出文件格式仍是 PNG。

| SizeId | 1× 像素 | 2× 像素 | 布局族 | 标题起始字号／元信息字号（1× px） |
| --- | --- | --- | --- | --- |
| landscape | 1600×900 | 3200×1800 | W | 48／20 |
| square | 1080×1080 | 2160×2160 | S | 42／18 |
| portrait | 1080×1350 | 2160×2700 | T | 44／18 |
| story | 1080×1920 | 2160×3840 | T | 48／20 |
| linkedin | 1200×627 | 2400×1254 | W | 38／18 |
| pinterest | 1000×1500 | 2000×3000 | T | 42／18 |

以下为完整 recipe registry v1，不由 CMS 提供表达式。矩形为 `[x,y,w,h]`，坐标是内容区的千分比整数；字段顺序为 `title ; meta ; main ; detail`，`—` 表示不存在。六尺寸先依上表选 W/S/T，再使用这一行；因此覆盖的是 36 个具体适配，不能把 landscape 成品等比拉伸当作其他尺寸。

| layoutId | 族 | title ; meta ; main ; detail |
| --- | --- | --- |
| update-heading | W | `[0,0,1000,160] ; [0,180,1000,60] ; [0,280,1000,720] ; —` |
| update-heading | S | `[0,0,1000,150] ; [0,170,1000,60] ; [0,270,1000,730] ; —` |
| update-heading | T | `[0,0,1000,130] ; [0,150,1000,50] ; [0,240,1000,760] ; —` |
| update-split | W | `[0,80,330,360] ; [0,470,330,120] ; [380,0,620,1000] ; —` |
| update-split | S | `[0,0,1000,170] ; [0,190,1000,60] ; [0,290,1000,710] ; —` |
| update-split | T | `[0,0,1000,140] ; [0,160,1000,50] ; [0,250,1000,750] ; —` |
| update-caption | W | `[0,770,1000,160] ; [0,950,1000,50] ; [0,0,1000,730] ; —` |
| update-caption | S | `[0,780,1000,150] ; [0,950,1000,50] ; [0,0,1000,740] ; —` |
| update-caption | T | `[0,820,1000,120] ; [0,960,1000,40] ; [0,0,1000,780] ; —` |
| detail-pair | W | `[0,780,1000,150] ; [0,950,1000,50] ; [0,0,470,730] ; [520,0,480,730]` |
| detail-pair | S | `[0,0,1000,140] ; [0,160,1000,50] ; [0,250,1000,300] ; [0,600,1000,400]` |
| detail-pair | T | `[0,0,1000,110] ; [0,130,1000,40] ; [0,210,1000,310] ; [0,570,1000,430]` |
| detail-focus | W | `[0,0,1000,160] ; [0,180,1000,60] ; [0,300,300,700] ; [350,280,650,720]` |
| detail-focus | S | `[0,0,1000,140] ; [0,160,1000,50] ; [0,250,350,280] ; [400,250,600,750]` |
| detail-focus | T | `[0,0,1000,110] ; [0,130,1000,40] ; [0,210,1000,230] ; [0,490,1000,510]` |
| detail-inset | W | `[0,0,1000,160] ; [0,180,1000,60] ; [0,280,1000,720] ; [620,620,360,350]` |
| detail-inset | S | `[0,0,1000,140] ; [0,160,1000,50] ; [0,250,1000,750] ; [600,620,380,350]` |
| detail-inset | T | `[0,0,1000,110] ; [0,130,1000,40] ; [0,210,1000,790] ; [500,650,480,320]` |

### 3.1 布局算法和 Look 的含义

1. 输出 `W,H` 严格来自 `dimensions(composition.style)`；倍率 `s=style.scale`。内容区 `C=[padding*s,padding*s,W-2*padding*s,H-2*padding*s]`。矩形按 C 的宽高解析，保持浮点到绘制，不逐项取整造成间隙；PNG backing store 是精确整数 W/H，DPR 不参与导出。
2. 模板 Look 默认保留当前值；可显式选择模板建议 Look，此动作使用现有 `applyLook`，不改变 size/scale。padding 在模板中是整体内容区留白，radius/shadow/frame/appearance 用于主截图；细节槽固定为无设备框的纸面，使用相同圆角和明暗。UI 在审阅说明这一含义。所有输入仍遵守 V2 的 Look 范围及背景 allowlist，不允许 CSS 色值／URL 字符串。
3. 主图的 frame 指标沿用 V2 在输出像素上的边框／顶栏／底栏公式；先在槽内为阴影预留 `ceil(shadow*s)` 四边，再在剩余区域内 aspect-contain 原图＋frame。细节也 aspect-contain 裁切，绝不额外 cover 裁去用户选择区域。每个图槽独立 clip；阴影不能进入标题槽。负可用尺寸或 frame 扣除后不足 1px 时返回 `template_layout_overflow`，提示减留白／阴影或主动换尺寸，不能偷偷重置 Look。
4. 绘制顺序：背景→main 框／完整源图及标注→源图上的细节区域指示线→detail 面板／同图细节及标注→title→meta。指示线是模板派生装饰，不加入 Annotation[]；使用已知强调色 2*s px。detail 面板使用当前 appearance 的 paper/ink 色并加 1*s px 边线。`detail-inset` 的有意遮挡须在审阅可见，其他槽不得相互覆盖。
5. 标题按上表字号开始，逐 1px（再乘 s）缩至 22px；meta 从表值缩至 12px。行高 1.2，标题最多两行、meta 一行，左对齐／top baseline；英文优先词边界，长词与 CJK 按 grapheme 边界换行。用实际 Canvas `measureText` 测量宽高。找不到完整容纳全部文字的字号时阻止应用／导出并指出字段，既不省略号、不裁掉文字、不无限缩小。留空 meta 时其余槽不移动，保证可预测布局。

### 3.2 文本、字体与裁切

- `title`：NFC、首尾 trim 后 1–60 个 grapheme，可有至多一个 LF（计数不含 LF）；`meta`：NFC、trim 后 0–32 个 grapheme，单行。限制在 input、staging、持久化校验和导出前共同执行；拒绝 CR、C0/C1 控制字符及双向覆盖／隔离控制符，普通合法文字保留。不得用 JS UTF-16 length 冒充用户可见字符数。IME composition 期间不强截，完成后报告超限；不静默截断。
- 标题／meta 都只走 DOM 文本节点和 Canvas fillText。`<script>`、HTML、Markdown、`javascript:` 即使出现在普通文字中也只画字，不解释、链接或执行。页面字段名／卡片描述另有同等纯文本验证。
- 输出字体集 `gallery-text-v1` 复用已自托管的 DM Sans；新增受审的自托管 Noto Sans SC 作为 CJK fallback。具体文件取自固定上游 commit，记录 SHA-256、覆盖 cmap 与 OFL，不能在运行时调用 Google Fonts。两个字体完成 load 后才测量；不足 glyph（含未覆盖 emoji）显示 `template_glyph_unsupported`，不以系统 fallback／豆腐字当导出成功。字体失败可重试或返回 V2 平面，不改变原有标注字体合同。
- `detailCrop={x,y,width,height}` 属于**规范化源图坐标**，不是画布坐标；六位小数，全部有限，x/y≥0、width/height≥0.05、x+width≤1、y+height≤1。默认固定 `{x:0.25,y:0.25,width:0.5,height:0.5}`。尺寸／Look 改变不改变 crop；detail 模板之间保留合法 crop，update 模板为 null。
- 成功换图后保留模板 title/meta 和布局，重置 detailCrop 为上述默认值、清空源图 Annotation[] 及其历史，并失效旧拖动／检查点；导入失败不改任何一项。移除当前图时保留模板占位文字，crop 复位，不能导出。无第二张图片、第二份 data URL 或持久化裁切位图。
- 同源标注必须保留原数组及顺序。对 crop `c` 和源图点 `(u,v)`，细节投影为 `((u-c.x)/c.width,(v-c.y)/c.height)` 再映射到 detail 的实际 imageRect；矩形、箭头、文字使用同一源图变换，画后 clip 到 crop，不能把每项先 clamp 而改变箭头形状。线宽／字号按源像素到槽的实际缩放计算。主图仍显示完整标注，crop 外标注不会被删除。

## 4. 唯一持久化场景：TemplateSceneV1

`composition.source`、`composition.style`（含 size/scale）、`composition.annotations` 保持唯一可编辑真值。composition 仅新增 `scene: TemplateSceneV1 | null`；**scene 不得含 Look、Style、source/dataUrl、output/size/scale 或 annotations 的副本**。下面是拟议 `lib/scene.ts` 应精确实现的纯数据合同，字段全部必需，null 有明确含义；所有对象拒绝未知键。

```text
TemplateSceneV1 {
  sceneVersion: 1,
  rendererContract: "gallery-2d@1",
  templateRef: {
    id: TemplateId,
    revision: positiveSafeInteger,
    catalogRevision: Sha256Hex,
    recipeHash: Sha256Hex
  },
  layoutSnapshot: LayoutSnapshotV1,
  content: { title: string, meta: string },
  detailCrop: NormalizedCrop | null
}
LayoutSnapshotV1 {
  layoutVersion: 1,
  layoutId: oneOfSixLayoutIds,
  fontSet: { id: "gallery-text-v1", assetHashes: [Sha256Hex, Sha256Hex] },
  variants: {
    landscape: VariantV1, square: VariantV1, portrait: VariantV1,
    story: VariantV1, linkedin: VariantV1, pinterest: VariantV1
  }
}
VariantV1 {
  title: Rect1000, meta: Rect1000, main: Rect1000,
  detail: Rect1000 | null,
  titleFontPx: integer, metaFontPx: integer
}
```

`Rect1000` 精确含 x/y/width/height 四个整数，0≤x,y<1000、width,height≥1、边界≤1000；只能是第 3 节登记值。`fontSet.assetHashes` 顺序固定为 DM Sans、Noto Sans SC，必须不同。TemplateId 为 `^[a-z][a-z0-9-]{0,47}$`，首期仅六个登记 ID；revision 从 1 单调增加且不回收。SHA256 为 64 位小写 hex。`recipeHash=SHA256(canonicalJSON(layoutSnapshot))`，canonicalJSON 递归按键 ASCII 排序、数组保序、UTF-8／无多余空白，拒绝 NaN/Infinity/-0；生成器和浏览器共享同一实现及固定测试向量。

场景验证还须保证 id、layoutId、任务和 detail 是否存在一致；六 variants 完整；标题／crop 合法；recipeHash 匹配；rendererContract 精确支持。未知 Scene／layout 版本或未来字段不能被 normalize 成当前默认值；保留原数据并进入恢复界面。source=null 允许 scene 存在；这不满足 PNG 导出的 source 前提。

`layoutSnapshot` 保存解析后的受限 recipe，包括确切字体哈希，使 CMS 修改不会改变旧作品；不是保存 CMS `_rev`、React 组件或当前 DOM。已支持 renderer 的旧 recipe registry 在 `gallery-2d@1` 支持期内保留。`templateRef.catalogRevision` 只作出处，恢复不要求把旧作品套入当前 catalog 的最新版。

每次预览／导出临时组装 `RenderSnapshot={composition.source引用及已解码句柄,style副本,annotations副本,scene深拷贝,workspaceEpoch,sourceRevision,annotationRevision}`，冻结后不随编辑变化；它只存内存，不入 store、不发 RSC／Action／CMS。实际输出由 snapshot.style 决定，scene 内没有相互竞争的输出尺寸。

store v3／003、冻结 V2 校验器、同一个 `picwiz:store`、raw `picwiz:pre-v3`、三键 snapshot／clear、备份封装与回退完全遵守 [共同迁移合同](spec.md#5-本地数据迁移与回退共同权威)。003 仅为旧 composition 增加 scene=null，不能顺便改 Look、图片、预设或 jobs。Gallery 不新增持久化 key；恢复检查点、暂存、解码句柄、字体状态、PNG 均为会话数据。

## 5. 暂存、应用、整体恢复与现有能力兼容

状态机为 `idle → loading → preview → staged → applied`；loading/preview/staged 均可 cancelled/failed。只有用户点击“应用模板”才能从 staged 提交；不得因关闭面板、下载缩略图或输入字段而保存暂存。应用前的缺图不是错误，字体／布局／政策无效则不能应用。

1. **读取：** 捕获 workspaceEpoch/sourceRevision/annotationRevision、当前完整 composition 和注释 history 引用。加载精确 revision、验证 manifest／recipe／字体哈希与当前 availability（第 8 节），复制小型 scene 数据到 staging。用户源图仅通过当前客户端句柄引用，公共示例不替换已有 source。
2. **合并：** 首次用模板时使用该 revision 的默认 title/meta；已有模板时按同名槽保留用户 title/meta，允许显式“使用模板示例文字”。detail→detail 保留同源合法 crop，其他转换按第 3 节重置。所有六模板都恰好有 title/meta，不丢字段。Look 默认保留；尺寸默认保留原 size/scale，另一个未勾选选项明确显示建议尺寸及实际像素。选择建议尺寸只改 size，scale 保持原值；更改倍率须独立控件。
3. **暂存：** 无图显示空槽＋“加入截图”，另有明确“使用公开示例”按钮；两者走现有本地图像解码／限额合同，但结果先作为 staging 的 source 候选，**确认应用前不写当前 composition**，取消释放候选句柄。有原图时只复用它，不提供以公开示例覆盖原图的快捷动作。标题非法／超限可以停留在输入草稿，不能写入合法 scene 或自动截断。试调 crop／Look／尺寸只影响 staging 预览。
4. **提交：** 用户确认后重新检查所有捕获代次、三键 storage snapshot 和 availability；若期间其他编辑／StorageEvent 发生，提示重新预览，不静默覆盖。验证完整候选 envelope，失效旧 annotation pointer gesture，然后一次更新 composition（有原图时保留原 source/annotations；原图为空且用户明确加入 staging 图时在同一次提交接纳它及空 annotations，只合并明确选过的 style 和新 scene）。预设／jobs 不回退、不替换。保存沿用本地 repository；保存失败显示 session-only，内存中的完整应用结果和恢复检查点仍可用，不显示“已保存”。
5. **检查点：** 每次成功应用前，在内存保留一个完整 composition 深快照以及标注 past/present/future、选择状态和源图句柄所有权；图像 bytes 不另写 localStorage。记录应用完成后的 applicableSourceRevision 和独立 checkpoint lifetime token，因此“从空画布应用带示例模板”也能整体恢复为空画布。下一次成功应用替换该检查点；失败／取消不替换。应用流程之外的 source 成功替换／移除、清空本地数据、外部存储变化、重新加载或离开编辑器使 token 失效并释放引用，UI 说明不再可恢复；移除截图不能通过旧检查点复活图片。
6. **恢复：** “恢复应用前画布”先显示恢复范围：模板、文字、crop、外观、size/scale 和标注将整体返回检查点，之后对画布的编辑将丢弃。打开恢复确认时捕获**此刻**的 workspaceEpoch／三键snapshot，确认后要求它们未变、sourceRevision仍等于检查点的applicableSourceRevision、lifetime token及源句柄仍有效；确认期间有新编辑则重新确认。应用后对Look／标题／标注的普通编辑不会仅因epoch已不同于应用时就废掉检查点。取消旧拖动／在途预览后，一次提交检查点的完整 composition 并恢复 annotation history／选中项；保留当前 presets/jobs 及 composition 的既有创建时间，updatedAt 取本次恢复时间。不得逐字段执行多次 setter，不能恢复一半布局和另一半标注。恢复不调用 CMS、不自动下载、不撤销已经完成的导出。恢复完成消费检查点；保存失败仍整体 session-only，不声称磁盘已回退。

预览、应用、恢复、成功换图、删除层、Undo/Redo、尺寸变化及清空都递增适用的 committed revision；每个 await／pointerup 重查代次，迟到结果不得写回。导出冻结自己的 snapshot，之后应用／恢复不改旧导出内容；清空／移除截图按共同规则使旧导出结果失效。共享重负载协调器／PNG 原生锁仍适用，忙时给等待状态，不用释放未 settled 编码器来“恢复响应”。

**兼容表：**

| 既有操作 | 有模板时的精确结果 |
| --- | --- |
| 应用 starter／个人／云 Look | 仅改既有 style 的外观字段，scene/content/crop/source/annotations/size/scale 保留；布局重新测量，若无法容纳文字则报告并阻止该场景导出。 |
| 保存／更新／导入／导出预设 | 继续 `style-presets` version 1、appearance-only；不得加入 scene、标题、crop、图片或标注。24 项上限／去重／原子导入保留。 |
| Reset style | 继续 V2 重置外观＋landscape／1×，保留 source/annotations；scene 的布局／文字／crop 保留并重排。UI 说明模板内容不会重置。 |
| 标注 Undo/Redo | 仍仅操作源图 Annotation history（最多 50），不混入模板标题、crop 或模板应用历史；模板应用的恢复是独立动作。 |
| 改 size/scale | 六格式全部可选，复用相应 recipe，不改 crop/source/annotations；实际 PNG 必须符合所选像素。 |
| Batch export | 有 scene 时，打开面板先提示“批量目前仅应用外观和截图标注，不包含模板文字／排版”，显式确认后才进入 V2 flat Batch。面板的缩略图必须用 V2 renderer；不删编辑器 scene，不把模板截图冒充 ZIP 预览。取消确认无副作用。额外文件仍不继承当前图标注。 |
| PNG／复制／历史 | 单张路径支持模板。既有 ExportJob 结构、上限、pending→interrupted 恢复不变；模板引用留在 RenderSnapshot，而非改 V2 job 为作品仓库。PNG／ZIP blob 不持久化。 |

## 6. Sanity 选型、配置与 CMS 编辑权

### 6.1 核验事实与选型限制

以下官方资料均于 **2026-10-23** 访问，描述能力依据，不代表本项目已安装或兼容验证：

- Sanity Query API 支持 published/drafts/raw，`v2025-02-19` 起默认 perspective 是 published；私有数据、草稿和版本需要认证。本规格仍显式指定 published，不依赖默认值。构建直连 API 而非 CDN，避免发布时读取缓存内容。[Query API](https://www.sanity.io/docs/http-reference/query)、[Perspectives](https://www.sanity.io/docs/content-lake/perspectives)
- 官方客户端把 projectId、dataset、apiVersion、useCdn、perspective 分开配置；drafts 需 token 且关闭 CDN。**这里不采用浏览器 CMS client，也不采用 next-sanity／Live Content API／Presentation Tool／Draft Mode。** 首期构建适配器用 Node 24 内置 fetch，配置对应 `apiVersion=2025-02-19,useCdn=false,perspective=published`，无需把 SDK 加入应用依赖。[客户端查询配置](https://www.sanity.io/docs/apis-and-sdks/js-client-querying)
- Studio 的表单 validation 不由 Content Lake 自动强制，API／导入可以写入不符合表单 schema 的文档；必须再次在构建边界严格验证。[Schema validation and the Content Lake](https://www.sanity.io/docs/content-lake/schema-validation-and-the-content-lake)
- 数据集资产即使来自私有 dataset，也可以通过已知 CDN URL 公开读取。CMS 只能保存允许公开的虚构截图和第一方素材，不能接用户截图、保密设计或私人授权证明的二进制。[Dataset assets](https://www.sanity.io/docs/content-lake/assets)
- Studio 与 `@sanity/client` 上游源码为 MIT，分发需保留 notice；托管 Content Lake 另受服务条款和所选套餐约束，MIT 不等于托管免费、资产免授权或可以分发任何截图。[Studio MIT](https://raw.githubusercontent.com/sanity-io/sanity/main/LICENSE)、[Client MIT](https://raw.githubusercontent.com/sanity-io/client/main/LICENSE)、[服务条款](https://www.sanity.io/legal/tos)
- 官方角色说明区分 Administrator、Editor、Viewer、Contributor 等，角色可用性随套餐不同；细粒度 custom roles 属付费 Enterprise 能力。不能把表单 readOnly 当服务端授权，也不承诺免费套餐满足编辑／审核分离。[Roles and permissions](https://www.sanity.io/docs/content-lake/roles-concepts)

Studio 独立配置拟置于 `tooling/gallery-studio/sanity.config.ts`，用 `defineConfig` 固定项目／真实 dataset 名／schema types，不嵌入 `/studio`、不把其 React／插件带进 PicWiz。配置方式见 [Studio configuration](https://www.sanity.io/docs/studio/config-api-reference)（同日访问）。单独 `tooling/gallery-studio/package.json`／lockfile 管理依赖；实施者须在开始安装时记录具体稳定版 semver、Node/React peer 和许可证，并验证 Studio build／发布／schema；不得使用 `@latest`、预发布版或浮动主分支作为可复现版本。**本文未安装或锁定 Sanity Studio 包，没有声称任一 npm 最新版已兼容 Next 16.4.2／React 19.2。** 独立 Studio 不需要与 Next 共用 React 运行实例。

默认生产配置为专用 Sanity project＋一个 private dataset `gallery-production`；schema smoke 在另一个开发 project／`gallery-development` 上完成，确定性测试全用本地 fixture。不靠同 project 的普通内置角色实现未经核验的 dataset 隔离。project ID、Studio host、席位／套餐、CORS 白名单由部署门槛填入；仅 Studio origin 获 CMS 浏览器访问配置，PicWiz origin 不配置 CMS CORS，因为 PicWiz 不访问 CMS。

### 6.2 所有权与发布权限

| 主体 | 允许职责 | 强制边界 |
| --- | --- | --- |
| 内容负责人 | 六模板、虚构样图、逐项许可与替代方案的业务所有者 | 具名负责人写入运维配置；不代表拥有用户本地图。 |
| CMS Contributor（若套餐提供） | 草稿文字、上传公开样图、准备新 revision | 无正式内容发布权限；无法用该角色覆盖已发布数据。 |
| CMS Editor／发布者 | 审核后发布新 revision 和 release 文档 | 能 publish 不等于能部署 PicWiz。首次发布后 Studio 隐藏就地编辑／删除，提供“复制为下一 revision”。服务端实际权限仍由 Sanity 角色决定。 |
| CMS Administrator | 管理成员、token、dataset、撤销与恢复 | 最少人数；不将 admin token 用于构建。 |
| 构建机器人 | 读 private dataset 中需要的已发布文档 | 只读 Viewer token；无 mutation、成员或 webhook 管理权限。即使 token 技术上能读草稿，query／校验也不得取草稿。 |
| 应用发布维护者 | 审阅构建报告，人工触发候选构建及原子 promotion／回滚 | 不能绕过 schema／许可／哈希失败。紧急撤权可发布拒绝清单，不能修改旧 recipe。 |

这些身份只存在于 CMS／CI 运维，不创建 PicWiz admin/editor role，不映射 Clerk 用户或 organization。没有足够套餐权限时，采用一名受信发布者＋独立 CI 发布审核；不能伪称有服务端强制的双人审核。最终采用哪种权限配置须在部署记录验证，不能因此扩大应用账户范围。

## 7. 内容、目录与资产 schema

所有 schema 均有明确 version／additionalProperties=false；构建解包时先移除且仅移除 Sanity 保留元数据 `_id,_type,_rev,_createdAt,_updatedAt,_key`，再校验业务字段，不能以“CMS 可扩展”为由忽略未知业务字段。Sanity asset 原文只投影允许字段，不能透传整个文档。时间统一 UTC ISO-8601；数字必须 finite／safe integer。初期单语言内容，默认虚构示例文字固定，不使用构建当天日期。

### 7.1 CMS 文档（均为拟议 schema）

| `_type`／ID | 精确业务字段、约束与引用 |
| --- | --- |
| `galleryTemplateRevision`／`galleryTemplate.<id>.r<revision>` | `schemaVersion:1,id,revision,slug,task:update\|detail,layoutId,title,description,defaultContent:{title,meta},suggestedLook:Look,suggestedSize:SizeId,sampleAssetRef,sampleCrop:Crop\|null,licenseRefs:string[]`。目录 title 1–40、description 1–160 grapheme，单行纯文本；defaultContent 按第 3 节；slug=id；task/layoutId 对应 registry；sampleCrop 与任务一致；licenseRefs 非空去重最多 8。Look 只六外观字段，必须完全等于 V2 allowlist 严格验证后的值，不能包含 size/scale。 |
| `galleryAsset`／`galleryAsset.<id>` | `schemaVersion:1,id,sanityAssetRef,rawSha256,mime,width,height,licenseRef,alt`。只能强引用该项目该 dataset 的 `sanity.imageAsset`；不接受 `_weak`、跨 dataset／Media Library 链接或外部 URL。mime 为 PNG/JPEG/WebP，alt 1–120 单行 grapheme。rawSha256 为审核确认的下载原始 bytes 哈希，尺寸不得信任 CMS 声明。首次上传后 inspect 工具给出哈希／尺寸报告，发布者核对后填入，未填写不得发布。 |
| `galleryLicense`／`galleryLicense.<id>.r<revision>` | `schemaVersion:1,id,revision,author,sourceLabel,licenseName,licenseVersion,licenseText,acquiredAt,modifications,commercialOutputAllowed:true,clientRedistributionAllowed:true,attributionRequired:boolean,attributionText,proofRecordId`。许可全文≤64KiB UTF-8；作者／名称各≤120 grapheme，修改说明≤500。proofRecordId 为受控私有审查记录编号，不是公开文件 URL。追溯来源可在私有审查记录中记 inert HTTPS 文本，不供构建请求或页面 embed。任一许可缺失／禁止再分发／期限不覆盖发布即拒绝。首期禁止需要在每张用户 PNG 加署名的素材；网页／包内 notice 可满足的署名按条款审核后允许。 |
| `galleryCatalogRelease`／`galleryRelease.<releaseId>` | `schemaVersion:1,releaseId,sequence,previousReleaseId:string\|null,entries:ReleaseEntry[],documents:DocDigest[],policyEpoch`。releaseId 为≤64字符小写字母数字连字符，sequence／policyEpoch 为正 safe integer。ReleaseEntry 精确为 `{templateRevisionRef,state:published\|deprecated\|withdrawn,replacementRef:string\|null,reasonCode:none\|superseded\|asset_missing\|license_revoked\|security}`。DocDigest 精确为 `{id,digest:Sha256Hex}`，列出此次引用的全部模板／素材／许可业务文档（不含 release 自身），最多256项，无缺失／多余／重复；digest 为剥离 CMS 保留字段后的 canonicalJSON 哈希，由 inspect 报告提供。相应内容不一致即拒绝，避免跨文档读取拼成混合版本。同一 id/revision 唯一；replacement 不得自身引用、循环或指向 withdrawn。首发恰好六个 published ID；后续主动撤架可少于六个，报告须列明原因，不能因无效文档被悄悄过滤。 |

revision 文档的业务内容一经首次采纳即不可变；修改默认文字、建议 Look、样图、布局或许可都要新 revision。同一 id/revision 若与历史归档的业务 digest 不同，构建报 `catalog_revision_mutated`，即使 CMS `_rev` 合法且 Studio 已 publish 也拒绝。CMS 的 `_rev` 用于读取一致性检查，不是产品 revision。发布者不能通过删除、重建同 ID 绕过不可变检查；已用 ID 永不回收。许可文档和素材替换也新建 ID／revision。

每次CatalogRelease.entries须覆盖历史归档中所有已发布id/revision，再加本次新revision；遗漏旧ref是错误，不等于隐式删除。withdrawn项的id/revision/slug从已审归档或其强引用标识读取，只生成墓碑，不要求重新下载已撤权sample或读取许可正文；其已归档业务文档不加入本次DocDigest闭包。published/deprecated项必须有完整的已发布文档及DocDigest。紧急ledger可覆盖任何既有ref的状态；首次见到且从未公开的withdrawn ref拒绝，避免拼错标识形成假撤权成功。

### 7.2 浏览器唯一目录：ManifestV1

产物路径为 `/gallery/catalogs/<catalogRevision>/manifest.v1.json`，结构如下；这些是静态文件，不是运行时 CMS API。

```text
ManifestV1 {
  schemaVersion: 1,
  catalogRevision: Sha256Hex,
  rendererContract: "gallery-2d@1",
  templates: (TemplateRecordV1 | WithdrawnRecordV1)[],
  assets: PublicAssetV1[],
  licenses: PublicLicenseV1[]
}
TemplateRecordV1 {
  id, revision, slug, task, title, description,
  state: "published" | "deprecated",
  replacement: {id,revision} | null, reasonCode,
  defaultContent: {title,meta}, suggestedLook, suggestedSize,
  recipeHash, layoutSnapshot,
  sampleAssetHash, sampleCrop,
  previews: {<each six SizeId>: {thumbHash,previewHash}},
  licenseIds: string[]
}
WithdrawnRecordV1 {
  id, revision, slug, state: "withdrawn",
  replacement: {id,revision} | null,
  reasonCode: "asset_missing" | "license_revoked" | "security" | "superseded"
}
PublicAssetV1 {
  hash: Sha256Hex, path: RootRelativeAssetPath,
  kind: "sample" | "thumb" | "preview" | "font" | "license-text",
  mime, bytes: positiveSafeInteger,
  width: positiveSafeInteger | null, height: positiveSafeInteger | null,
  licenseIds: string[]
}
PublicLicenseV1 {
  id, author, sourceLabel, licenseName, licenseVersion,
  textAssetHash, attributionText, modifications
}
```

相应字符串和 Look／Crop／layoutSnapshot 使用前述约束。PublicLicenseV1.id固定为`<licenseId>@<licenseRevision>`，其他licenseIds引用相同版本化标识，不混淆同一许可的新旧修订；文本asset也必须有对应合法许可。reasonCode使用第7.1节枚举：published须none，deprecated须superseded，withdrawn须非none。首期 templates≤128（包括合法历史 revision／撤架墓碑）、licenses≤64、assets≤512；manifest UTF-8≤256KiB。ID/revision、资产 hash、许可 ID 均唯一且所有引用可解析。历史增长超限时构建失败并要求另评 schema 分页／预算，不能自动截掉历史。

`catalogRevision=SHA256(canonicalJSON(manifest 去掉 catalogRevision))`，包含缩略图与资产 hash；构建时间／机器信息只进私有报告，不进该 hash。模板整体业务 digest 另存归档索引用于不可变检查，所有默认文案／建议 Look／许可变化都会被检测。全量公共 manifest 不含 `_rev`、CMS token、proofRecordId 或私有资产 URL。withdrawn 记录只保留精确的 WithdrawnRecordV1 墓碑，禁止进入模板解析器，不再分发撤权文字／样图／许可正文；只被撤权模板使用的资产／许可也从当前公共集合排除。`published` 为每 ID 至多一个当前展示项，其余合法历史项为 deprecated。

`RootRelativeAssetPath` 只允许 `/gallery/assets/<sha256>.<png|jpg|webp|woff2|ttf|txt>`，hash 必须与字段一致，extension／MIME／magic 必须匹配。无 scheme、query、fragment、`..`、百分号编码、反斜杠、重复斜杠或跳转。**CMS 没有 HTML／SVG／JSX／shader／CSS／脚本／任意 URL／执行表达式字段**；已知 layoutId 的代码只来自受审应用 registry。用户本地 raster data/blob 路径继续由现有导入器拥有，不能从 CMS 配置注入。

### 7.3 资产限额与许可包

| 输入／产物 | 初期预算与验证 |
| --- | --- |
| CMS 虚构样图 | 原始≤8MiB，边≤4096、≤4MP，单帧 PNG/JPEG/WebP；先 magic／声明尺寸，再有界解码。拒绝动画、SVG、HTML、无法完整解码或容器结束后附加其他payload的文件（PNG IEND／JPEG EOI／WebP RIFF长度均检查）；对透明度按原意保留。 |
| 镜像样图 | 去除 EXIF／定位／无关 metadata、统一 sRGB、最长边≤2048、≤2MiB；原始 hash 与镜像 hash 分别记录。用现有锁定 sharp 构建依赖重编码，不能在用户图片路径做服务器处理。 |
| thumb／preview | 每模板每格式各一张 PNG，最长边分别 480／960，≤160KiB／512KiB；缩小完整画布，保留精确比例，不用 object-fit:cover 裁内容。六种格式合计 36 对；只按需加载当前格式，其余 lazy。 |
| 输出字体 | 只允许 repo 固定审核的两份字体，不允许 CMS 上传字体；DM Sans＋Noto Sans SC 总≤32MiB，每件≤24MiB，固定上游 commit、文件哈希与 cmap。字体单独按需加载，不计为小图片。变更字体集生成新 recipe/revision，保留合法旧字体。 |
| 许可文本 | 每件≤64KiB，text/plain UTF-8；随公开资产分发适用 notice，页面有文字入口，无可执行 HTML。私有授权证据不进 public。 |
| 当前公开集合 | assets 总 bytes≤64MiB；先测量真实文件，超限发布失败，不用压缩下载大小冒充解码内存。浏览器每次只保留一个活动模板预览和一个导出画布；不缓存 36 张用户图。 |

Noto Sans SC 的官方字体元数据和 OFL 原文分别见 [Google Fonts metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/METADATA.pb)、[OFL 1.1](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt)（2026-10-23 访问）。该资料证明许可来源，不证明当前尚未选定的字体二进制已通过覆盖／大小／浏览器测试；选取具体 commit／生成静态文件后必须重核许可、hash 和上述预算。

用户原图仍沿用 V2：单件25MiB、40MP、16384边、规范化4096边及 data URL 上限；CMS 的更小样图预算不能修改现有本地图导入能力。首期输出不使用装饰 raster／第三方设备图，所以用户作品的必需公开资产只有受审字体；公共样图不成为用户场景依赖。用户主动使用示例时才经浏览器导入它。

## 8. 生命周期、不可用恢复与撤权

### 8.1 业务状态

`draft → published → deprecated → withdrawn` 是内容生命周期，非 CMS `_rev`。draft 只存在 Studio，不进 public；第一次被应用发布采纳后，revision 的业务内容冻结。后继发布仅在新的 CatalogRelease 中改变状态，不能改旧 immutable manifest。允许 published 直接 withdrawn 处理安全／许可事件；不允许 withdrawn 复活。纠正问题需新 revision，旧 tombstone 永留，避免引用重用。deprecated 不在默认发现结果；精确链接可查看、明确提示旧版后暂存应用，保留“看当前版本”次操作；withdrawn 禁止新的应用。

已保存 scene 保留自己的 snapshot，不随目录新版本自动升级。用户可继续调整本地图与文字；要换新版本须明确进入 staging，查看差异再提交。同 revision 若支持的 renderer 或必需字体不可用，不得以 default layout／系统字体／最新模板伪造成功。

### 8.2 同源 availability 静态政策

仅把撤权写入新 immutable catalog 无法约束旧页签或代码回滚，因此增加一份很小的、**构建产生的同源静态文件** `/gallery/availability.v1.json`，不是 CMS runtime 查询／用户 API／数据库。结构精确为：

```text
AvailabilityV1 {
  schemaVersion: 1,
  policyEpoch: positiveSafeInteger,
  refs: [{id,revision,state:"published"|"deprecated"|"withdrawn",reasonCode}],
  revokedAssetHashes: Sha256Hex[]
}
```

refs 包含所有曾公开的 template id/revision，无重复，上限128；asset hashes 上限512；总 UTF-8≤64KiB。policyEpoch 每次政策变更递增，拒绝同 epoch 不同内容和倒退。输入来自已发布 CatalogRelease，合并 repo 中拟议 `content/gallery/revocations.v1.json` 的紧急 ledger；ledger 只允许增加拒绝项、不允许 CMS 反向解除。该 ledger 结构为 `{schemaVersion:1,policyEpoch,withdrawnRefs:[{id,revision,reasonCode}],revokedAssetHashes:[]}`，纯公共标识，不含用户数据；由发布维护者审核版本控制。

policy 响应必须 `Cache-Control:no-store`，客户端 `cache:"no-store"`，8秒截止、只接受同源200／application/json，不跟随外域重定向；每次首次恢复 scene、确认 apply、每个新的 PNG／复制／重试操作前重新获取，不能用 stale cached policy 当成功。一次操作内只用同一份有效 policy，不在编码中轮询。会话内拒绝低于已见 epoch 的响应；页面获取焦点时可刷新并提示已打开模板的状态，不上传场景内容。

**离线取舍是本规格的显式假设：** Gallery 新应用和模板导出需要一次公开政策读取；政策不可达／未知 ref／未来 schema 时 fail closed，保留可编辑的本地 scene，允许重试、备份或显式返回 V2 平面。原有 scene=null 的本地 PNG、Look 和 Batch 不取 policy，继续独立运行。没有离线 Gallery 成功承诺，不增加 service worker／持久缓存来绕过撤权。

| 故障／状态 | 用户当前作品 | 构建／运维动作 |
| --- | --- | --- |
| 只有 thumb／公开 sample 缺失 | 目录保留可读文字；已有真实 source 的 scene 不因此丢图。使用示例时必须报错，不自动换样图。 | 候选 build 失败；核对上游 raw hash，重新镜像同 bytes 可修复，内容改变必须新 revision。 |
| 本地 source 解码失败 | 保留 scene/title/crop，提示重新选择源图；不能输出空图冒充成功。 | 无 CMS 写入；成功换图按第 3 节复位 crop/annotations。 |
| 合法旧字体／recipe 资源404或哈希不符 | 保留本地完整数据，停用该 scene 导出；重试或暂存替代模板／返回平面。 | 从受审归档恢复原 hash 的合法 bytes；不得在原 hash 路径放新文件或占位图。 |
| deprecated | 显示旧版标记，已有场景可继续；精确应用需确认旧版。 | 保留合法旧 recipe／字体，提供公开替代项；不自动更新用户作品。 |
| license_revoked／security withdrawn | 立即禁止新应用；获取新 policy 后停止该 scene 的模板导出，删除会话内受影响公开资源缓存，保留用户 source/style/annotations/title/crop以供本地恢复；禁止自动删除用户图。 | 先发布增量拒绝 ledger／policy 及撤资产补丁，清除当前和历史公开路径、CDN；不得因完整新目录 build 失败而继续分发已知撤权素材。随后发布新合法 revision／替代。 |
| policy 不可用／未知版本 | 显示“暂时无法验证模板可用性”；原图仍在，可重试或明确返回平面。 | 保留最后完整代码／目录发布，恢复静态政策服务；不得自动请求 drafts、放行未知版本。 |

返回平面只使用当前本地图和既有 V2 外观／标注；删除模板 recipe／字体绑定，不把受撤权的公开装饰烘焙进 PNG。若 source 本身是用户此前明确选择的公开示例，availability 按 source sample hash 提示其已撤权，要求替换该图后才可把它作为补救导出；这项公开示例来源标记只在本次会话／模板绑定可推知时显示，不能声称能追踪用户另外导入或下载的副本。完整模板 Apply 不把 sample hash 当作用户真实截图 hash。

撤权不能收回已下载 PNG、浏览器已存文件或离线旧应用副本；不声称 CSS/CSP 或删除 CDN 即可远程抹除它们。更新策略能约束的是再次联系服务的当前受支持客户端。旧客户端的不可撤回性是采用公开资产的残余风险，部署记录必须明确。

## 9. 构建、发布事务、保留与回滚

### 9.1 有界构建读取

只在构建进程使用 `SANITY_PROJECT_ID`、`SANITY_DATASET`、`SANITY_READ_TOKEN`、`GALLERY_RELEASE_ID`；都无 `NEXT_PUBLIC_` 前缀，不写进 `next.config.env`。GALLERY_RELEASE_ID 必须显式指定已发布 release，禁止查询“最后更新时间最大的一条”自动发版。Node 脚本通过进程环境读取，不假设 Next 会替独立脚本加载 `.env`。

固定 POST `https://<validatedProjectId>.api.sanity.io/v2025-02-19/data/query/<validatedDataset>?perspective=published&returnQuery=false`，Bearer 仅送这一 origin。body 为固定 GROQ＋参数 `{releaseId}`，不能拼接编辑者的 query。固定 query 一次投影 release、它引用的 revision／asset／license 和 asset metadata；在应用层检查所有 DocDigest、引用数量和闭包完整性。拒绝 `_id` 以 `drafts.`／`versions.` 开头的任何业务结果；perspective 和过滤双重约束，不把 CMS 发布状态当作自动应用部署授权。

query 响应解压后最多4MiB，超限立即 abort。每次请求15秒；429／5xx／临时网络失败至多重试两次，退避1秒／2秒，Retry-After大于30秒则结束此次 build。401／403／schema／digest／license 错误不重试。最多两个并行素材下载，每件15秒和8MiB流式字节限制，整个 fetch／mirror 阶段≤120秒。

下载地址只由校验过的 Sanity `image-<assetId>-<width>x<height>-<ext>` 引用构造：`https://cdn.sanity.io/images/<configuredProject>/<configuredDataset>/<assetId>-<width>x<height>.<ext>`；不使用 CMS `.url` 作为 fetch 输入，不允许 URL 代理、任意转换 query、跨 origin／project／dataset 跳转。拒绝重定向；不向资产 CDN 发送 dataset token。校验 rawSha256、magic、尺寸、单帧、有界解码与许可，再重编码并计算镜像 SHA-256。任何必需项缺失都失败，不能 catch 后跳过一项宣称目录发布成功。

### 9.2 单次发布事务

一条人工触发的 CI 流程完成以下步骤；使用 CI 原生 `gallery-publish` concurrency 组串行 promotion，不建应用服务器队列／worker。releaseId＋业务 digest 是幂等键，同输入重跑产物 hash 必须相同。

1. **prepare：** 读取当前部署的 catalogRevision／policyEpoch 与归档不可变索引，记为 expected previous。在 `.gallery-build/<buildId>/` 建候选目录，生产缺凭据直接失败；fixture 模式须显式 `--fixture`，不得自动用 fake 内容替代失败的生产 CMS。
2. **fetch／validate：** 读第 9.1 节固定 release，检查 sequence/previousReleaseId、全部 digest／状态前进规则／不可变版本与第 7 节 schema。收集私有 provenance（CMS `_rev`、raw hash、许可 proof ID），不打印 token 或响应 body。读取紧急 ledger 并合并最新 policy。
3. **mirror／render：** 验证素材，生成同源哈希资产／许可包；用第 10 节浏览器 renderer 生成 36 对 thumb/preview。相同输入不得包含 Date.now、随机种子、CMS 图片转换 URL 或系统 fallback 字体；所有 bytes／解码尺寸／许可证都有清单。
4. **seal：** 生成 ManifestV1、availability、`generated/gallery/release.json` 和 `generated/gallery/manifest.v1.json`。release.json 精确含 `{schemaVersion:1,catalogRevision,manifestPath,manifestSha256,policyEpoch}`；manifestSha256 是包含 catalogRevision 的完整文件哈希。先在临时目录验证所有 root-relative path、hash／MIME／字节和引用闭包，再一次 rename 成候选构建输入。此时尚未影响现网。
5. **verify：** 从封存产物构建应用，CMS token 随后从应用构建／测试环境移除；应用 build 只能读本地已封存 JSON。执行 schema/asset/72组合渲染、隐私／网络／CSP、V2／迁移回归和候选 smoke；测试使用虚构输入。此时禁止重新 fetch CMS 填补个别缺项。
6. **review：** 报告显示拟展示 ID/revision、与当前的业务差异、撤权／旧版、真实 bytes、许可摘要、36 格式 contact sheet、测试结果、未验收项与构建 commit SHA。维护者检查该确切候选产物，不在批准后再从 CMS 取“最新”。人工审批是未来内容运维步骤，本次只写规格不触发审批。
7. **promote：** 切换前重读 release／其业务文档的 `_rev`／digest、紧急 ledger 和活动部署指针。任何变动、较新 policyEpoch 或 expected previous 不匹配则停止并重建，不强行覆盖较新发布。使用 host 的原子 deployment alias 切换，app／manifest／哈希资源／policy 属同一封存产物；不逐个覆盖 public 文件。切换后验证详情、全部资源hash、no-store policy、健康与CSP；失败原子恢复上一合法产物，撤权例外按第 9.3 节处理。
8. **retain：** 存不可变归档、完整成功／失败报告、独立 hash 清单和部署指针。构建失败、CMS outage 或撤销审核保留最后完整发布，不把“继续服务旧版本”写成新 release 成功；首次无合法产物就停止部署。

读取多份 CMS 文档不被描述为数据库事务。release 的 DocDigest 锚定精确内容，`_rev` 二次检查发现编辑漂移；发布维护窗口和 CI 串行 promotion 防止正常竞态。通过后出现的新 CMS 编辑只进入下一次构建。应用运行完全不依赖 CMS 可用性；访问图库仍会产生普通静态托管日志，不能称为“完全没有网络”。

### 9.3 紧急撤权、归档和回滚

- **正常失败：** 不动当前发布。正常回滚以现存合法封存 artifact 的应用、manifest、资源整体部署，不从今天的 CMS 重新生成旧 revision。回滚 CMS 内容只是新建一个 release，不能把 sequence 倒回或修改旧文件。
- **已知撤权优先：** 完整新 catalog 尚未通过时，可从最后合法产物生成一个仅增加 policy 拒绝项、移除公开违规资产／撤架详情的补丁产物；补丁不能增加模板或放宽政策。它只需通过受影响的 schema／资源／恢复／路由 smoke，之后继续完整发布。现网旧版不是继续分发已知违规资产的豁免。
- **撤权后的回滚：** 禁止直接一键回到带旧 policy／违规资产的部署。必须将目标旧应用 artifact 与**当前最高 epoch 的拒绝 ledger／policy、已净化的公共资源集合**重新封装为一个可审阅 rollback artifact；保留新的拒绝政策，验证旧应用也识别 AvailabilityV1。无法保证该点时只回到不提供 Gallery 的 V2 平面安全版本，并保留用户 v3 工作数据供兼容版本恢复，不能改版本号伪造降级。
- **不可变路径：** 相同 hash 永远不被重写为其他 bytes。许可／安全删除允许路径变404；普通废弃不能删掉合法旧 scene 必需字体／recipe。缓存为 `/gallery/assets/*` 和 `/gallery/catalogs/*` 设置 `public,max-age=3600,must-revalidate`，带 ETag；不用一年 immutable TTL 掩盖撤权需求。HTML 由既有 Next 策略处理，availability 始终 no-store。public 默认 max-age=0 不能当作已配置长期保留。
- **公开保留：** gallery-2d@1 受支持期间，保留所有合法已发布 recipe／必需字体的哈希路径及 tombstone；不因为某 revision 不再展示就 GC。**当前 manifest 内所有 published／deprecated 记录引用的 sample／preview／字体／许可资源必须同时保留在当前 assets／licenses 集合并计入其预算**，包括 r2 发布后仍可精确访问的 r1；不得把它们当作未引用历史资源排除。只有当前 manifest 已无任何引用的私有归档资源才在归档预算单独统计；withdrawn 分支按墓碑和撤权规则处理，不继续分发违规内容。超过当前 manifest 预算即构建失败并另评 schema／预算，不静默丢引用或缩短承诺；重大 schema 退役须先有显式替代／本地恢复方案。
- **私有归档：** 成功部署的完整 app／manifest／合法资源至少保留90天且至少最近20个成功发布（取更长范围）；所有已发布 revision 的业务 digest、政策ledger和许可审查记录在该 renderer 支持期内保留。失败候选／虚构测试证据保留14天。若法律／安全要求连备份也删，删除受影响二进制并保留不含内容的 tombstone／hash／处置记录，恢复工具不得重新分发它。CMS export 不是唯一备份。
- **CMS 可迁出性：** 定期由运维导出 dataset 文档与公开样图并校验每件 hash／数量／引用。Sanity 官方说明资产401/403/404可被跳过且导出仍完成，故 CLI exit 0 不代表备份完整；含 warning 或缺件的归档不得标记 recoverable。[Exporting data](https://www.sanity.io/docs/content-lake/exporting-data)（2026-10-23 访问）。用独立恢复演练验证从文档＋资产＋许可包重建相同 manifest，不依赖 CMS 在线。

内容／应用回滚不自动降级浏览器 store v3。任何 V2 应用回退必须按根规格先私下备份三键并由用户明确恢复 pre-v3；旧备份不含后续模板编辑，不删除当前 v3 以“修复”目录故障。

### 9.4 首期不设置 CMS webhook

人工触发已满足本期频率，**不新增 `/api/webhooks/sanity`、revalidate route、公开 deploy hook、定时抓取、CMS 服务端队列或 Sanity Functions**。CMS publish 与应用 promotion 的差异在 Studio 帮助文案和运维报告写明。若以后证明人工延迟成为实际瓶颈，再单独变更范围：仅允许验证原始 body 的签名 webhook、限长／限流、事件幂等／重放防护，目标是触发同一封存构建而非直接改变 live manifest。具体验签按届时固定版官方工具实现；不能把无签名的隐藏 URL 当授权。官方提供 webhook API 与签名工具，并不说明本期必须采用。[Webhooks API](https://www.sanity.io/docs/http-reference/webhooks)、[官方 webhook toolkit](https://github.com/sanity-io/webhook-toolkit)（同日访问）。

## 10. 渲染、缩略图一致性与 CSP

`scene=null` 原样调用现有同步 `renderComposition`；Gallery 采用 `prepareTemplate(snapshot,signal) → PreparedTemplate`（异步验证政策、字体和来源）＋`renderTemplateComposition(canvas,prepared)`（同步绘制）两个窄阶段。后者只接受完整冻结输入，实际 W/H 来自 snapshot.style，不读取 React state／DOM／CMS。Gallery 不修改 `lib/batch.ts` 同步 adapter 的含义；未来异步 POC renderer 由父规格协调，不能直接塞入 V2 batch。

源图与标注绘制从 `lib/canvas.ts` 抽出窄的共享函数，V2 包装保持原像素语义；模板主图／细节均调用同一源图绘制。以 Canvas 的 transform＋clip 实现同源 detail，不做 DOM 截图／CSS transform 导出、不把既有带背景的 V2 成品作为 detail 源。Canvas 的 CSS 预览尺寸只影响显示；测量与绘制先在真实输出尺寸上得到同一 layout，预览按相同比例缩小，不能按 preview viewport 重新换行。

字体 bytes 由同源哈希资产获取并先验 hash，再用独立 FontFace family 注册；记录字体 variation/weight，标题600、meta400。标题使用确切字体集，不受页面 CSS／系统默认字体变化影响。构建期产出 `generated/gallery/font-coverage.json`，为每个受审字体 hash 提供实际 cmap 可绘制 code point ranges；客户端以其验证标题。不能拿 `document.fonts.check` 的 true 充当 glyph 覆盖证明。字体生成工具／压缩器的确切版本、输入 commit 和字形覆盖清单也进入封存报告；所选工具尚须实施时锁定和审查，不在本轮安装。

thumb/preview 生成由已有 Playwright Chromium 驱动受控 loopback harness，加载**与产品完全相同**的 scene validator／Canvas renderer／字体及虚构 source。拟议 `scripts/gallery/render-thumbnails.mts` 用已锁定 TypeScript API 编译所需共享模块，`scripts/gallery/thumbnail-harness.html`／`thumbnail-entry.ts` 在随机 `127.0.0.1` 端口服务受限 ESM；只允许构建输入文件白名单，extensionless 相对模块请求映射到已编译 `.js`，无目录遍历／任意文件服务。结束关闭 server／browser 并删除临时目录。无需生产测试路由、新 bundler、远程浏览器服务或 CMS SDK。

生成流程为：每个 revision／SizeId 构造1× RenderSnapshot→等待相同字体→真实 PNG→在浏览器 Canvas 生成完整画幅的480/960最长边缩图→无损规范化 metadata→hash。harness使用本次候选的已校验policy／recipe／素材作为prepare边界输入，不请求尚未上线的availability或旧生产manifest；产品浏览器仍必须经过live同源policy检查。2×单独走真实导出验收，不能拿1×放大冒充2×。公共样图 title/meta/crop 来自 revision，建议 Look 和固定格式来自 manifest；产品“使用示例＋采用建议 Look／尺寸”应重现该构图。用户保留不同 Look／尺寸时预览明确呈现差异，不承诺仍等于目录默认卡片。

每个候选产物生成 `render-evidence.json`，精确记录 rendererContract、应用 SHA、recipeHash、source mirror hash、font hashes、内容 hash、size/scale、Playwright／Chromium版本及 PNG／thumb hashes，不写个人源图／标题。相同封存环境同输入要求完全相同的 PNG像素；跨浏览器／OS用结构、颜色块、裁切、文本完整可读和容差断言，单列字形抗锯齿差异，不能宣传跨设备逐像素一致。renderer／字体变动必须更新 renderer 合同或新 recipe 并重新审阅 goldens，不能无条件重录快照吞掉回归。

单张 PNG／复制使用现有 `canvasToPng` 和共享原生锁，精确输出六尺寸×两倍率，PNG 解码后验证尺寸而非只看下载文件名。字体／policy／source 预备失败发生在编码前；超时／取消后继续遵守真实 callback settlement 的锁语义。Clipboard 继续浏览器能力／权限边界，用户点击时立即将受控 PNG promise 交给现有 ClipboardItem/write 路径，避免等待字体／网络后丢失 user activation；失败提供 PNG下载，不能因复制失败报模板已丢失。真实 OS clipboard仍需人工验证，不以 adapter fake 声称系统互通。

Gallery 路径维持当前生产 CSP：`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`。保留 nosniff／no-referrer／DENY／现有 Permissions-Policy。`unsafe-eval`、ws/wss只允许开发配置；不为 CMS、字体或素材加 `*`、Sanity域、远程script、data: script、wasm例外。当前 Next inline 例外是既有约束，不能宣称已实施严格无 inline CSP；模板纯文本／封闭schema防止把该例外变成内容代码执行入口。账户路由若扩Clerk域，由父规格限到账户路径，不能溢出图库。

已核对安装版 Next **16.4.2** 本地指南：

- `01-app/01-getting-started/05-server-and-client-components.md`：RSC 只读公开静态 JSON，Canvas／localStorage／FontFace由客户端生命周期启动；用户图片和文字绝不成为服务器props／Action参数。
- `01-app/03-api-reference/04-functions/generate-static-params.md`、`03-file-conventions/dynamic-routes.md`、`03-file-conventions/02-route-segment-config/dynamicParams.md`：详情 `params` 为 Promise，await后验证slug；generateStaticParams包括合法slug和已知撤架墓碑，当前未开启 Cache Components，使用 dynamicParams=false令未知slug404。若未来开启该flag，需重新核对该配置支持，不照抄旧经验。
- `03-file-conventions/public-folder.md`：public URL从根路径解析，默认max-age=0；hash资产和policy响应头必须显式配置／实测代理，不是假定由文件名自动获得immutable缓存。
- `02-guides/environment-variables.md`：构建secret不加NEXT_PUBLIC，不通过next.config.env注入；Node独立脚本不依赖Next的env加载。
- `02-guides/content-security-policy.md`：nonce会改变动态渲染要求，SRI仍是实验能力；本期沿用已知静态页面兼容CSP，不把实验SRI／静态nonce方案当已验证安全收益。

## 11. 拟议文件与职责（本轮均不创建应用文件）

| 路径 | 实施职责／允许依赖 |
| --- | --- |
| `app/templates/page.tsx`、`app/templates/[slug]/page.tsx` | 公开RSC壳与预生成详情；只导入catalog.server；无用户数据／CMS fetch。 |
| `components/gallery/catalog.tsx`、`template-detail.tsx` | 纯公开筛选／格式预览、许可文字、占位／失败／空结果。 |
| `components/gallery/apply-dialog.tsx`、`template-content.tsx`、`detail-crop-editor.tsx` | 客户端审阅、文本、同源crop数值和可访问拖动替代。 |
| `lib/gallery/schema.ts`、`canonical-json.ts` | CMS投影／Manifest／政策严格校验、确定性哈希向量；与renderer解耦，无网络。 |
| `lib/gallery/recipes.ts`、`layout.ts` | 六recipe registry及布局／文字测量；无动态eval、CMS查询或React对象。 |
| `lib/gallery/catalog.server.ts` | 只导入sealed `generated/gallery/manifest.v1.json`，服务器只读入口，禁止运行时CMS client。 |
| `lib/gallery/catalog.client.ts`、`availability.ts` | 使用bundled release lock获取同源manifest／policy／hash资产；有界响应、错误码／取消。 |
| `lib/gallery/apply.ts` | staging／apply／一次检查点restore及generation检查；调用现有local repository，不创建第二个store。 |
| `lib/scene.ts` | 共同纯数据入口；精确TemplateSceneV1校验、从composition组装snapshot；父任务负责与POC接口整合。 |
| `lib/gallery/render.ts`、`lib/source-layer.ts` | 已准备scene同步Canvas绘制、共享源图标注／裁切；后者从现有canvas私有函数抽取并保持V2包装。 |
| `components/editor.tsx`、`app/globals.css` | 最小编辑器接点、focus、内容面板、恢复／平面确认、Batch说明，不重写V2导入／导出。 |
| `lib/storage.ts`、`lib/migrations/003-template-scene.ts` | 仅按父规格增scene与严格校验／三键备份保护；Gallery作者不另定义migration行为。 |
| `scripts/gallery/inspect.mts`、`fetch-sanity.mts`、`build.mts` | 只读CMS inspect／有界fetch／封存编排；token不能被app import。 |
| `scripts/gallery/mirror-assets.mts`、`render-thumbnails.mts`、`thumbnail-entry.ts`、`thumbnail-harness.html` | 原创素材重编码、loopback浏览器输出、清理；只处理公开fixture，不接用户文件。 |
| `scripts/gallery/verify.mts`、`release.mts` | 离线hash／许可／golden检查、promotion／回滚报告，host adapter由部署配置明确，不自行猜host API。 |
| `tooling/gallery-studio/sanity.config.ts`、`schemaTypes/{template-revision,asset,license,catalog-release}.ts` | 独立Studio配置／validation／新revision动作；单独package和lock，不打入Next。 |
| `content/gallery/revocations.v1.json` | 紧急公共拒绝ledger，审核后只增拒绝项；无秘密。 |
| `generated/gallery/{release.json,manifest.v1.json,font-coverage.json}` | 封存输出；app build只读。与对应public manifest bytes／hash一致。 |
| `public/gallery/catalogs/<hash>/manifest.v1.json`、`public/gallery/assets/<hash>.<ext>`、`public/gallery/availability.v1.json` | 同源只读目录／合法资源／no-store政策。历史合法资源从归档恢复到候选artifact。 |
| `next.config.ts`、`.env.example`、`package.json`、`.github/workflows/ci.yml` | 最小缓存头、无秘密变量说明、拟议命令与CI入口；不加入图库runtime SDK／服务端队列。 |

新增 `npm run gallery:inspect`（只读报告）、`gallery:build`（固定release生成候选）、`gallery:verify`（fixture／hash／渲染／发布事务测试）三个入口；`npm run build`要求已有合法sealed目录，缺失就失败，不能在Next runtime补抓CMS。`gallery:verify`是根 `verify:v3` 的可独立运行子步骤，不能依赖账户测试数据库或真实Sanity凭据。Studio使用自己的build入口，app依赖仍无Sanity SDK。新增库／工具均在未来实施时按精确稳定版本、lockfile和许可核验门槛处理，本轮没有安装。

## 12. 测试、fixture与可观测验收

以下是**待实现、待运行**的用例，不是当前通过记录。V2已有110／57结果仅作为基线；任何测试失败不得用“模板是静态内容”豁免。

### 12.1 固定测试输入

拟议 `tests/fixtures/v3/gallery/` 放受控虚构输入：

- `cms-published.json`：六revision、一个公开sample、两份合法许可、完整release及DocDigest；另有草稿但published投影不返回它，固定UTC时间／默认文字。fixture不含真实project ID／token。
- `source-quadrants.png`：1200×800，四个不同实色象限、细网格、边缘刻度与角标，源码生成、固定SHA；`annotations.json`含跨crop箭头／矩形、crop内外文字各一项。可验证orientation／裁切／锚点，不用照片视觉猜测。
- `scenes.json`：六个合法Scene、无source占位、旧合法revision、撤架ref、未来scene版本、非法／缺variant／被篡改recipeHash的场景。
- `release-cases.json`：同revision变更、跨文档digest不匹配、duplicate ref、未知layout／size、任意URL／SVG／HTML字段、缺许可、禁止再分发、缺asset、错误mime／hash、deprecated／withdrawn／replacement循环、policy倒退及同epoch不同内容。
- `text-cases.json`：59/60/61 grapheme、组合附加符／CJK／长英文词／单个超长token、LF／CR／双向控制符、HTML样式纯文本、IME完成、cmap不支持glyph和字号无法容纳。meta覆盖0/32/33。
- `release-history.json`：至少两个合法immutable release、一个待撤权revision、最高policyEpoch与合法hash索引，供回滚／中断测试；素材404／font超时／网络429等由fake transport注入。

资源边界8MiB/4MP、manifest256KiB、policy64KiB及字体预算使用内存生成的恰好上限与超1字节／1像素输入，避免提交巨型非法二进制。goldens只存虚构素材，`npm run seed`未来可增加这些fixture但不能改个人localStorage，seed不得访问CMS。fixture假响应不冒充真实Sanity smoke。

### 12.2 用例与必须观察到的结果

| 组／拟议测试文件 | 必须断言的结果 |
| --- | --- |
| `tests/unit/gallery-schema.test.ts` | 每层未知键／非有限数／URL／非法layout／缺六variant／错误hash／许可false拒绝；canonical固定向量跨Node/浏览器相同；控制字符／grapheme规则一致，业务revision不等于CMS `_rev`。 |
| `tests/unit/gallery-layout.test.ts` | 六×六布局完整；尺寸改变不改crop；真实source aspect-contain，主／细节用同一源投影；箭头跨裁切边界仅clip不变形；超padding/shadow／文字空间返回明确overflow，未静默重置。 |
| `tests/unit/gallery-apply.test.ts` | loading／staging无保存；取消／字体失败／迟到返回不改composition；确认一次提交；默认保持source/annotations/size/scale/Look，显式建议选项才改变；恢复整composition＋history，presets/jobs不回退。 |
| 同上＋既有race tests | stage期间source/annotation/size／StorageEvent变化使提交失效；apply/restore后旧pointerup拒绝；换图失败不变、成功保留title/meta而重置crop/annotations/history；remove/clear后检查点／late fetch不能复活图。 |
| `tests/unit/gallery-build.test.ts` | 用fake边界构建完整候选；draft/versions不漏出；digest闭包／历史不可变／模板6种约束；r2 改样图／文字且 r1 deprecated 时，两者引用的全部合法资源均进入当前集合，r1 精确预览／应用仍成功；引用资产漏失或纳入后超预算必须构建失败，未引用归档不计入当前集合。404/401／429重试上限／超body／重定向／wrongmagic／license失败fail closed；两次同输入产物一致且无timestamp漂移。 |
| `tests/unit/gallery-release.test.ts` | 在fetch/mirror/thumb/seal/build/promotion每个断点注入崩溃，现网仍是一套完整旧或新产物；较新部署／policy使旧候选失败；rollback不复活撤权asset，最高epoch不倒退；归档漏件即判不可恢复。 |
| `tests/e2e/gallery.spec.ts` | 无JS目录／详情可读；筛选／无匹配／未知slug／未知revision；query仅审阅不重复apply；无图占位／使用示例／默认保尺寸；失败有重试、焦点回到触发者。 |
| `tests/e2e/gallery-export.spec.ts` | **六模板×六尺寸×两倍率＝72个真实PNG组合，每个引擎均运行。** 独立解码IHDR／像素，检查精确尺寸、非空、背景、全图／同源细节、裁切色块与标注、标题不丢字／不侵入槽；含RGBA边缘／1px刻度。不能只测download事件／文件名或比较同一layout函数输出。 |
| 同上／缩略图比对 | 固定Chromium／字体环境从产品“使用示例＋建议值”导出，与构建参考PNG像素一致；其完整画幅缩小结果和thumb一致。Firefox/WebKit做结构／有界像素容差及人工字形检查，异常不能靠扩大全图diff容差掩盖。 |
| `tests/e2e/gallery-recovery.spec.ts` | v3保存／重载恢复相同scene／内容／输出；合法旧revision不升级；asset丢失／policy失败／withdrawn保留源图、显式替代／平面恢复；一键恢复不产生混合snapshot。未来scene／损坏hash只读恢复，不偷偷清零保存。 |
| `tests/e2e/gallery-compat.spec.ts` | scene=null的V2golden不变；starter/个人/云Look不改模板内容／尺寸；预设文件仍version1无scene；有模板Batch须确认且预览／ZIP为V2flat；原V2Batch上限／重试／取消不变。 |
| `tests/e2e/gallery-privacy.spec.ts` | 用特征图片／文件名／标题记录真实浏览器请求，除固定公开id／rev外无这些数据到URL／body／RSC／日志；无Sanity/Clerk/GPU/video chunk或请求；非法CMS字符串只显示文字。生产CSP／no-store头与代理一致；字体必须同源。 |
| `tests/e2e/gallery-accessibility.spec.ts` | 键盘发现→审阅→crop数值→apply→restore→PNG；390px无横向溢出／遮挡，语义错误／focus／live region正确；axe＋人工读屏／触控，reduced-motion不启动动画。 |

本地迁移003、三键clear／备份／配额／旧标签页、job恢复的完整fixture与断言由根spec维护，Gallery suite必须调用共享测试而非另写冲突的简化迁移。PNG取消／never-settle原生锁和复制权限沿用V2适配器并添加模板快照竞态。

### 12.3 实施时的验证命令与证据

保留现有 `npm ci`、`npm run typecheck`、`npm run test:unit`、`npm test`、`npm run build`。增加的 `npm run gallery:verify`必须串联：离线fixture构建→schema/asset/license/hash／发布事务单测→封存的生产build→临时生产server→Chromium/Firefox/WebKit的Gallery完整矩阵→清理。所有网络fake只替换CMS和host边界；真实Canvas/PNG不能fake。它不启动Clerk／账户worker／PostgreSQL，不等待GPU POC。根 `verify:v3`整合该入口及其他阶段测试。

报告拟存 `docs/v3/validation/gallery/<buildId>/` 的Markdown摘要和受控artifact链接，记录commit SHA、命令／退出码、浏览器版本、72组合逐项状态、失败PNG／缩略图／fixturehash、真实CMS smoke／权限／回滚结果和未测项；普通发布日志仅记录correlation ID、公开版本、bytes、错误码，不输出CMS响应体／token／个人标题或原图。

真实Sanity测试project smoke必须单独验证：Contributor不能publish、Viewer不能mutation、发布草稿不出现在候选、精确已发布release可构建、同revision篡改被拒绝、完整备份可恢复。人工核对桌面Chrome/Firefox/Safari与真实iPhone/Android的文字、PNG和系统剪贴板；Playwright WebKit／手机viewport不冒充实机结果。

## 13. 实施顺序、发布门槛与剩余配置

1. 父任务审定TemplateSceneV1／store v3接口；先冻结无模板像素回归、003及source/annotation epoch保护。
2. 实现schema／registry／纯布局／mock CMS adapter和fixture，先验证6×6×2实际PNG与crop／字体；不接真实CMS也能推进。
3. 实现staging／apply／atomic restore／V2兼容和可访问交互，接共同repository／PNG锁；完整通过取消／换图／clear竞态。
4. 加独立Studio及精确锁定工具链；在测试project验证角色／published边界，完成六套原创内容和逐件许可，建立有界构建／镜像／真实缩略图。
5. 演练候选封存、原子promotion、缺asset、license撤权补丁、净化回滚和CMS退出恢复；验证host响应头和artifact保留，再评审是否可发布G。无需等待D/V/A。

正式启用G前，以下各项必须有实际结果而非勾选文档存在：全部关键自动化通过；72组合每引擎真实PNG证据；无模板V2回归；本地迁移／恢复；sample／字体／notice许可；CMS真实权限smoke；隐私／CSP；atomic restore；缺件／撤权／rollback演练；可访问性人工检查。不能用成功的公共预览、npm安装／build、一次PNG、V2旧测试或CMS publish来替代这些证据。

部署维护者尚须填写而本轮不询问／不开资源：Sanity组织／project／真实dataset／private设置、Studio host与精确CORS、具体角色／套餐／席位、只读token的CI秘密引用与轮换负责人、实际字体文件commit/hash／cmap工具版本、六模板内容和授权证明、Node/Studio锁定版本、目标host及原子alias／CAS adapter、hash资产与no-storepolicy的实际代理头、当前最高policyledger、归档位置／地区／访问权／90天与20发布保留、内容／紧急撤权负责人、成本及费用告警上限。缺值允许继续本地fixture实现，禁止声称生产CMS集成或上线准备完成。

残余产品风险：六构图是否缩短真实发布时间尚未验证；过长文案／极端Look会被明确阻止，需观察错误率；全CJK字体下载和移动端72组合峰值尚无测量；policy离线fail-closed是可靠撤权与离线使用之间的明确取舍；本地profile共享／浏览器清理和旧离线客户端不可撤回的边界仍存在。建议后续用5名目标创作者完成“选模板→自己的图→两个尺寸PNG”，目标至少4人无引导完成、中位首次有效PNG≤60秒；这是拟议研究，不是已实现收益。

**当前判定：READY WITH RISKS，可作为后续实施合同。** 本文件定义实现和验收目标，未声称测试、供应商兼容、许可审查、权限配置、恢复演练或发布门槛已经通过；[评审记录](review.md)与[主规格](spec.md)保留实际范围和证据边界。
