---
title: Getting Started with Vibe Coding
date: 2026-08-27
tags:
  - LLM
  - VibeCoding
  - tutorial
mood: calm
description: Vibe coding 工具栈入门：Codex CLI、Claude Code、Pi、DeepSeek Harness 与 CC Switch 的选型、安装与第一个真实项目。所有命令与细节均已联网核验。
---

2025 年 2 月，Andrej Karpathy 发了一条推文，把一种新的编程方式命名为 **vibe coding**：不再逐行精写代码，而是用自然语言告诉 AI 你想要什么，顺着感觉迭代，直到跑通为止。一年半过去，这个半开玩笑的词已经变成了一套正经的工作流，围绕它长出了完整的工具生态。

这篇指南面向刚入坑的研究员，整理五件套工具栈：**Codex**、**Claude Code**、**Pi Agent**、**DeepSeek Harness**，以及管理它们配置的 **CC Switch**——怎么选、怎么装、怎么跑通第一个项目。

> **太长不看**
>
> - 手头有 ChatGPT 或 Claude 订阅 → 装 **Codex CLI** 或 **Claude Code**（Pi 也支持订阅直登），开箱即用，不用碰 API key
> - 预算有限、想用低价模型 → **Pi** 或 **DeepSeek Harness** 接 DeepSeek / Qwen / GLM / Kimi 等国产 API
> - 同时用多个工具或中转服务 → 加装 **CC Switch** 统一管理配置

## 工具栈总览

