# PicWiz V2 规格与实现评审记录

2026-10-23。V1 baseline `09179ae`。所有评审均针对本地文档和代码，未发布外部 issue。

## 规格首轮

产品审查 task `picwiz-v2-spec-product-review-r1`：REVISE。三个阻塞项为资源耗尽后无法恢复、取消语义/15秒硬保证不一致、迁移失败后的恢复UX不完整。另有平台场景标签、标注键盘/文本clip、后续交付命名和证据措辞建议。

技术审查 task `picwiz-v2-spec-engineering-review-r1`：BLOCKED。九项要求：native encoder实际settlement锁、跨attempt资源预算、稳定pair retryplan、冻结V1validator/ID兼容、双键冲突与清除、可执行job计数/不可变性、所有像素公式、标注完整schema/坐标/clip、独立CRC和边界验证。

## 响应与合同修改

全部接受，已写入 `spec.md` R1–R5 权威补充，并修正正文硬保证、平台标签和PRD证据措辞：

- 取消→stopping→cancelled；应用timeout不释放真实native锁；late callback丢弃；永久挂起需reload。可显式打包已完成结果，关闭丢弃session。
- 64MiB覆盖所有attempt；超额blob不接收。区分暂态与输入/预算错误，后者要求缩小批次；ZIP错误允许只重包装。
- 稳定source/size pairs与attempt ID，subset重试统计与合并archive统计分开。
- V1冻结常量+严格验证，兼容旧非UUID ID，job字段确定性回填。两键快照、key=null、legacy-first清除、generation失效。
- 恢复bar包含本地raw备份、session-only、retry/reload/确认reset；旧键留作备份直至确认清除，Remove范围只当前workspace。
- 明确像素公式与迁移误差、纯文字/唯一ID/六色/规范inactive字段、3 rendered lines双重clip、pointercancel和键盘焦点。
- CRC已知向量及独立header/offset检查，预算+1和late/cancel/retry测试；预设同文件重复导入幂等。

## 规格复审

产品复审 `picwiz-v2-spec-product-review-r2`：READY WITH RISKS；技术复审 `picwiz-v2-spec-engineering-review-r2`：READY WITH RISKS。两者均确认首轮阻塞项已解决，可进入实现。接受风险：native 永不回调需reload；64MiB仅是保留PNG预算而非总内存；迁移几何允许细小变化；真机/OS剪贴板证据仍待验证。产品假设和真机验证限制不由规格评审替代。

## 实现审查

首轮库审查 `picwiz-v2-core-review-r1`：确认一项 P2——部分成功后重试、在 decode 时取消，再打包时仍保留前一次 ZIP。已由 `picwiz-v2-batch-review-fix-r1` 修复：接受重试后、任何 observer/await 前清除 previous.archive；回归测试验证旧归档及时释放、成功 PNG 身份/累计预算和 manifest 不变。38 项 batch/ZIP 测试通过。

首轮界面审查 `picwiz-v2-ui-review-r1`：确认一项 P2——延迟预设文件读取可在关闭库并清空后重新写回预设。已加组件 mounted/import generation、15 秒读取超时，以及 Editor workspace epoch 检查。独立浏览器竞态回归 2/2 通过、重复 6/6 通过；覆盖关闭/确认 clear，以及 null/new/legacy StorageEvent 的 authoritative raw 保留。

实际浏览器初轮：41/46 通过；5 项失败归为 axe 标签/对比度、undo 后焦点、恢复按钮名称。已修正实际组件而非关闭规则；定向 7 项标注/恢复测试通过；axe 对空白、文字标注、已有用户预设的库和 batch dialog 四状态检查通过。文字标注补充 fits/clipped 反馈，层按钮 accessible name 包含可见内容。

实现复审 `picwiz-v2-implementation-review-r2`：CHANGES REQUESTED，两项 P2、无 P1。拖动期间替换截图可能将旧标注提交到新图；批量弹窗中的粘贴会影响背后工作区。已分别用 source revision 的 layer key + captured callback guard，以及 batchOpenRef 的 paste boundary 修复。对应真实 UI 交互回归在三个引擎通过，随后第三轮继续验证历史交互。

生产完整初跑 47/48 通过；Firefox 在刷新后恢复动态 disabled 属性，使本应无历史的 Undo 看起来可用。隔离对照（默认 disabled=false；SSR autocomplete=off 后 disabled=true）确认是浏览器表单状态恢复。Undo/Redo 在初始 HTML 中关闭该恢复行为，不改变历史规则或放宽测试。参考 [MDN disabled](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled)。最终固定构建与完整测试结果以 validation.md 为准。

第三轮 `picwiz-v2-implementation-review-r3`：确认一项 P2，Undo during drag 被 pointerup 的旧 snapshot 覆盖。已引入独立 committed annotation revision，预览不递增；拖动捕获 revision，提交/预览由实际 ref 校验，历史变更使活动拖动失效；selection overlay 与 committed 数组分离。新增真实 UI 的 Undo→release→Redo 回归，跨三个引擎执行。第四轮为该修复的定向独立复核。

Firefox 新增 paste 竞态用例初次失败是构造 ClipboardEvent 会清空 files：独立三引擎检查 Chromium/WebKit 保留 1，Firefox 为 0。测试仅为该不受信任事件注入真实 DataTransfer/File 的 payload，实际 importer、Canvas 和持久层保持真实，2/2 定向 Firefox 回归通过。这不证明 OS 剪贴板可用性，也未改动产品来接受虚构 API。

第四轮定向复核 `picwiz-v2-gesture-review-r4`：READY WITH RISKS，22 项当前源码 harness 检查通过，无确认 P1/P2。覆盖 Undo/属性编辑/删除在 rerender 与 effect 前后的 stale gesture 拒绝、Redo 保留、预览不取消正常拖动、单步历史、noop/cancel、连续键盘移动和 layer key 稳定。最终生产完整 57/57 浏览器测试、110/110 单元/适配器测试通过，三个新增交互回归均在 Chromium/Firefox/WebKit 通过。V2 验收完成。
