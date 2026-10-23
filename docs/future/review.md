# 后续方案评审与验证记录

2026-10-23。评审对象为 [产品设计](product-design.md)、[统一决策单](decisions.md)、[Gallery／3D](gallery-and-3d.md)、[Video](video.md)、[Accounts](accounts.md) 与 [交互决策摘要](decision-brief.html)。这是**选型决策就绪**的证据，不是未来功能已经实现或具备上线条件的证明。

## 独立评审

| 评审 | 结论 | 处理 |
| --- | --- | --- |
| `picwiz-future-product-review-r1` | REVISE，3 个 P2 | 下列三项均已修正，再发起独立复审。 |
| `picwiz-future-engineering-review-r1` | READY WITH RISKS，无确认的 P1/P2 | 编码探测、许可证、成本、会话与恢复方案的关键区别有官方来源；未验证的实现能力保留为后续门槛。 |
| `picwiz-future-product-review-r2` | READY WITH RISKS，无剩余确认的 P1/P2 | 重新阅读全部六份交付物，确认三项修正及隐私、编号、选择范围一致。 |

产品第一轮发现及修正：

1. **Gallery 被错误绑定到 3D POC。** 已拆成独立产品化路径，明确 D1A＋D2C 可以完整交付；GPU 验证仅约束 3D。
2. **Supabase 仍指向旧选项 A。** 已改为 D4B：Supabase Auth 标准 SSR token 路线，摘要、表格及选择控件使用同一编号。
3. **D2B 范围不唯一。** 已固定为 R3F＋有明确再分发许可的 glTF；直接 Three.js＋glTF、2.5D 另作未来变体，不复用 D2B。

根文档另统一了模板目录的 `draft/published/deprecated/withdrawn` 状态及资源下架边界，并将 OTP 恢复文案统一为验证码过期。

## 实际完成的文档验证

- 本地 Markdown 相对目标和摘要图片路径存在，UTF-8 读取及 `git diff --check` 通过。
- 决策摘要经 T3 `html_preview` 检查：728px 浅色与 390px 深色，内容高度分别 1165px、1351px，无横向溢出、无控制台异常。
- 摘要交互检查：选中 D4D、生成文字，保留正确编号并显示可复制文本。它只生成本地文字，不发送选择、不创建资源、不启动开发。
- 摘要使用 V2 最终生产界面的真实截图；V2 的构建、110 项单元／适配器和 57 项浏览器测试证据在 [V2 验收记录](../v2/validation.md)。本轮仅修改文档，没有重新运行应用测试。

## 仍需下一阶段验证

尚未进行目标用户任务测试、GPU／编码 POC、物理设备验证、资产采购或逐件授权审查、供应商资源创建、安全集成、恢复演练及实际费用测量。所列性能、内存、转化和运维指标均是试验目标或估算输入。V2 的成功结果不能转用于这些能力。

用户选择 D1–D4 后，才编写所选阶段的唯一实现规格、迁移与验收合同并复审。云视频评估不构成图片上传授权；账号登录不构成截图同步授权。未选择的能力继续保持提案状态。
