import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const moodEnum = z.enum(['calm', 'joy', 'gloom', 'warm']);

// 研究员日志：直接在本仓库写作
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    lang: z.enum(['zh', 'en', 'ja']).default('zh'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    mood: moodEnum.default('calm'),
    relatedOC: z.array(z.string()).default([]),
  }),
});

// 涟的档案：由 scripts/sync-archive.mjs 从私有 Obsidian 仓库 oc-lian 精选同步
const archive = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/archive' }),
  schema: z.object({
    title: z.string(),
    publish: z.boolean().default(false),
    order: z.number().default(0),
    mood: moodEnum.default('calm'),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { blog, archive };
