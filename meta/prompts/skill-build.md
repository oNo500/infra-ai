# skill 构建

你在为本仓构建一个 Claude Code skill：输入是任务指令给出的元指令文件，
输出是 `skills/<name>/SKILL.md`（必要时含 `assets/`、`references/`）。

同名查重已在你启动前由外壳完成——走到这里说明官方目录没有同名 skill，直接生成即可。

## 步骤

1. 读元指令，理解目标、约束与素材
2. 生成产物，遵循 skills.sh 标准与
   [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
3. 产物一律落仓库根 `skills/<name>/`；元指令里写了别的路径（如
   `~/.claude/skills/`），以本文件为准修正
4. 只写产物目录内的文件，不修改其他文件，不提交

## SKILL.md 契约

- frontmatter `name` 必须等于目录名
- frontmatter `description` 用英文、第三人称，包含触发词与示例场景——
  它是 Claude 自动调用的匹配依据，必须具体到无歧义
- 正文以中文为主；术语、type 名、命令、代码与标识保留英文
- `description` 之外若需扩展材料，放 `assets/`（执行时填充的模板）与
  `references/`（填充指南），SKILL.md 保持精炼入口
