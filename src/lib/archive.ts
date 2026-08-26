/**
 * archive 工具函数：路径推导 / 标题提取 / 文件夹分组 / 双链扫描
 * id 形如 "01_设定/01_基础信息"（相对于 src/content/archive，不含扩展名）
 */

import type { CollectionEntry } from 'astro:content';

export type ArchiveEntry = CollectionEntry<'archive'>;

/** 拆分 id 为文件夹段与文件名 */
export function splitId(id: string): { folders: string[]; base: string } {
  const segs = id.split('/');
  return { folders: segs.slice(0, -1), base: segs[segs.length - 1] };
}

/** 是否为文件夹导读文件 */
export function isFolderIndex(entry: ArchiveEntry): boolean {
  return splitId(entry.id).base === '_index';
}

/** 条目 URL 路径：文件夹段原样（浏览器自动编码中文），末段用 slug ?? 文件名 */
export function entryPath(entry: ArchiveEntry): string {
  const { folders, base } = splitId(entry.id);
  return [...folders, entry.data.slug ?? base].join('/');
}

/** 标题：frontmatter.title → 正文 H1 → 文件名 */
export function entryTitle(entry: ArchiveEntry): string {
  if (entry.data.title) return entry.data.title;
  const h1 = entry.body?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) return h1;
  return splitId(entry.id).base;
}

/** 提取正文中全部双链目标名（不含别名显示部分） */
export function scanWikiLinks(body: string | undefined): string[] {
  if (!body) return [];
  const out = new Set<string>();
  const re = /\[\[([^\[\]|]+)(?:\|[^\[\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.add(m[1].trim());
  }
  return [...out];
}

/** 条目可被双链引用的名字集合：文件名 + aliases */
export function entryNames(entry: ArchiveEntry): string[] {
  return [splitId(entry.id).base, ...entry.data.aliases];
}

/** 反向链接：哪些条目通过双链引用了 entry */
export function backlinksOf(entry: ArchiveEntry, all: ArchiveEntry[]): ArchiveEntry[] {
  const names = new Set(entryNames(entry));
  return all.filter(
    (other) =>
      other.id !== entry.id &&
      scanWikiLinks(other.body).some((n) => names.has(n)),
  );
}

/** 按文件夹路径分组（扁平展示，组间按路径排序，组内按 order 再按 id） */
export function groupByFolder(entries: ArchiveEntry[]): { folder: string; items: ArchiveEntry[] }[] {
  const groups = new Map<string, ArchiveEntry[]>();
  for (const e of entries) {
    const folder = splitId(e.id).folders.join(' / ');
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(e);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
    .map(([folder, items]) => ({
      folder,
      items: items.sort(
        (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id, 'zh-CN'),
      ),
    }));
}
