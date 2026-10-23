# PicWiz

**在浏览器里，把截图做成适合分享的图片。** 选择外观、添加箭头与文字、切换发布尺寸，然后导出 PNG 或批量 ZIP。

[English](README.md) · 简体中文 · [文档](docs/README.md) · [使用指南](docs/guides/usage.md)

![PicWiz V2 桌面编辑器：本地截图、外观面板与 PNG 导出控件](docs/v2/screenshots/editor-desktop.png)

PicWiz 使用 Next.js App Router、React、TypeScript 和浏览器 Canvas。图片处理、预设导入、标注和 ZIP 打包都在浏览器本地完成，不需要账号、API 密钥或云存储。字体与示例图片也随应用提供。

## 快速开始

需要 **Node.js 24 LTS**、npm 和现代浏览器，无须创建 `.env` 文件。

```sh
git clone https://github.com/macopc/PicWiz.git
cd PicWiz
npm ci
npm run dev
```

打开 <http://localhost:3000>。首次访问会自动加载随附的虚构示例；已有本地工作区时会恢复工作区。用 **Add screenshot** 选择自己的图片；画布为空时也可以点击 **Use example**。可选进程变量见 [.env.example](.env.example)。

## 从导入到导出

1. **导入截图。** 拖入一张 PNG、JPEG 或 WebP，点击 **Add screenshot**，或在编辑器中按 `⌘V` / `Ctrl+V` 粘贴图片。替换成功会清除旧图的标注；无效文件不会覆盖当前作品。
2. **调整外观。** 在 **Style** 中选背景，调整 **Padding**、**Corner radius**、**Shadow**，再选无边框、浏览器或设备边框。**My presets** / **All looks** 提供 Studio、Paper、Midnight、Mint、Sunset、Ocean 六种起始外观。
3. **保存常用风格。** 点击 **Save preset**，输入 **Preset name**。预设只保存外观，应用时保留当前截图、标注、输出尺寸和倍率；可重命名、确认更新、删除，以及通过 JSON 导入／导出，最多保存 24 个。
4. **标出重点。** 用 **Arrow**、**Rectangle**、**Text** 添加标注，在 **Annotate** 中选图层、编辑文字、颜色和百分比位置。在画布中聚焦标注后，可用方向键微移、`Shift` 加速、`Delete` 删除，并可撤销／重做。标注用于说明图片，不用于遮盖敏感信息。
5. **选择尺寸并导出。** 在 **Output size** 中选择六种构图之一，**Scale** 选 1× 或 2×，点击 **Export PNG** 下载，或用 **Copy image** 复制。截图会完整适配画布；预览缩放不改变导出尺寸。

**批量导出：** 打开 **Batch export**，用 **Include current screenshot** 带上当前图及其标注，或点击 **Add screenshots** 添加文件。选 1–3 个尺寸和倍率，点击 **Prepare ZIP**，准备完成后再点击 **Download ZIP**。其他文件共用外观，但不会继承当前图的标注。关闭面板或刷新会丢弃本次批量文件和结果。

完整步骤、快捷键、失败重试和各尺寸像素见[英文使用指南](docs/guides/usage.md)。

<details>
<summary>查看预设库、批量面板与移动视口截图</summary>

预设库：

![PicWiz V2 预设库的实际界面](docs/v2/screenshots/presets.png)

批量面板：

![PicWiz V2 批量导出的实际界面](docs/v2/screenshots/batch.png)

移动视口（浏览器截图，不代表实机验收）：

<img src="docs/v2/screenshots/editor-phone.png" alt="PicWiz V2 在窄屏浏览器视口中的编辑界面" width="390">

图片来自实际 V2 界面，使用虚构示例。[截图来源与更新方式](docs/guides/screenshots.md)。

</details>

## 开发与测试

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm test
```

`npm test` 依次运行类型检查、单元／适配器测试和浏览器测试。Chromium 运行完整用例，Firefox／WebKit 运行关键流程。默认自动启动或复用 3000 端口的开发服务；请保持端口空闲，或按[开发指南](docs/guides/development.md)指定现有生产服务。已有 V2 验证记录为 **110 项单元／适配器测试、57 项浏览器用例通过**，实际执行范围见[验证记录](docs/v2/validation.md)。

文档变更运行 `npm run docs:check` 检查本地文件链接与图片引用；远程网址及标题锚点需要另行检查。`npm run seed` 只生成仓库中的虚构样例，不会修改浏览器数据。

## 限额、隐私与浏览器支持

- 单张输入最多 **25 MiB、4000 万像素、单边 16,384 像素**。导入会为本地存储进行缩放／压缩，归一化后单边最多 4096 像素；请保留原图。
- 批量最多 **10 张来源、3 种尺寸、30 张 PNG**；原文件总量 150 MiB、跨重试保留的 PNG 总量 64 MiB、ZIP 65 MiB。这些限额不等于浏览器总内存上限。
- 工作区属于当前**浏览器配置文件与站点 origin**；同一配置文件的使用者可访问其中的数据。浏览器清理、空间回收或隐私窗口关闭可能删除数据，没有云端副本。
- 当前截图、样式、标注、个人预设及最近 20 条导出任务记录保存在本地；任务记录不含可重新下载的 PNG／ZIP。批量文件、结果与标注撤销历史只留在本次会话。
- **Copy image** 依赖 HTTPS／localhost、浏览器能力及系统权限；失败时使用 **Export PNG**。编辑需要 JavaScript 和 Canvas，尚无离线 service worker。现有自动化涵盖 Chromium 及 Firefox／WebKit 关键流程，系统剪贴板、真实手机和低内存设备仍需单独验证。

如需清理、备份或恢复，请先读[本地数据指南](docs/guides/local-data.md)。**Remove screenshot** 不会删除旧版备份；**Clear local data** 经确认后才清除两个工作区键。恢复备份可能含截图，请私下保管。

## 文档与项目状态

**V2 已实现。** 现有功能包括外观预设、标注、六种输出尺寸、PNG／剪贴板、批量 ZIP，以及本地迁移与恢复。[V2 验证记录](docs/v2/validation.md)提供实际执行证据与边界。

**V3 只有规格，尚未实现。** [下一阶段规格](docs/v3/spec.md)规划模板库、Sanity、Clerk 外观同步、3D 和视频验证；这些不是当前可用功能，也不需要为运行 V2 配置相关服务。

- [使用指南](docs/guides/usage.md)：导入、风格、标注、尺寸、导出与批量限制。
- [开发指南](docs/guides/development.md)：环境、源码结构、测试和虚构种子数据。
- [本地数据指南](docs/guides/local-data.md)：保留范围、双键迁移、备份、恢复和回退。
- [部署指南](docs/guides/deployment.md)：生产运行、健康检查、安全响应头与故障诊断。
- [文档索引](docs/README.md)：架构、数据模型、现有 V2／V3 规格及评审记录。

## 参与贡献

请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。问题与改进建议可提交到 [GitHub Issues](https://github.com/macopc/PicWiz/issues)；安全问题按 [SECURITY.md](SECURITY.md) 报告。

PicWiz 原创代码与文档使用 [MIT 许可证](LICENSE)；字体、图标和依赖保留各自许可，见[第三方声明](THIRD_PARTY_NOTICES.md)。