| 工具 | 一句话定位 | 适合谁 |
| --- | --- | --- |
| [Codex](https://github.com/openai/codex) | OpenAI 官方智能体：终端 CLI / IDE 扩展 / 云端 Web | ChatGPT 订阅用户，想开箱即用 |
| [Claude Code](https://code.claude.com/docs) | Anthropic 官方 Agent，终端 / IDE / 桌面 / Slack 全覆盖 | Claude 订阅用户，重度对话式开发 |
| [Pi Agent](https://pi.dev) | 极简、可扩展的开源 Agent 框架 | 想定制工作流、多模型混用、订阅直登 |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | 「万物皆插件」的开源 Agent，自带 Web UI | 想要可视化界面、深度自定义、低价模型 |
| [CC Switch](https://ccswitch.io) | 多工具 API 配置一键切换的桌面管家 | 多工具 / 多中转提供商用户 |

下面逐个展开。

## Codex：OpenAI 的官方编码智能体

Codex 不只是一个 CLI，而是一套多入口的智能体家族：**Codex CLI** 是开源（Apache-2.0）的终端智能体；**Codex IDE 扩展**可以直接装进 VS Code、Cursor、Windsurf，在编辑器里边写边派活；**Codex Web** 则是跑在云端的智能体——在 chatgpt.com/codex 上描述任务，它就在云端环境里自己拉仓库、跑测试、交回 diff。三种形态共用同一个 ChatGPT 账号，默认搭配 OpenAI 的前沿模型。

对 vibe coding 入门来说，CLI 是最顺手的起点。**安装**（macOS / Linux）：

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

Windows（PowerShell）：

```powershell
irm https://chatgpt.com/codex/install.ps1 | iex
```

也可以走包管理器：`npm install -g @openai/codex`，或 macOS 的 `brew install --cask codex`。装完运行 `codex` 启动交互会话，首次运行按提示登录 ChatGPT 账号（或设置 `OPENAI_API_KEY` 环境变量）。

进阶配置写在 `~/.codex/config.toml`（默认模型、审批策略等），完整字段见 [官方配置文档](https://developers.openai.com/codex/config-basic)。想在编辑器里用，去 [IDE 扩展页面](https://developers.openai.com/codex/ide) 安装；想让它在你睡觉时干活，打开 [chatgpt.com/codex](https://chatgpt.com/codex) 派个云端任务。

**亮点**：官方出品、登录即用；CLI 开源；终端 / IDE / 云端三形态一套账号。
**短板**：模型基本绑定 OpenAI 一家；深度定制空间有限。

## Claude Code：Anthropic 的生产级 Agent

Anthropic 的官方编码助手与 Agent 框架，从终端到 IDE、桌面应用、Slack 都有入口，内置循环上下文、技能（Skills）、MCP 等扩展机制，是目前最成熟的商用方案。

**安装**（macOS / Linux / WSL）：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Windows（PowerShell）：

```powershell
irm https://claude.ai/install.ps1 | iex
```

或 `npm install -g @anthropic-ai/claude-code`。安装后 `claude --version` 验证，首次运行 `claude` 会引导你登录 Anthropic 账号（Pro / Max / Team / Enterprise），也可以改用 `ANTHROPIC_API_KEY` 环境变量；模型在会话里用 `/model` 命令选择。

**亮点**：产品成熟度高；Skills / MCP 生态丰富；多环境一致体验。
**短板**：闭源、需订阅；对非 Claude 模型的支持有限。

## Pi Agent：极简可扩展的开源框架

Pi 是一个「内核极小、一切可插」的开源 Agent 框架（MIT 许可）：终端 TUI、Print/JSON、RPC、SDK 四种使用模式，扩展机制覆盖 Extensions、Skills、Prompt 模板。它原生接入多家模型提供商，还支持**会话中途切换模型**。

**安装**（需 Node.js ≥ 22.19）：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

启动方式极简——进入项目目录，敲 `pi`。

认证有两条路，对新手都很友好：

```text
/login    # 订阅登录：Claude Pro/Max、ChatGPT Plus/Pro（Codex）、GitHub Copilot 均可直接用
```

或走 API key：设置 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等环境变量。会话里用 `/model`（或 Ctrl+L）随时换模型。全局配置在 `~/.pi/agent/settings.json`，项目级配置在 `.pi/settings.json`。

**亮点**：MIT 开源；订阅直登免 API key；多模型、多模式；分支会话树等 TUI 特性。
**短板**：高级功能要自己拼插件；生态还在成长期，需要读文档的耐心。

## DeepSeek Harness（dsh）：万物皆插件

DeepSeek 官方在 2026 年 8 月开源的 Agent harness（MIT），发布两周即 198k stars。架构口号是「**Everything is a Plugin**」——模型适配器、工具、会话存储、沙箱、Agent 循环统统可以插件化替换，底层基于 [Cordis](https://github.com/cordiverse/cordis) 插件系统。

它目前处于**开发者预览**阶段，官方明说会有破坏性变更，追新需有心理准备。

**启动**（需 Node.js ≥ 22.19，或 24+）：

```bash
npx @deepseek-ai/dsh web
```

命令会拉起本地 Web UI（默认 `http://127.0.0.1:3080`）。想从源码构建：

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install && pnpm run build
pnpm dsh web
```

首次使用：**设置 → 模型** 填入 [DeepSeek API 密钥](https://platform.deepseek.com/)，保存即生效；密钥只写存储在 `$DSH_HOME/.credentials.yaml`，界面只显示脱敏描述符。模型页还支持添加 Anthropic、OpenAI、Bedrock、Vertex、Azure 等提供商，以及任意 OpenAI 兼容的自定义端点。然后**选择工作区**，就可以发第一条任务了——Agent 能读写文件、执行命令、委派工作并维护计划，敏感操作会先请求审批。

**亮点**：可视化 Web UI；插件化架构可玩性极高；DeepSeek 模型价格友好。
**短板**：开发者预览，稳定性与文档仍在打磨；上手需要理解插件体系。

## CC Switch：配置管理的桌面管家

用得多了，新的烦恼会出现：Claude Code 要一套 key，Codex 要一套，中转服务又要一套……CC Switch（开源，Tauri 构建）就是解决这个的：一个跨平台桌面应用，统一管理并一键切换 Claude Code、Claude Desktop、Codex、Gemini CLI、OpenCode 等工具的 API 提供商配置。

**安装**：去 [GitHub Releases](https://github.com/farion1231/cc-switch/releases/latest) 下载对应平台的安装包（Windows 有 MSI / Portable，macOS 有 zip）。macOS 首次打开可能遇到「未知开发者」提示，手动信任即可。

**用法**：在界面里添加供应商——可以从内置模板（官方 Anthropic、DeepSeek 等）选，也可以自定义 JSON，例如一个 OpenAI 兼容供应商：

```json
{
  "env": {
    "OPENAI_API_KEY": "your-openai-key",
    "OPENAI_BASE_URL": "https://api.openai.com"
  }
}
```

点「启用」后，配置会自动写入目标工具的对应配置文件，不用再手动改文件。注意它**只管理配置，不提供智能**——各工具本身得先装好。

## 前沿模型速览

工具是壳，模型才是干活的大脑。订阅制工具（Codex、Claude Code）绑定自家模型，选了工具等于选了模型；API-key 类工具（Pi、dsh）则可以自由搭配任何一家。截至本文写作（2026 年 8 月，信息均经联网核验），前沿格局大致如下。

**国际厂商：**

| 厂商 | 前沿模型 | 备注 |
| --- | --- | --- |
| OpenAI | GPT-5.6（含编码特化变体 Sol）、GPT-5.5 | ChatGPT 订阅即用；Codex 的默认搭档 |
| Anthropic | Claude Fable 5、Opus 5 / Sonnet 5 | Claude Code 的默认搭档；Opus 4.8 仍是常见基准参照 |
| Google | Gemini 3.1 Pro | 配套自家 Gemini CLI |

**国内厂商：**

| 厂商 | 前沿模型 | 备注 |
| --- | --- | --- |
| DeepSeek | V4（v4-pro / v4-flash） | 官方 API 定价厚道；dsh 的默认搭档 |
| 阿里 · 通义千问 | Qwen3.8（开放权重） | 首次将 Qwen-Max 级模型开源；配套 qwen-code CLI |
| 月之暗面 · Kimi | Kimi K3、K2.5 | K3：2.8T 参数、1M 上下文，世界首个开源 3T 级；配套 kimi-cli |
| 智谱 · GLM | GLM-5.3 / GLM-5.2 | 1M 上下文；开源阵营的编码强手，Z.ai 提供 API |

几条选型直觉：

- **订阅在手**：模型跟着订阅走，直接用默认的就是各家最强，不需要纠结。
- **按量付费**：国产 API 价格普遍显著低于海外旗舰，而编码能力已贴近第一梯队——个人项目性价比极高。
- **开放权重**是国产阵营的隐藏优势：可以自托管让数据不出内网，也能通过 OpenAI / Anthropic 兼容端点接进本文的任何工具——这正是 CC Switch 大显身手的地方。
- 这个领域半年一换代。本文核验于 2026 年 8 月，你读到这篇文章时，请顺手查一下各家最新发布。

## 快速上手：跑通第一个项目

工具再花哨，vibe coding 的核心循环始终是：**描述 → 生成 → 审查 → 迭代**。用一个最小的真实项目走一遍（以 Pi 为例，其他工具同理）：

**1. 建项目**

```bash
mkdir vibe-demo && cd vibe-demo
git init
```

**2. 写 AGENTS.md**

在项目根目录放一份 `AGENTS.md`，告诉 Agent 这个项目是什么、有什么约定。这是 Codex、Pi 等主流 Agent 共同遵守的事实标准：

```markdown
# vibe-demo

一个用来练习 vibe coding 的小项目。

- Node.js ≥ 22，TypeScript
- 运行 npm test 跑测试
- 提交信息用中文，一句话说清改动
```

**3. 启动 Agent**

```bash
pi          # 首次先 /login 或设好环境变量
```

Codex / Claude Code 用户对应 `codex` / `claude`；dsh 用户则是 `npx @deepseek-ai/dsh web`，在 Web UI 里把这个目录添加为工作区。

**4. 描述任务，然后审查**

直接用中文说需求：

> 帮我写一个 CLI 小工具：输入一个 GitHub 仓库名，拉取它的 star 数并打印。带测试。

Agent 会自己建文件、装依赖、跑测试。它改完的每个文件你都过一眼 diff 再提交——**审查是 vibe coding 里唯一不能省的人工序**。不对就继续说，改到满意为止。

这个循环跑顺了，剩下的都只是换工具换模型的排列组合。

## API Key 与配置速查

| 工具 | 认证方式 | 配置位置 |
| --- | --- | --- |
| Codex（CLI） | ChatGPT 登录 / `OPENAI_API_KEY` | `~/.codex/auth.json`、`~/.codex/config.toml` |
| Claude Code | 订阅登录 / `ANTHROPIC_API_KEY`（中转加 `ANTHROPIC_BASE_URL`） | `~/.claude/` |
| Pi | `/login` 订阅直登 / 各家 API key 环境变量 | `~/.pi/agent/settings.json`、`.pi/settings.json` |
| dsh | Web UI 里填 key | `$DSH_HOME/.credentials.yaml`、`$DSH_HOME/settings.yaml` |
| CC Switch | 界面里添加供应商 | 自动写入各工具的配置文件 |

几条安全守则：

- **key 永远不进代码库**——用环境变量或各工具的凭据文件，`.gitignore` 检查一遍
- **中转服务要看清数据流向**——你的代码会流经它，选有口碑、可审计的服务
- **敏感信息不进 prompt**——数据库密码、内部数据，能不给就不给
- dsh 的第三方插件本质是任意代码，装之前看一眼源码和作者

## 常见问题排查

- **登录失败 / 401 / 403**：key 填错或过期，重新登录；用了中转的话，检查端点 URL 与 key 是否配套。
- **切换模型不生效**：多数工具切换提供商后需要重启会话，Claude Code 尤其如此。
- **模型列表拉取失败**：CC Switch 调 `/v1/models` 报 404 / 405，说明上游没提供这个端点，手动填模型名即可；403 则是 key 权限问题。
- **装不上 / 跑不起来**：先查 Node 版本——Pi 和 dsh 都要求 **22.19+**，这是新手最常见的坑；WSL 下用 Codex 记得装 Git for Windows 的 Bash 支持。
- **输出乱码或格式异常**：中转 + 协议转换（Anthropic ↔ OpenAI 格式）时，在 CC Switch 里确认供应商的 API 格式选对了。

## 进阶路线

入门之后值得探索的方向：

- **Claude Code 的 Skills 与 MCP**：把常用流程封装成可复用的能力，接外部数据源。
- **Pi 的 Extensions / Skills 开发**：官方文档有完整指南，适合想深度定制 Agent 行为的人。
- **dsh 插件开发**：从官方的插件开发文档入手，理解「万物皆插件」的架构。
- **多模型混合工作流**：比如一个模型出草稿、另一个模型做审查——用 Pi 的会话中切模型或 dsh 的自定义循环都能实现。
- **社区**：各项目的 GitHub Discussions / Discord 都很活跃，dsh 的插件仓库可以挂 `dsh-plugin` topic 方便被找到。

## 延伸阅读

- [Codex CLI 仓库与文档](https://github.com/openai/codex)（配置参考在 developers.openai.com/codex）
- [Claude Code 官方文档](https://code.claude.com/docs)
- [Pi 官网](https://pi.dev) 与 [GitHub 仓库](https://github.com/earendil-works/pi)
- [DeepSeek Harness 仓库](https://github.com/deepseek-ai/deepseek-harness) 与 [官网页面](https://deepseek.com/harness)
- [CC Switch 官网](https://ccswitch.io) 与 [文档](https://github.com/farion1231/cc-switch/tree/main/docs)

---

*本文初稿由 ChatGPT 深度研究产出；发布前对全部安装命令、版本要求、项目事实与前沿模型信息做了联网核验，并修正了初稿中的若干失实细节。*
