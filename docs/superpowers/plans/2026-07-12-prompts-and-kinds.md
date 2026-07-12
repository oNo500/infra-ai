# prompts 分层与类别注册表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-07-12-prompts-and-kinds-design.md`，文档层重组为 `meta/prompts/`（6 份 AI 行为契约）+ `meta/README.md`（人读一页），CLI 类别知识收拢进 `src/core/kinds.ts` 注册表，writeback 指令从代码搬进文档。

**Architecture:** 三步走保证中间态可用：先新增新文档（不删旧）→ 再切代码指针（kinds.ts + meta.ts/claude.ts 消费改造）→ 最后退役旧文档并同步引用。行为全程不变（落点、白名单、校验语义同前），变的只是知识的安放位置。

**Tech Stack:** 既有栈，无新依赖。

## Global Constraints

- 包管理 pnpm；运行与测试 bun（`bun test` 于 `packages/meta-cli/`）
- 源代码禁止 emoji；禁止 `@ts-ignore`；禁止双重断言；禁止 `!` 非空断言；文件名 kebab-case
- commit message 英文，Conventional Commits
- 每任务提交前：full `bun test` + `pnpm --filter @infra-ai/meta-cli typecheck` + `pnpm --filter @infra-ai/meta-cli lint`（零 warning）
- prompt 文档写作红线（spec Decision 1）：只写 AI 该做的；禁止出现流程步骤（触发方式、上账、外壳的 verify/record 职责）；正文以中文为主，术语、命令、代码与标识保留英文
- 行为不变红线：产物落点、allowedTools 白名单串、verifyBuild 语义、buildOne 链全程与现状一致——本计划是知识重组，不是行为变更
- `.claude/` 下的 tracked 文件提交需 `git add -f`（全局 gitignore 覆盖）；不动未跟踪的 `.vscode/`

---

### Task 1: 新建 meta/prompts/ 六份与 meta/README.md（不删旧）

**Files:**
- Create: `meta/prompts/rule-build.md`、`meta/prompts/rule-writeback.md`、`meta/prompts/skill-build.md`、`meta/prompts/skill-writeback.md`、`meta/prompts/template-build.md`、`meta/prompts/template-writeback.md`
- Create: `meta/README.md`

**Interfaces:**
- Consumes: 源材料原文——`meta/build/rule.md`、`meta/build/skill.md`、`meta/build/template.md`、`templates/rule.md`（决策清单全文）、`templates/skill.md`（核实步骤与自建结构节）、`packages/meta-cli/src/core/claude.ts` 的 `writebackPromptFor` 三行指令
- Produces: 六份 prompt 文档路径（Task 2 的 kinds.ts 逐字引用）与 README

- [ ] **Step 1: 写 rule-build.md**

`meta/prompts/rule-build.md` 全文：

```markdown
# rule 构建

你在为本仓构建一条 rule 产物：输入是任务指令给出的元指令文件，输出是一个
markdown 文件。读完本文件与元指令后再动笔。

## 步骤

1. 读元指令，理解意图、约束与素材
2. 过下方检查清单，确认该不该独立成文、要不要 `paths`
3. 按元指令的 `scope` 决定落点与 frontmatter：
   - `scope: global` — 产物落 `rules/global/<name>.md`，不写 `paths`
   - `scope: "<glob>"` — 产物落 `rules/scoped/<name>.md`，glob 写进产物的
     `paths` frontmatter
4. 写产物。只写产物这一个文件，不修改其他文件，不提交

## 检查清单

[并入 `templates/rule.md` 的「该不该拆成独立文件」「要不要加 `paths`
frontmatter」「写之前」三节原文，逐字搬运；「写完之后」一节不并入——
那是外壳与人的职责]

## 写法要求

- `global/` 产物无条件进上下文：必须精简、姿态化，每主题一文件，
  每个字都占上下文预算
- `scoped/` 产物按 glob 触发加载：允许更细更长
- 正文以中文为主；术语、命令、代码与标识保留英文
```

- [ ] **Step 2: 写 rule-writeback.md**

`meta/prompts/rule-writeback.md` 全文：

