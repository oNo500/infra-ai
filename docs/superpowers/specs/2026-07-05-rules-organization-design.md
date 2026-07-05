# Rules 组织 — Design

规划 `rules/` 的组织：两种加载形态的 rule 如何分类、书写、分发、与 meta 构建衔接。

## Problem

可分发规则位定为仓库根 `rules/`（原规划的 `docs/rules/` 废弃——产物不进 `docs/`，
`docs/` 只放文档；产物目录在根，与 `skills/` 对称）。rule 有两种形态，
加载方式不同，写法约束也不同，需要在目录组织上把这个区别显式化：

- 全局规则——AGENTS.md / CLAUDE.md 同性质内容，无条件进上下文
- Claude Code 动态规则——带 `paths` frontmatter，触碰匹配路径才加载

## Decisions

1. **按加载形态分两个子目录**——分类是一等信息，`ls` 可见，不靠打开文件看 frontmatter：

   ```
   rules/
   ├── global/    # 全局：无 paths frontmatter，每主题一文件
   └── scoped/    # 动态：paths frontmatter 按 glob 触发
   ```

2. **写法约束跟着分类走**：
   - `global/`——无条件占上下文，必须精简、姿态化；每主题一文件，按需组合
   - `scoped/`——按需加载，允许更细更长；`paths` 写在文件 frontmatter 里

3. **分发用手动复制，不用 symlink**——symlink 绑定绝对路径，跨设备不可靠。
   需要哪条规则就 copy 到目标项目 `.claude/rules/`。接受副本漂移，人工兜底：
   源只在 infra-ai 改，下游副本不回改，有价值改动回写中心后重新 copy

4. **rule 与 skill 同构，走同一套源/构建/产物模型**——`meta/rules/<name>.md`
   是源（永久保留），`meta/BUILD.md` 是构建指令，`rules/<类>/<name>.md`
   是产物（可随风格标准重建）。产物原则上由元指令构建而来，不直接手写；
   直接在产物上做的有价值修改必须回写元指令（回写纪律同 skill）。
   元指令声明作用域（global，或 scoped + glob），构建时据此决定产物落哪个子目录、
   写不写 `paths`；`meta/BUILD.md` 的 `target: rule` 节补充此规则。
   现有 `python`、`typescript`、`readme-rule` 三个 stub 预期均为 global

5. **`.claude/rules/`（自用）不动**——自用规则在两个以上项目被重复需要时，
   升级进 `rules/`（沿用既定判断标准）

## Out of Scope

- AGENTS.md / CLAUDE.md 的拼装生成机制——`global/` 内容与它们同性质，将来需要
  兼容其他工具时再建；现在只在语义上承认这层关系
- 同步/对账机制——手动复制，无脚本
- 具体 rule 内容的编写——由 meta 元指令构建流程另行完成

## Verification

结构性约定，无可执行验证。落地时检查：

- 两个子目录存在且根 README、SKILLS 相关文档指向一致
- `meta/BUILD.md` `target: rule` 节含作用域声明规则
- 首个 rule 产物构建时按声明落对子目录
