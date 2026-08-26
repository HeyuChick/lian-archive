#!/usr/bin/env python3
"""
sync_archive.py —— 将 Obsidian vault 中的档案同步到网站内容集合

用法：
    py tools/sync_archive.py <vault档案目录> [--push]

示例：
    py tools/sync_archive.py "D:/Notes/涟/档案馆"
    py tools/sync_archive.py "D:/Notes/涟/档案馆" --push   # 同步后自动 git 提交并推送

做的事：
  1. 递归扫描 vault 目录下的 .md 文件（跳过隐藏目录与 _ 开头的模板文件）
  2. 剥离 oc-sync 同步标记注释（<!-- oc-sync:... --> 整行）
  3. 补全 frontmatter（不覆盖已有字段）：
       title   —— 从正文第一个 H1 提取，无则用文件名
       order   —— 从文件名前导数字提取（01_xxx.md → 1），无则 0
       mood    —— 默认 calm
       publish —— 默认 true；在 vault 里写 publish: false 可不上线
  4. 保持文件夹结构写入 src/content/archive/

vault 里的 frontmatter 原样保留（type/character/tags 等字段在构建时会被 schema 自动剥离）。
URL 即文件路径：01_设定/01_基础信息.md → /archive/01_设定/01_基础信息/
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = REPO_ROOT / "src" / "content" / "archive"

OC_SYNC_RE = re.compile(r"^\s*<!--\s*oc-sync:.*?-->\s*$\n?", re.MULTILINE)
FM_RE = re.compile(r"^---\n([\s\S]*?)\n---\n?")
H1_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
ORDER_RE = re.compile(r"^(\d+)")


def split_frontmatter(text: str) -> tuple[str, str]:
    m = FM_RE.match(text)
    if m:
        return m.group(1), text[m.end():]
    return "", text


def fm_has(fm: str, key: str) -> bool:
    return re.search(rf"^{re.escape(key)}\s*:", fm, re.MULTILINE) is not None


def convert(src: Path, rel: Path) -> str:
    text = src.read_text(encoding="utf-8")
    text = OC_SYNC_RE.sub("", text)

    fm, body = split_frontmatter(text)

    additions: list[str] = []
    if not fm_has(fm, "title"):
        h1 = H1_RE.search(body)
        title = h1.group(1).strip() if h1 else rel.stem
        additions.append(f'title: "{title}"')
    if not fm_has(fm, "order"):
        m = ORDER_RE.match(rel.stem)
        additions.append(f"order: {int(m.group(1)) if m else 0}")
    if not fm_has(fm, "mood"):
        additions.append("mood: calm")
    if not fm_has(fm, "publish"):
        additions.append("publish: true")

    fm_out = (fm.rstrip() + "\n" + "\n".join(additions)).strip("\n")
    return f"---\n{fm_out}\n---\n{body}"


def main() -> int:
    ap = argparse.ArgumentParser(description="同步 Obsidian 档案到网站内容集合")
    ap.add_argument("vault", help="vault 中档案根目录的路径")
    ap.add_argument("--push", action="store_true", help="同步后自动 git add/commit/push")
    args = ap.parse_args()

    vault = Path(args.vault)
    if not vault.is_dir():
        print(f"!! vault 目录不存在: {vault}")
        return 1

    sources = [
        p for p in sorted(vault.rglob("*.md"))
        if not any(part.startswith(".") for part in p.relative_to(vault).parts)
        and not p.stem.startswith("_")
    ]
    if not sources:
        print("!! 未找到任何 .md 文件")
        return 1

    added = updated = unchanged = 0
    for src in sources:
        rel = src.relative_to(vault)
        dest = CONTENT_DIR / rel
        out = convert(src, rel)

        if dest.exists() and dest.read_text(encoding="utf-8") == out:
            unchanged += 1
            continue
        existed = dest.exists()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(out, encoding="utf-8")
        if existed:
            updated += 1
            print(f"  ~ {rel}")
        else:
            added += 1
            print(f"  + {rel}")

    print(f"\n同步完成：新增 {added} / 更新 {updated} / 不变 {unchanged}")

    if args.push:
        subprocess.run(["git", "add", "src/content/archive"], cwd=REPO_ROOT, check=True)
        subprocess.run(["git", "commit", "-m", "content: 同步档案馆"], cwd=REPO_ROOT, check=True)
        subprocess.run(["git", "push"], cwd=REPO_ROOT, check=True)
        print("已提交并推送，Pages 将自动构建。")
    else:
        print("检查无误后：git add src/content/archive && git commit -m 'content: 同步档案馆' && git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