```markdown
# rule 回写

产物相对上次构建被直接修改过。你的任务：把产物中元指令未覆盖的有价值内容
回写进元指令，使下次重建不丢失这些修改。

## 要求

- 对照元指令与产物，识别产物中新增或变更的实质内容
- 回写进元指令正文；元指令是意图层，用意图与约束的语言表述，
  不是照抄产物文本
- 保持元指令 frontmatter 不变
- 只修改元指令这一个文件；不改产物，不提交
- 正文以中文为主；术语、命令、代码与标识保留英文
```

- [ ] **Step 3: 写 skill-build.md**

`meta/prompts/skill-build.md` 全文：

```markdown
# skill 构建

你在为本仓构建一个 Claude Code skill：输入是任务指令给出的元指令文件，
输出是 `skills/<name>/SKILL.md`（必要时含 `assets/`、`references/`）。

## 步骤

1. 读元指令，理解目标、约束与素材
2. 核实上游是否已有同类，避免重复造：
   WebFetch `https://ungh.cc/repos/anthropics/claude-plugins-official/files/main`
   （免认证，返回全量文件树），筛 `plugins/*/skills/*` 与 `external_plugins/*`
   下的同名或同用途 skill。命中同类：不要生成产物，在最终回复里说明命中的
   插件名，由人决定是否改记 official
