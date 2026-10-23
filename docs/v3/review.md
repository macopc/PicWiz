# 下一阶段规格评审记录

2026-10-23。对象：[主规格](spec.md)、[Gallery](gallery-spec.md)、[Accounts](accounts-spec.md)、[3D／Video POC](render-poc-spec.md) 与 [范围摘要](spec-brief.html)。用户选择 D1B／D2A／D3A／D4C，本轮只写规格。

## 当前判定

**READY WITH RISKS：规格复审完成，无剩余已确认的P1/P2阻塞。** 产品R2、Gallery工程R2、Accounts工程R2及POC工程R3均已通过。本文记录并关闭规格缺口；它们不是当前V2中已启用功能的漏洞报告。未来所有新增自动化、供应商集成、恢复演练、真机与POC证据均未运行。

## 独立评审与响应

| 轮次 | 实际结论 | 响应／后续 |
| --- | --- | --- |
| `picwiz-v3-poc-engineering-review-r1` | 2 个 P2：Blob 视频 CSP 缺失；FIFO／64KiB sink 不能界定 mux 内部保留与复制 | 已增加 lab 唯一 CSP、完整池及 settlement 释放算法；视频8MiB、encoded容量96MiB、预留85.0625MiB；关闭库chunked分支，未认证格式在执行前阻止。增加慢writer／大flush／精确及+1／取消验收；R2确认闭合。 |
| `picwiz-v3-poc-engineering-review-r2` | R1两项已在规格层面解决；新增1个P2：浮点秒回微秒的trunc getter会误拒合法帧 | 已改为转换前严格检查原始整数chunk时间、转换后round核对，新增61／62／123帧回归要求。 |
| `picwiz-v3-poc-engineering-review-r3` | READY WITH RISKS，范围内无剩余确认P1/P2 | 确认原始整数时间／转换round及实际测试条款与固定源码一致；CSP、预约／释放及取消均无新增阻塞。每格式发布包证书仍须先于执行，原生／实机证据未跑。 |
| `picwiz-v3-gallery-engineering-review-r1` | 1 个 P2：历史样图／缩略图排除规则与 deprecated 引用闭包矛盾 | 已要求所有 published／deprecated 引用都保留在当前集合并计预算，增加 r2／r1 构建验收。 |
| `picwiz-v3-gallery-engineering-review-r2` | READY WITH RISKS，范围内无剩余确认 P1/P2 | 已确认历史资产修正、发布／撤权／回滚、Scene／布局／恢复及共同迁移合同；实际字体、CMS 权限、host 原子性和 PNG 验收仍待实施。 |
| `picwiz-v3-accounts-engineering-review-r1` | NOT READY：P1 错 live 实例密钥可能把有效用户误判删除；P2 空预设导出无合法结果 | 已增加每个不可变client／credential代次的instances.get匹配、独立部署绑定、失效／轮换规则和错误live key置换A13；空库422及A14。 |
| `picwiz-v3-accounts-engineering-review-r2` | READY WITH RISKS，范围内无剩余确认P1/P2或阻塞歧义 | 已确认实例门覆盖认证／worker／webhook／恢复，空库结果、未建库删除及DTO／事务／owner／RLS合同；A13／A14／A17仍是未运行要求。 |
| `picwiz-v3-product-review-r1` | 2 个 P2：未初始化云库的 Clerk 用户无法删除；空库导出无定义 | 空库问题与工程发现去重；补齐无映射→最小deleting记录、并发初始化屏障、删除回执／重试与A17；不启用同步。 |
| `picwiz-v3-product-review-r2` | READY WITH RISKS，五份原件无剩余确认P1/P2产品合同歧义 | 已确认选择范围、完整流程、恢复／删除、预览／导出、模板／Batch、所有权、迁移、顺序与验收；未运行的技术证明门槛仍保留。 |

首轮去重后共 **1 个 P1、5 个 P2**，POC第二轮另发现并修正1个时间精度P2。所有修正必须落在主规格／分规格实际正文和验收条款中，不仅写在本响应表；复审须读取修订后的原件。

## 共同合同的整合

- Clerk SDK 只进入账户文档，边界使用完整页面导航；受限 Protect／Cloudflare CSP 要求如实列出，不假称都是单一精确域。
- pre-v3 保存权威输入的原始 V1／V2 bytes，而非把转换后的 V2 对象冒充原始备份；工作键、legacy、备份三键参与冲突／清空。
- Gallery 可独立交付；模板单张导出与 V2 平面 Batch 有显式范围提示。D2A／D3A 是两个独立 POC，没有 3D 视频或云渲染。
- 服务端云 DTO 只允许名称＋Look，用户未启用云库也保留退出和删除身份的路径；实例绑定失败绝不能触发业务数据清理。

## 文档验证与证据边界

范围摘要已以 T3 html_preview 检查：728px浅色为577px高、390px深色为966px高，手机展开交付门槛为1139px高；无横向溢出，展开交互通过，无控制台异常。相对链接目标、UTF-8读取、两个拟议shell block的bash语法及git diff --check通过。另以Node核对3／5／8秒共480组计划时间／duration的算术往返与总和，复现并消除示例getter截断误差；这只是文档算术核验，不是应用测试或原生编码证据。

本轮未修改应用实现、package／lockfile、数据库迁移、环境配置或 CI；未安装依赖、创建服务、运行应用测试或 POC。规格内 shell 命令是下一阶段拟议命令，不是已执行测试记录。V2 的 [验收记录](../v2/validation.md)保持独立。

地区、套餐、真实密钥、发布 host、费用上限、素材／字体许可与真实实例配置是生产前门槛；不在本轮开通或冒充完成。通过规格评审只允许把合同交给后续实现，不等于通过产品发布验收。
