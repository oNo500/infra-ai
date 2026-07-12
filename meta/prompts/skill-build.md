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
