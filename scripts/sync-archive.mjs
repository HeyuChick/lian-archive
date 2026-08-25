#!/usr/bin/env node
/**
 * 将 Obsidian 仓库 oc-lian 中 frontmatter 标记 publish: true 的 Markdown
 * 精选同步到 src/content/archive/。
 * 注意：oc-lian 是私有仓库、本仓库是公开的，只有显式标记的文件会被复制。
 *
 * 用法：
 *   OC_LIAN_PATH=/path/to/oc-lian npm run sync:archive
 * 默认源路径：../oc-lian
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = process.env.OC_LIAN_PATH ?? join(process.cwd(), '..', 'oc-lian');
const DEST = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'archive');
const SKIP_DIRS = new Set(['.git', '.obsidian', '.trash', 'node_modules']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function isPublished(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m !== null && /^publish:\s*true\s*$/m.test(m[1]);
}

if (!existsSync(SRC)) {
  console.error(`[sync-archive] 未找到 oc-lian 仓库：${SRC}`);
  console.error('[sync-archive] 请设置 OC_LIAN_PATH 指向本地 Obsidian 仓库。');
  process.exit(1);
}

// 清空旧的同步产物（保留目录本身）
if (existsSync(DEST)) {
  for (const name of readdirSync(DEST)) rmSync(join(DEST, name), { recursive: true, force: true });
} else {
  mkdirSync(DEST, { recursive: true });
}

let copied = 0;
for (const file of walk(SRC)) {
  const md = readFileSync(file, 'utf8');
  if (!isPublished(md)) continue;
  const rel = relative(SRC, file);
  const target = join(DEST, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, md);
  copied += 1;
  console.log(`[sync-archive] ✓ ${rel}`);
}
console.log(`[sync-archive] 完成：同步 ${copied} 个已发布条目 → src/content/archive/`);
