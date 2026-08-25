# lian-site

涟（Lian）的个人网站 —— 深海海蛞蝓 × 白色犬兽人共生体 OC 设定集与研究员日志。

基于 [Astro](https://astro.build) 构建，部署于 Cloudflare Workers，域名 heyuchick.com。

## 模块

- **研究员日志** `/blog/` —— 博客，直接在本仓库 `src/content/blog/` 写作
- **涟的档案** `/archive/` —— OC 设定，从私有 Obsidian 仓库 oc-lian 精选同步

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 本地开发（localhost:4321） |
| `npm run build` | 构建到 `dist/` |
| `npm run deploy` | 构建并 `wrangler deploy` 到 Workers |
| `npm run sync:archive` | 从 oc-lian 同步 `publish: true` 的档案 |

## 内容工作流

1. 博客：在 `src/content/blog/` 新建 `.md`，frontmatter 填 `title / date / tags / mood`
2. 档案：在 Obsidian（oc-lian）写作，想公开的文件加 `publish: true`，然后执行 `OC_LIAN_PATH=/path/to/oc-lian npm run sync:archive`
3. `mood` 字段（calm / joy / gloom / warm）驱动每页的情绪色

## 部署

Cloudflare Workers Builds：构建命令 `npx astro build`，部署命令 `npx wrangler deploy`，静态资源目录 `./dist`（见 `wrangler.jsonc`）。

## 历史

单文件静态页版本归档于 `legacy` 分支。