3. 未命中则生成产物，遵循 skills.sh 标准与
   [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
4. 产物一律落仓库根 `skills/<name>/`；元指令里写了别的路径（如
   `~/.claude/skills/`），以本文件为准修正
5. 只写产物目录内的文件，不修改其他文件，不提交

## SKILL.md 契约

- frontmatter `name` 必须等于目录名
- frontmatter `description` 用英文、第三人称，包含触发词与示例场景——
  它是 Claude 自动调用的匹配依据，必须具体到无歧义
- 正文以中文为主；术语、type 名、命令、代码与标识保留英文
- `description` 之外若需扩展材料，放 `assets/`（执行时填充的模板）与
  `references/`（填充指南），SKILL.md 保持精炼入口
```

- [ ] **Step 4: 写 skill-writeback.md**

`meta/prompts/skill-writeback.md` 全文：

```markdown
# skill 回写

产物相对上次构建被直接修改过。你的任务：把产物中元指令未覆盖的有价值内容
回写进元指令，使下次重建不丢失这些修改。

## 要求

- 对照元指令与产物（`skills/<name>/` 全部文件），识别新增或变更的实质内容
- 回写进元指令正文；元指令是意图层，用意图与约束的语言表述，
  不是照抄 SKILL.md 文本
- 保持元指令 frontmatter 不变
- 只修改元指令这一个文件；不改产物，不提交
- 正文以中文为主；术语、type 名、命令、代码与标识保留英文
```

- [ ] **Step 5: 写 template-build.md**

`meta/prompts/template-build.md` 全文：

```markdown
# template 构建

你在为本仓构建一份项目模板：输入是任务指令给出的元指令文件，输出是
`templates/<name>.md`。模板的完成态是「半成品」——分发时才结合目标项目
实例化。

## 步骤

1. 读元指令，理解模板用途、必须覆盖的板块与占位符原则
2. 生成产物，保留 `[ALL_CAPS]` 形式的占位符
3. 只写产物这一个文件，不修改其他文件，不提交

## 写法要求

- 占位符只留项目之间真正会变的部分；所有项目都一样的内容直接写死
- 正文以中文为主；术语、命令、代码与标识保留英文
```

- [ ] **Step 6: 写 template-writeback.md**

`meta/prompts/template-writeback.md` 全文：

```markdown
# template 回写

产物相对上次构建被直接修改过。你的任务：把产物中元指令未覆盖的有价值内容
回写进元指令，使下次重建不丢失这些修改。

## 要求

- 对照元指令与产物，识别新增或变更的实质内容（含占位符的增减）
- 回写进元指令正文；元指令是意图层，用意图与约束的语言表述
- 保持元指令 frontmatter 不变；产物中的 `[ALL_CAPS]` 占位符语义
  在元指令里以「占位符原则」表述
- 只修改元指令这一个文件；不改产物，不提交
- 正文以中文为主；术语、命令、代码与标识保留英文
```

- [ ] **Step 7: 写 meta/README.md**

`meta/README.md` 全文：

```markdown
# meta/ — 意图源与 prompt

- `prompts/` — 每类资产两份 AI 行为契约（`<类>-build.md`、`<类>-writeback.md`），
  headless 构建与回写时由 imeta 指针引用；只写 AI 该做的
- `rules/`、`skills/`、`templates/` — 意图源，一资产一份，永久保留

## 元指令格式

```yaml
---
name: <产物名，与文件名一致，小写连字符>
target: rule | skill | template
status: stub | ready
scope: global | "<glob>"        # 仅 rule
---
```

- `stub` — 意图占位，内容待补全，禁止构建
- `ready` — 规格完整，可构建

正文写意图与要求：目标、约束、示例，可附内容素材。元指令没有终态，
产物存在与否看目标位置与 `artifacts.lock.json`。

## 新增资产

1. 在 `meta/<类>/<name>.md` 写元指令（`stub` 起步）
2. 补全为 `ready` 后 `imeta build <name>`（或 TUI 选中按 `b`）

流程细节看 `imeta --help` 与 run log（`.imeta/logs/`）；回写与分发纪律见
`.claude/rules/architecture.md`。
```

- [ ] **Step 8: 校验并提交**

检查每份 prompt 文档不含流程词（自查红线）：

```bash
grep -rn '上账\|imeta\|TUI\|触发\|make ' meta/prompts/ ; echo "---期望无输出（README 不在此列）---"
git add meta/prompts meta/README.md
git commit -m "feat(meta): add per-kind AI prompt contracts and human README"
```

（此时旧文档仍在、代码仍指向 `meta/build/`，仓库全程可用。）

---

### Task 2: kinds.ts 类别注册表与消费改造

**Files:**
- Create: `packages/meta-cli/src/core/kinds.ts`
- Modify: `packages/meta-cli/src/core/meta.ts`（KIND_DIR/artifactPathFor/discoverAssets 消费注册表；AssetKind 移居 kinds.ts 后 re-export）
- Modify: `packages/meta-cli/src/core/claude.ts`（BUILD_RULE 删除、prompt 指针、allowedToolsFor、verifyBuild 消费注册表）
- Test: `packages/meta-cli/tests/kinds.test.ts`（新增）、`packages/meta-cli/tests/claude.test.ts`（prompt 路径断言更新）

**Interfaces:**
- Consumes: Task 1 的六份 prompt 文档路径
- Produces（Task 3 与后续扩展依赖）:

```ts
// kinds.ts
export type AssetKind = 'rule' | 'skill' | 'template'
export interface KindDef {
  metaDir: string
  artifactPath: (name: string, scope: string | null) => string
  buildPrompt: string
  writebackPrompt: string
  writableGlob: (name: string) => string
  extraAllowedTools: readonly string[]
  verifyArtifact: (repoRoot: string, asset: { name: string; artifactPath: string }) => string | null
}
export const KIND_ORDER: readonly AssetKind[]
export const KINDS: Record<AssetKind, KindDef>
```

- `meta.ts` 继续导出 `AssetKind`（`export type { AssetKind } from './kinds'`）、`MetaAsset`、`artifactPathFor`（薄包装，签名不变）——既有 import 方不动
- `claude.ts` 对外签名全部不变（`buildPromptFor`/`writebackPromptFor`/`allowedToolsFor`/`verifyBuild`）

- [ ] **Step 1: 写失败测试**

`packages/meta-cli/tests/kinds.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { KINDS, KIND_ORDER } from '../src/core/kinds'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..')

describe('kind registry', () => {
  test('covers all kinds in stable order', () => {
    expect(KIND_ORDER).toEqual(['rule', 'skill', 'template'])
    expect(Object.keys(KINDS).toSorted()).toEqual(['rule', 'skill', 'template'])
  })
  test('prompt documents referenced by the registry exist in the repo', () => {
    for (const kind of KIND_ORDER) {
      expect(existsSync(join(REPO_ROOT, KINDS[kind].buildPrompt)), KINDS[kind].buildPrompt).toBe(true)
      expect(existsSync(join(REPO_ROOT, KINDS[kind].writebackPrompt)), KINDS[kind].writebackPrompt).toBe(true)
    }
  })
  test('artifact paths and sandbox globs match established contracts', () => {
    expect(KINDS.rule.artifactPath('constitution', 'global')).toBe('rules/global/constitution.md')
    expect(KINDS.rule.artifactPath('api', 'src/api/**')).toBe('rules/scoped/api.md')
    expect(KINDS.rule.artifactPath('python', null)).toBe('rules/global/python.md')
    expect(KINDS.skill.artifactPath('commit-lite', null)).toBe('skills/commit-lite/SKILL.md')
    expect(KINDS.template.artifactPath('architecture', null)).toBe('templates/architecture.md')
    expect(KINDS.rule.writableGlob('constitution')).toBe('rules/**')
    expect(KINDS.skill.writableGlob('commit-lite')).toBe('skills/commit-lite/**')
    expect(KINDS.template.writableGlob('architecture')).toBe('templates/**')
    expect(KINDS.skill.extraAllowedTools).toEqual(['WebFetch(domain:ungh.cc)'])
    expect(KINDS.rule.extraAllowedTools).toEqual([])
    expect(KINDS.template.extraAllowedTools).toEqual([])
  })
})
```

`packages/meta-cli/tests/claude.test.ts` 的 prompts describe 两处断言更新：

```ts
  test('build prompt references meta path, prompt doc, artifact path', () => {
    const p = buildPromptFor(ruleAsset)
    expect(p).toContain('meta/rules/constitution.md')
    expect(p).toContain('meta/prompts/rule-build.md')
    expect(p).toContain('rules/global/constitution.md')
  })
  test('writeback prompt is a pointer to the writeback doc', () => {
    const p = writebackPromptFor(ruleAsset)
    expect(p).toContain('meta/rules/constitution.md')
    expect(p).toContain('meta/prompts/rule-writeback.md')
    expect(p).toContain('不要改产物')
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd packages/meta-cli && bun test tests/kinds.test.ts tests/claude.test.ts
```

期望：kinds 模块不存在 FAIL；claude prompts 两条 FAIL（仍指 meta/build）。

- [ ] **Step 3: 实现 kinds.ts**

`packages/meta-cli/src/core/kinds.ts`：

```ts
import { join } from 'node:path'
import matter from 'gray-matter'
import { readTextIfExists } from './io'

export type AssetKind = 'rule' | 'skill' | 'template'

export interface KindDef {
  metaDir: string
  artifactPath: (name: string, scope: string | null) => string
  buildPrompt: string
  writebackPrompt: string
  writableGlob: (name: string) => string
  extraAllowedTools: readonly string[]
  verifyArtifact: (repoRoot: string, asset: { name: string; artifactPath: string }) => string | null
}

export const KIND_ORDER: readonly AssetKind[] = ['rule', 'skill', 'template']

const noExtraVerify = () => null

export const KINDS: Record<AssetKind, KindDef> = {
  rule: {
    metaDir: 'meta/rules',
    artifactPath: (name, scope) => {
      const sub = scope !== null && scope !== 'global' ? 'scoped' : 'global'
      return `rules/${sub}/${name}.md`
    },
    buildPrompt: 'meta/prompts/rule-build.md',
    writebackPrompt: 'meta/prompts/rule-writeback.md',
    writableGlob: () => 'rules/**',
    extraAllowedTools: [],
    verifyArtifact: noExtraVerify,
  },
  skill: {
    metaDir: 'meta/skills',
    artifactPath: (name) => `skills/${name}/SKILL.md`,
    buildPrompt: 'meta/prompts/skill-build.md',
    writebackPrompt: 'meta/prompts/skill-writeback.md',
    writableGlob: (name) => `skills/${name}/**`,
    extraAllowedTools: ['WebFetch(domain:ungh.cc)'],
    verifyArtifact: (repoRoot, asset) => {
      const content = readTextIfExists(join(repoRoot, asset.artifactPath))
      if (content === null) return null // 存在性由通用校验负责
      try {
        const { data } = matter(content)
        if (data.name !== asset.name) {
          return `SKILL.md frontmatter name '${String(data.name)}' != '${asset.name}'`
        }
      } catch (error) {
        return `SKILL.md frontmatter unparseable: ${String(error)}`
      }
      return null
    },
  },
  template: {
    metaDir: 'meta/templates',
    artifactPath: (name) => `templates/${name}.md`,
    buildPrompt: 'meta/prompts/template-build.md',
    writebackPrompt: 'meta/prompts/template-writeback.md',
    writableGlob: () => 'templates/**',
    extraAllowedTools: [],
    verifyArtifact: noExtraVerify,
  },
}
```

- [ ] **Step 4: meta.ts 消费改造**

`packages/meta-cli/src/core/meta.ts`：

- 删除本地 `export type AssetKind = ...`、`KIND_DIR`、`KIND_ORDER` 定义
- 顶部 `import { KINDS, KIND_ORDER } from './kinds'`、
  `import type { AssetKind } from './kinds'`，并 `export type { AssetKind } from './kinds'`
- `artifactPathFor` 改薄包装（签名不变，测试不动）：

```ts
export function artifactPathFor(kind: AssetKind, name: string, scope: string | null): string {
  return KINDS[kind].artifactPath(name, scope)
}
```

- `parseMetaFile` 中 `metaPath` 拼接改用注册表：
  `` metaPath: `${KINDS[kind].metaDir}/${filename}` ``
- `discoverAssets` 的目录遍历改：`const dir = join(repoRoot, KINDS[kind].metaDir)`
  （循环仍用 `KIND_ORDER`）

- [ ] **Step 5: claude.ts 消费改造**

`packages/meta-cli/src/core/claude.ts`：

- 删除 `BUILD_RULE` 常量；`import { KINDS } from './kinds'`；
  `dirname` import 若不再使用则删除
- 三个函数改为：

```ts
export function buildPromptFor(asset: MetaAsset): string {
  return [
    `构建 ${asset.metaPath}，遵循 ${KINDS[asset.kind].buildPrompt} 的构建规则。`,
    `产物写入 ${asset.artifactPath}。不要修改其他文件，不要提交。`,
  ].join('\n')
}

export function writebackPromptFor(asset: MetaAsset): string {
  return [
    `产物 ${asset.artifactPath} 相对上次构建被直接修改过。`,
    `回写 ${asset.metaPath}，遵循 ${KINDS[asset.kind].writebackPrompt} 的回写规则。`,
    `只修改 ${asset.metaPath}，不要改产物，不要提交。`,
  ].join('\n')
}

export function allowedToolsFor(asset: MetaAsset, mode: 'build' | 'writeback'): string {
  const writable = mode === 'writeback' ? asset.metaPath : KINDS[asset.kind].writableGlob(asset.name)
  const extras =
    mode === 'build' && KINDS[asset.kind].extraAllowedTools.length > 0
      ? `,${KINDS[asset.kind].extraAllowedTools.join(',')}`
      : ''
  return `Read,Glob,Grep,Write(${writable}),Edit(${writable})${extras}`
}
```

- `verifyBuild` 改为通用校验 + 注册表扩展：

```ts
export function verifyBuild(repoRoot: string, asset: MetaAsset): string | null {
  const content = readTextIfExists(join(repoRoot, asset.artifactPath))
  if (content === null) return `artifact missing: ${asset.artifactPath}`
  if (content.trim() === '') return `artifact empty: ${asset.artifactPath}`
  return KINDS[asset.kind].verifyArtifact(repoRoot, asset)
}
```

（skill 的 frontmatter 校验逻辑随之从此处删除，`matter`/`gray-matter` import
若不再使用则删除。）

- [ ] **Step 6: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
cd /Users/xiu/code/infra-ai && imeta status   # 期望: 资产列表与改造前一致
git add packages/meta-cli
git commit -m "refactor(meta-cli): consolidate kind knowledge into a registry

Kind contracts (meta dir, artifact path, prompt docs, sandbox globs,
extra verification) now live in one kinds.ts entry per kind. Prompt
pointers move to meta/prompts/; the writeback instruction body leaves
code for its prompt document."
```

---

### Task 3: 退役旧文档与引用同步

**Files:**
- Delete: `meta/build/rule.md`、`meta/build/skill.md`、`meta/build/template.md`（目录随空删除）、`templates/rule.md`、`templates/skill.md`
- Modify: `.claude/CLAUDE.md`、`.claude/rules/architecture.md`、`README.md`、`SKILLS.md`
- Modify: `meta/skills/commit-lite.md`（引用 `meta/build/skill.md` 处）

**Interfaces:**
- Consumes: Task 1 文档、Task 2 指针已切换（旧文档已无消费方）

- [ ] **Step 1: 确认无代码引用后删除**

```bash
grep -rn 'meta/build\|templates/rule\.md\|templates/skill\.md' packages/meta-cli/src packages/meta-cli/tests ; echo "---期望无输出---"
git rm meta/build/rule.md meta/build/skill.md meta/build/template.md templates/rule.md templates/skill.md
```

- [ ] **Step 2: 引用同步**

- `.claude/CLAUDE.md` 新增资产第 2 步末尾 `——构建与分发规则见 \`meta/build/<类>.md\``
  改为 `——AI 构建契约见 \`meta/prompts/\`，格式说明见 \`meta/README.md\``
- `.claude/rules/architecture.md`：
  - Project Structure 树中 `│   ├── build/                 # 构建规则，每类产物一份（rule.md、skill.md、template.md）`
    替换为两行：
    `│   ├── prompts/               # AI 行为契约，每类两份（<类>-build.md、<类>-writeback.md）`
    `│   ├── README.md              # 元指令格式与新增资产说明`
  - 「源→产物模型」中 `- 构建与分发规则在 \`meta/build/\`，每类产物一份`
    改为 `- AI 构建/回写契约在 \`meta/prompts/\`，每类两份；流程的 SSoT 是
    \`packages/meta-cli/src/core/actions.ts\`（imeta --help 与 run log 即流程文档）`
- `README.md` 内容清单里 `构建规则在 [\`meta/build/\`](meta/build/)，每类产物一份`
  改为 `AI 构建契约在 [\`meta/prompts/\`](meta/prompts/)，每类两份（build/writeback）`
- `SKILLS.md` 创建节 `元指令格式、构建规则、回写纪律见 [\`meta/build/skill.md\`](meta/build/skill.md)`
  改为 `元指令格式见 [\`meta/README.md\`](meta/README.md)，AI 构建契约见
  [\`meta/prompts/skill-build.md\`](meta/prompts/skill-build.md)`
- `meta/skills/commit-lite.md` 若残留 `meta/build` 字样同步替换为对应新路径

```bash
grep -rn 'meta/build\|templates/rule\.md\|templates/skill\.md' --include='*.md' . --exclude-dir={node_modules,docs,.superpowers,.imeta} ; echo "---期望无输出（docs/ 历史记录除外，不改）---"
```

- [ ] **Step 3: 全量验证（含一次真实构建）**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
cd /Users/xiu/code/infra-ai && imeta build commit-lite; echo "exit=$?"
```

期望：构建成功退 0；查最新 run log：

```bash
LOG=.imeta/logs/$(ls -t .imeta/logs | head -1)
jq -r 'select(.step=="claude:event") | .event.message.content[]? | select(.type=="tool_use") | .name + " " + (.input.file_path // .input.url // "" | tostring)' "$LOG" | head -8
```

期望：可见 `Read …meta/prompts/skill-build.md`；不出现对 `meta/build/` 的读取；
（skill 无上游同类时可见 ungh 的 WebFetch）。构建产物若与上版一致，
`artifacts.lock.json` 仅 builtAt 变化，一并提交。

- [ ] **Step 4: 提交**

```bash
git add -A -- meta templates README.md SKILLS.md artifacts.lock.json skills/commit-lite
git add -f .claude/CLAUDE.md .claude/rules/architecture.md
git commit -m "refactor(meta)!: retire meta/build and template checklists for meta/prompts

Workflow prose leaves the docs: the CLI is the workflow SSoT. Internal
checklists that lived in templates/ merge into their build prompts."
```

---

## Self-Review 记录

- Spec 覆盖：Decision 1（Task 1 六份 prompt + README，写作红线进 Global Constraints 与 Task 1 Step 8 自查）、2（Task 3 引用同步中写明 actions.ts 是流程 SSoT）、3（Task 2 kinds.ts 全字段）、4（Task 2 Step 5 指针化 writeback）、5（Task 1 分拣：检查清单并入 rule-build、核实步骤并入 skill-build、writeback 三行进 writeback 文档、元指令格式进 README、流程删除、分发/纪律留 architecture.md）、6（Task 3 删 templates/{rule,skill}.md）、7（Task 3 Step 2）；Testing（kinds.test 含 prompt 文件存在性守卫、claude.test 断言更新、Task 3 真实构建验收）。
- 类型一致性：`AssetKind` 移居 kinds.ts 并经 meta.ts re-export，全部既有 import 方不需改动；`artifactPathFor` 薄包装保签名；`KindDef` 各字段在测试与实现间一致。
- 行为不变核对：落点（artifactPath 逻辑逐字搬运）、白名单串（writableGlob/extraAllowedTools 组合结果与现字符串一致，claude.test 既有断言不改即是回归证明）、verifyBuild 语义（通用两查 + skill frontmatter 查，顺序一致）。
