/**
 * remark-archive —— 档案馆 Markdown 处理插件
 *
 * remark 层：
 *  1. 剥离 oc-sync 同步标记注释（<!-- oc-sync:... -->）
 *  2. Obsidian callout：> [!info] 标题  →  带类型 class 的卡片
 *  3. Obsidian 双链：[[页面名]] / [[页面名|别名显示]]
 *     - 按“文件名（不含文件夹与扩展名）+ frontmatter aliases”全局解析，与 Obsidian 一致
 *     - 命中 → <a class="wikilink">；未命中 → <span class="wikilink-broken">（写了对应文章后重建自动激活）
 *
 * rehype 层：
 *  4. rehypeCodeBlocks：pre 包进 .code-block 容器，顶部 header 显示语言名 + 复制按钮
 *  5. rehypeTables：table 包进 .table-wrap（移动端横向滚动，斑马纹/边框由 CSS 提供）
 *
 * 注意：双链索引不经过 astro:content（避免集合加载循环依赖），
 * 直接从生成后的 archive 内容目录读取原始 Markdown 建立映射。
 */

import { visit, SKIP } from 'unist-util-visit';
import type { Root, Blockquote, Text, Link, Html, Parent } from 'mdast';
import type { Root as HRoot, Element as HElement, ElementContent } from 'hast';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ==================== remark：双链 / callout / oc-sync ==================== */

interface WikiTarget { path: string }

let wikiMap: Map<string, WikiTarget> | null = null;
const ARCHIVE_ROOT = fileURLToPath(new URL('../content/archive/', import.meta.url));

function archiveMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...archiveMarkdownFiles(path));
    else if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name).toLowerCase())) {
      out.push(path);
    }
  }
  return out;
}

/** 从原始 frontmatter 文本中提取单行标量字段 */
function fmScalar(fm: string, key: string): string | undefined {
  const m = fm.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'));
  return m?.[1]?.trim();
}

/** 从原始 frontmatter 文本中提取 YAML 列表字段 */
function fmList(fm: string, key: string): string[] {
  const block = fm.match(new RegExp(`^${key}:\\s*\\n((?:\\s*[-]\\s*.+\\n?)+)`, 'm'));
  if (!block) return [];
  return block[1]
    .split('\n')
    .map((l) => l.match(/^\s*-\s*["']?(.+?)["']?\s*$/)?.[1])
    .filter((v): v is string => !!v);
}

function buildWikiMap(): Map<string, WikiTarget> {
  if (wikiMap) return wikiMap;
  wikiMap = new Map();

  for (const file of archiveMarkdownFiles(ARCHIVE_ROOT)) {
    const raw = readFileSync(file, 'utf8');
    const rel = relative(ARCHIVE_ROOT, file).replaceAll('\\', '/').replace(/\.(md|mdx)$/, '');
    const segs = rel.split('/');
    const base = segs[segs.length - 1];
    if (base === '_index') continue; // 文件夹导读不参与双链解析

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    const fm = fmMatch?.[1] ?? '';
    const archivePath = fmScalar(fm, 'archive_path');
    const slug = fmScalar(fm, 'slug');
    const aliases = fmList(fm, 'aliases');

    const path = archivePath ?? [...segs.slice(0, -1), slug ?? base].join('/');
    if (!wikiMap.has(base)) wikiMap.set(base, { path });
    for (const a of aliases) {
      if (!wikiMap.has(a)) wikiMap.set(a, { path });
    }
  }
  return wikiMap;
}

/** 1) 剥离 oc-sync 注释 */
function stripSyncMarkers(tree: Root): void {
  visit(tree, 'html', (node: Html, index, parent) => {
    if (!parent || typeof index !== 'number') return;
    if (node.value.includes('oc-sync')) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
  });
}

/** 2) Obsidian callout 转换 */
function transformCallouts(tree: Root): void {
  visit(tree, 'blockquote', (node: Blockquote) => {
    const first = node.children[0];
    if (!first || first.type !== 'paragraph') return;
    const firstText = first.children[0];
    if (!firstText || firstText.type !== 'text') return;

    const m = firstText.value.match(/^\[!(\w+)\][ \t]*(.*)$/);
    if (!m) return;
    const calloutType = m[1].toLowerCase();
    const titleText = m[2].trim();

    node.data = node.data ?? {};
    node.data.hProperties = { className: ['callout', `callout-${calloutType}`] };

    if (titleText) {
      // 标记行剩余文字作为标题段落
      firstText.value = titleText;
      first.data = { hProperties: { className: ['callout-title'] } };
    } else {
      // 无标题：去掉标记本身；若段落变空则移除整个段落
      firstText.value = firstText.value.replace(/^\[!\w+\][ \t]*/, '');
      if (!firstText.value && first.children.length === 1) {
        node.children.shift();
      }
    }
  });
}

/** 3) 双链解析 */
function resolveWikiLinks(tree: Root, map: Map<string, WikiTarget>): void {
  const RE = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;

  const headingId = (heading: string) =>
    heading
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\p{Mark}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => entities[char]);

  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || typeof index !== 'number') return;
    if (parent.type === 'link') return; // 已处在链接内则跳过
    RE.lastIndex = 0;
    if (!RE.test(node.value)) return;
    RE.lastIndex = 0;

    const out: (Text | Link | Html)[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = RE.exec(node.value)) !== null) {
      const [full, rawTarget, alias] = m;
      const hashIndex = rawTarget.indexOf('#');
      const name = (hashIndex === -1 ? rawTarget : rawTarget.slice(0, hashIndex)).trim();
      const heading = hashIndex === -1 ? '' : rawTarget.slice(hashIndex + 1).trim();
      const label = (alias ?? (heading || name)).trim();
      if (m.index > last) {
        out.push({ type: 'text', value: node.value.slice(last, m.index) });
      }
      const target = map.get(name);
      if (target) {
        out.push({
          type: 'link',
          url: `/archive/${target.path}/${heading ? `#${headingId(heading)}` : ''}`,
          data: { hProperties: { className: ['wikilink'] } },
          children: [{ type: 'text', value: label }],
        });
      } else {
        out.push({
          type: 'html',
          value: `<span class="wikilink-broken" title="该条目尚未公开">${escapeHtml(label)}</span>`,
        });
      }
      last = m.index + full.length;
    }
    if (last < node.value.length) {
      out.push({ type: 'text', value: node.value.slice(last) });
    }
    parent.children.splice(index, 1, ...out);
    return [SKIP, index + out.length];
  });
}

