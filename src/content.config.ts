import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// passthrough：未在 schema 中声明的 frontmatter 字段原样保留，
// 避免页面代码读取未声明字段时拿到 undefined

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      mood: z.string().default('calm'),
      draft: z.boolean().default(false),
    })
    .passthrough(),
});

const archive = defineCollection({
  // 支持嵌套目录（最深 4 层），镜像 Obsidian vault 结构
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/archive' }),
  schema: z
    .object({
      // title 可选：同步脚本从正文 H1 提取；都没有则回退文件名
      title: z.string().optional(),
      // 英文 URL slug（可选覆盖）；缺省时用文件名（中文路径）
      slug: z.string().optional(),
      // Obsidian 别名，双链可按别名解析到本条目
      aliases: z.array(z.string()).default([]),
      mood: z.string().default('calm'),
      order: z.number().default(0),
      // 公开投影字段：URL、分组和排序均与 Obsidian 物理目录解耦
      archive_path: z.string(),
      archive_section: z.string(),
      archive_order: z.number().default(0),
      archive_summary: z.string().optional(),
      publish: z.boolean().default(false),
      updated: z.coerce.date().optional(),
      source_path: z.string().optional(),
      source_hash: z.string().optional(),
    })
    .passthrough(),
});

export const collections = { blog, archive };
