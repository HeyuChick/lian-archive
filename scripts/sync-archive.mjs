#!/usr/bin/env node
/**
 * 将私有 Obsidian 仓库 oc-lian 编译为可提交到公开仓库的档案投影。
 *
 * 设计约束：
 * - 只处理 frontmatter 中显式 publish: true 的 Markdown。
 * - 公开 URL 由 archive_path 决定，不泄漏 Obsidian 的物理目录结构。
 * - 只输出允许公开的 frontmatter 字段，不原样复制私有 Properties。
 * - 在全部条目通过校验后，才以同盘临时目录替换现有生成目录。
 * - 第一阶段为纯文本发布：Obsidian 图片嵌入不会进入公开产物。
 *
 * 用法：
 *   npm run sync:archive
 *   npm run sync:archive -- --dry-run
 *   npm run sync:archive -- --check
 *
 * 默认源路径：../oc-lian；可通过 OC_LIAN_PATH 覆盖。
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has('--dry-run');
const checkOnly = argv.has('--check');
const allowEmpty = argv.has('--allow-empty');
const knownArgs = new Set(['--dry-run', '--check', '--allow-empty']);
const unknownArgs = [...argv].filter((arg) => !knownArgs.has(arg));

if (unknownArgs.length > 0) {
  console.error(`[sync-archive] 未知参数：${unknownArgs.join(', ')}`);
  process.exit(2);
}
if (dryRun && checkOnly) {
  console.error('[sync-archive] --dry-run 与 --check 不能同时使用。');
  process.exit(2);
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_ROOT = join(REPO_ROOT, 'src', 'content');
const DEST = join(CONTENT_ROOT, 'archive');
const SRC = resolve(process.env.OC_LIAN_PATH ?? join(REPO_ROOT, '..', 'oc-lian'));
const TEMP = join(CONTENT_ROOT, `.archive-sync-${process.pid}`);
const BACKUP = join(CONTENT_ROOT, `.archive-backup-${process.pid}`);
const SKIP_DIRS = new Set(['.git', '.obsidian', '.trash', 'node_modules']);
const MOODS = new Set(['calm', 'joy', 'gloom', 'warm', 'focus', 'tense', 'excited', 'overload']);
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const OMIT_BLOCK_RE = /<!--\s*archive:omit:start\s*-->[\s\S]*?<!--\s*archive:omit:end\s*-->/g;
const EMBED_RE = /!\[\[[^\]]+\]\]/g;
const WIKILINK_RE = /(?<!!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function normalizePath(path) {
  return path.replaceAll('\\', '/');
}

function walkMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(path));
    else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) out.push(path);
  }
  return out.sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function splitFrontmatter(text) {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: '', body: text };
  return { frontmatter: match[1], body: text.slice(match[0].length) };
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

function scalar(frontmatter, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = frontmatter.match(new RegExp(`^${escaped}:\\s*([^\\r\\n]*)$`, 'm'));
  return match ? unquote(match[1]) : undefined;
}

function list(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.match(new RegExp(`^${key}:\\s*(?:\\[\\])?\\s*$`)));
  if (start === -1) return [];
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s+-\s+(.+?)\s*$/);
    if (!match) break;
    values.push(unquote(match[1]));
  }
  return values;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function noteNames(note) {
  return unique([note.sourceBase, ...note.aliases]);
}

function readNote(file) {
  const sourcePath = normalizePath(relative(SRC, file));
  const text = readFileSync(file, 'utf8');
  const { frontmatter, body } = splitFrontmatter(text);
  const sourceBase = basename(file, extname(file));
  return {
    sourcePath,
    sourceBase,
    text,
    frontmatter,
    body,
    aliases: list(frontmatter, 'aliases'),
    published: scalar(frontmatter, 'publish') === 'true',
  };
}

function required(note, key) {
  const value = scalar(note.frontmatter, key);
  if (!value) throw new Error(`${note.sourcePath} 缺少必填字段 ${key}`);
  return value;
}

function validateArchivePath(note, value) {
  const path = normalizePath(value).replace(/^\/+|\/+$/g, '');
  if (!/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(path) || path.includes('..')) {
    throw new Error(`${note.sourcePath} 的 archive_path 非法：${value}`);
  }
  return path;
}

function transformedBody(note) {
  const startMarkers = note.body.match(/<!--\s*archive:omit:start\s*-->/g)?.length ?? 0;
  const endMarkers = note.body.match(/<!--\s*archive:omit:end\s*-->/g)?.length ?? 0;
  if (startMarkers !== endMarkers) {
    throw new Error(`${note.sourcePath} 的 archive:omit 标记未成对`);
  }

  let body = note.body.replace(OMIT_BLOCK_RE, '');
  body = body.replace(/^\s*<!--\s*oc-sync:.*?-->\s*$\r?\n?/gm, '');
  const strippedEmbeds = body.match(EMBED_RE)?.length ?? 0;
  body = body.replace(EMBED_RE, '');
  body = body.replace(/\n{4,}/g, '\n\n\n').trim();
  return { body: `${body}\n`, strippedEmbeds };
}

function compileNote(note) {
  const archivePath = validateArchivePath(note, required(note, 'archive_path'));
  const archiveSection = required(note, 'archive_section');
  const archiveSummary = required(note, 'archive_summary');
  const archiveOrderRaw = required(note, 'archive_order');
  const archiveOrder = Number.parseInt(archiveOrderRaw, 10);
  if (!Number.isInteger(archiveOrder) || String(archiveOrder) !== archiveOrderRaw) {
    throw new Error(`${note.sourcePath} 的 archive_order 必须是整数：${archiveOrderRaw}`);
  }

  const mood = scalar(note.frontmatter, 'mood') ?? 'calm';
  if (!MOODS.has(mood)) throw new Error(`${note.sourcePath} 使用了未知 mood：${mood}`);

  const h1 = note.body.match(/^#\s+(.+?)\r?$/m)?.[1]?.trim();
  const title = scalar(note.frontmatter, 'title') || h1 || note.sourceBase;
  const updated = required(note, 'updated');
  const aliases = unique([note.sourceBase, ...note.aliases]);
  const sourceHash = createHash('sha256').update(note.text).digest('hex').slice(0, 16);
  const { body, strippedEmbeds } = transformedBody(note);

  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    'aliases:',
    ...aliases.map((alias) => `  - ${yamlString(alias)}`),
    `mood: ${yamlString(mood)}`,
    `order: ${archiveOrder}`,
    `archive_path: ${yamlString(archivePath)}`,
    `archive_section: ${yamlString(archiveSection)}`,
    `archive_order: ${archiveOrder}`,
    `archive_summary: ${yamlString(archiveSummary)}`,
    'publish: true',
    `updated: ${yamlString(updated)}`,
  ];

  for (const key of ['type', 'status', 'canon']) {
    const value = scalar(note.frontmatter, key);
    if (value) lines.push(`${key}: ${yamlString(value)}`);
  }

  lines.push(
    `source_path: ${yamlString(note.sourcePath)}`,
    `source_hash: ${yamlString(sourceHash)}`,
    '---',
    '',
    '<!-- GENERATED FILE: edit the source note in oc-lian, then run npm run sync:archive. -->',
    '',
    body.trimEnd(),
    '',
  );

  return {
    archivePath,
    outputPath: `${archivePath}.md`,
    content: lines.join('\n'),
    strippedEmbeds,
  };
}

function readOutput(dir) {
  const files = new Map();
  if (!existsSync(dir)) return files;
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.set(normalizePath(relative(dir, path)), readFileSync(path, 'utf8'));
    }
  };
  visit(dir);
  return files;
}

function diffOutput(expected, actual) {
  const added = [];
  const updated = [];
  const deleted = [];
  for (const [path, content] of expected) {
    if (!actual.has(path)) added.push(path);
    else if (actual.get(path) !== content) updated.push(path);
  }
  for (const path of actual.keys()) {
    if (!expected.has(path)) deleted.push(path);
  }
  return { added, updated, deleted };
}

function printDiff(diff) {
  for (const path of diff.added) console.log(`  + ${path}`);
  for (const path of diff.updated) console.log(`  ~ ${path}`);
  for (const path of diff.deleted) console.log(`  - ${path}`);
  if (diff.added.length + diff.updated.length + diff.deleted.length === 0) {
    console.log('  = 公开档案已是最新状态');
  }
}

function writeOutput(dir, expected) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of expected) {
    const target = join(dir, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
}

function replaceDestination(expected) {
  rmSync(TEMP, { recursive: true, force: true });
  rmSync(BACKUP, { recursive: true, force: true });
  writeOutput(TEMP, expected);

  let backedUp = false;
  try {
    if (existsSync(DEST)) {
      renameSync(DEST, BACKUP);
      backedUp = true;
    }
    renameSync(TEMP, DEST);
    if (backedUp) rmSync(BACKUP, { recursive: true, force: true });
  } catch (error) {
    rmSync(TEMP, { recursive: true, force: true });
    if (!existsSync(DEST) && backedUp && existsSync(BACKUP)) renameSync(BACKUP, DEST);
    throw error;
  }
}

function main() {
  if (!existsSync(SRC)) throw new Error(`未找到 oc-lian 仓库：${SRC}`);

  const notes = walkMarkdown(SRC).map(readNote);
  const allNames = new Set(notes.flatMap(noteNames));
  const published = notes.filter((note) => note.published);
  if (published.length === 0 && !allowEmpty) {
    throw new Error('未找到 publish: true 的档案；为防误清空，已停止同步');
  }

  const publicNameOwners = new Map();
  for (const note of published) {
    for (const name of noteNames(note)) {
      if (publicNameOwners.has(name)) {
        throw new Error(`公开双链名称冲突：${name} 同时属于 ${publicNameOwners.get(name)} 与 ${note.sourcePath}`);
      }
      publicNameOwners.set(name, note.sourcePath);
    }
  }

  const privateTargets = new Set();
  for (const note of published) {
    const { body } = transformedBody(note);
    for (const match of body.matchAll(WIKILINK_RE)) {
      const target = match[1].split('#', 1)[0].trim();
      if (publicNameOwners.has(target)) continue;
      if (allNames.has(target)) privateTargets.add(target);
      else throw new Error(`${note.sourcePath} 含有无法解析的双链：[[${match[1]}]]`);
    }
  }

  const expected = new Map();
  let strippedEmbeds = 0;
  for (const note of published) {
    const compiled = compileNote(note);
    if (expected.has(compiled.outputPath)) {
      throw new Error(`archive_path 冲突：${compiled.archivePath}`);
    }
    expected.set(compiled.outputPath, compiled.content);
    strippedEmbeds += compiled.strippedEmbeds;
  }

  const actual = readOutput(DEST);
  const diff = diffOutput(expected, actual);
  console.log(`[sync-archive] 源：${SRC}`);
  console.log(`[sync-archive] 已选择 ${published.length} 篇公开档案；纯文本阶段剥离 ${strippedEmbeds} 个媒体嵌入`);
  if (privateTargets.size > 0) {
    console.log(`[sync-archive] ${privateTargets.size} 个双链目标尚未公开，将在网站显示为未解析文本：`);
    console.log(`  ${[...privateTargets].sort((a, b) => a.localeCompare(b, 'zh-CN')).join('、')}`);
  }
  printDiff(diff);

  const changed = diff.added.length + diff.updated.length + diff.deleted.length > 0;
  if (dryRun) return;
  if (checkOnly) {
    if (changed) {
      console.error('[sync-archive] 公开档案不是最新状态，请运行 npm run sync:archive。');
      process.exitCode = 1;
    }
    return;
  }
  if (!changed) return;

  replaceDestination(expected);
  console.log(`[sync-archive] 完成：安全替换 ${DEST}`);
}

try {
  main();
} catch (error) {
  console.error(`[sync-archive] 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