export function remarkArchive() {
  return (tree: Root) => {
    const map = buildWikiMap();
    stripSyncMarkers(tree);
    transformCallouts(tree);
    resolveWikiLinks(tree, map);
  };
}

/* ==================== rehype：代码块 / 表格 ==================== */

/** 4) 代码块：包进 .code-block 容器，顶部 header 为语言名 + 复制按钮 */
export function rehypeCodeBlocks() {
  return (tree: HRoot) => {
    visit(tree, 'element', (node: HElement, index, parent) => {
      if (node.tagName !== 'pre' || !parent || typeof index !== 'number') return;
      const code = node.children.find(
        (c): c is HElement => c.type === 'element' && c.tagName === 'code',
      );
      if (!code) return;

      // 语言名：优先 Shiki 输出的 data-language，回退 code 的 language-* class
      let lang = (node.properties?.['dataLanguage'] as string) || '';
      if (!lang) {
        const cls = (code.properties?.className as string[]) ?? [];
        const hit = cls.find((c) => c.startsWith('language-'));
        if (hit) lang = hit.slice('language-'.length);
      }

      const header: HElement = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-header'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-lang'] },
            children: [{ type: 'text', value: lang || 'text' }],
          },
          {
            type: 'element',
            tagName: 'button',
            properties: { className: ['code-copy'], type: 'button', 'aria-label': '复制代码' },
            children: [{ type: 'text', value: 'copy' }],
          },
        ],
      };

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block'] },
        children: [header, node],
      } as ElementContent;
      return [SKIP, index + 1];
    });
  };
}

/** 5) 表格：包进 .table-wrap（移动端横向滚动容器） */
export function rehypeTables() {
  return (tree: HRoot) => {
    visit(tree, 'element', (node: HElement, index, parent) => {
      if (node.tagName !== 'table' || !parent || typeof index !== 'number') return;
      const parentCls = ((parent as HElement).properties?.className as string[]) ?? [];
      if (parentCls.includes('table-wrap')) return; // 已包裹则跳过
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'] },
        children: [node],
      } as ElementContent;
      return [SKIP, index + 1];
    });
  };
}
