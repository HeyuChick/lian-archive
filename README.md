# lian-archive

涟（Lian）的公开档案与研究员日志。站点基于 Astro 构建，部署于 Cloudflare Workers，公开地址为 `archive.heyuchick.com`。

## 模块

- **研究员日志** `/blog/`：直接在本仓库 `src/content/blog/` 写作。
- **样本档案** `/archive/`：由私有 Obsidian 仓库 `oc-lian` 编译生成。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 本地开发（localhost:4321） |
| `npm run build` | 构建到 `dist/` |
| `npm run deploy` | 构建并部署到 Cloudflare Workers |
| `npm run sync:archive:dry-run` | 预览档案同步差异，不写文件 |
| `npm run sync:archive` | 从 `oc-lian` 安全生成公开档案 |
| `npm run sync:archive:check` | 检查公开档案是否与源仓库一致 |

## 档案发布契约

`oc-lian` 是唯一事实源。只有显式声明以下字段的笔记才会进入公开仓库：

```yaml
publish: true
archive_path: lian/basic-info
archive_section: 角色 / 涟
archive_order: 10
archive_summary: 涟的姓名、种族、年龄、体型与世界归属
mood: calm
```

- `archive_path` 是稳定公开 URL，不依赖 Obsidian 文件位置。
- `archive_section` 和 `archive_order` 控制列表分组与排序。
- 同步器只输出公开字段，不复制价格、联系方式等私有 Properties。
- `<!-- archive:omit:start -->` 与 `<!-- archive:omit:end -->` 之间的内容不会发布。
- 当前是纯文本阶段，Obsidian 图片嵌入不会复制到公开仓库。

默认从同级目录 `../oc-lian` 读取；也可用环境变量覆盖：

```powershell
$env:OC_LIAN_PATH = 'D:\path\to\oc-lian'
npm run sync:archive
```

同步器会先完成元数据、路径、双链和生成结果校验，再替换 `src/content/archive/`。当公开条目为零时会默认终止，避免误清空现有档案。

## 博客内容

在 `src/content/blog/` 新建 `.md`，填写 `title / date / tags / mood`。生产构建会过滤 `draft: true` 的文章。
