import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    mood: z.string().default('calm'),
    draft: z.boolean().default(false),
  }),
});

const archive = defineCollection({
  // 支持嵌套目录（最深 4 层），镜像 Obsidian vault 结构
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/archive' }),
  schema: z.object({
    // title 可选：同步脚本从正文 H1 提取；都没有则回退文件名
    title: z.string().optional(),
    // 英文 URL slug（同步脚本依据映射表生成）；缺省时用文件名
    slug: z.string().optional(),
    // Obsidian 别名，双链可按别名解析到本条目
    aliases: z.array(z.string()).default([]),
    mood: z.string().default('calm'),
    order: z.number().default(0),
    publish: z.boolean().default(false),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { blog, archive };
