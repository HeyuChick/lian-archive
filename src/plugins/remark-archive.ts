/**
 * remark-archive —— 档案馆 Markdown 处理插件（三合一）
 *
 * 1. 剥离 oc-sync 同步标记注释（<!-- oc-sync:... -->）
 * 2. Obsidian callout：> [!info] 标题  →  带类型 class 的卡片
 * 3. Obsidian 双链：[[页面名]] / [[页面名|别名显示]]
 *    - 按“文件名（不含文件夹与扩展名）+ frontmatter aliases”全局解析，与 Obsidian 一致
 *    - 命中 → <a class="wikilink">；未命中 → <span class="wikilink-broken">（写了对应文章后重建自动激活）
 *
 * 注意：双链索引不经过 astro:content（避免集合加载循环依赖），
 * 直接用 import.meta.glob 读取原始 md 建立映射。
 */

import { visit, SKIP } from 'unist-util-visit';
import type { Root, Blockquote, Text, Link, Html, Parent } from 'mdast';

interface WikiTarget { path: string }

let wikiMap: Map<string, WikiTarget> | null = null;

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

  const files = import.meta.glob('/src/content/archive/**/*.{md,mdx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  for (const [file, raw] of Object.entries(files)) {
    const rel = file.replace(/^\/src\/content\/archive\//, '').replace(/\.(md|mdx)$/, '');
    const segs = rel.split('/');
    const base = segs[segs.length - 1];
    if (base === '_index') continue; // 文件夹导读不参与双链解析

    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    const fm = fmMatch?.[1] ?? '';
    const slug = fmScalar(fm, 'slug');
    const aliases = fmList(fm, 'aliases');

    const path = [...segs.slice(0, -1), slug ?? base].join('/');
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
      const [full, rawName, alias] = m;
      const name = rawName.trim();
      const label = (alias ?? name).trim();
      if (m.index > last) {
        out.push({ type: 'text', value: node.value.slice(last, m.index) });
      }
      const target = map.get(name);
      if (target) {
        out.push({
          type: 'link',
          url: `/archive/${target.path}/`,
          data: { hProperties: { className: ['wikilink'] } },
          children: [{ type: 'text', value: label }],
        });
      } else {
        out.push({
          type: 'html',
          value: `<span class="wikilink-broken">${label}</span>`,
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
