# rule 原子化与组合元数据 — Design

给 rule 资产加选择与依赖两根元数据轴（tags、requires），把 rule 拆到最小可组合
单元，并以 profile 清单表达「项目 X 要哪一把」。拼装（拷贝到目标项目）仍归
未立项的使用端 CLI；本仓只做元数据、校验与查询。

## Problem

- rule 目前只有 kind + 落点（global/scoped）两根轴，落点是加载语义不是分类，
  无法回答「Python 项目该带哪几条」
- 构建期的去重纪律制造了隐性依赖（react/nestjs 删掉了 typescript 已覆盖的条目），
  只活在产物的一句边界声明里，机器不可见——拼装时漏选 typescript 会让约束凭空消失
- 部分 rule 混合了多个受众（constitution 里有 TS 专属红线；dependencies 全是
  JS 选型却 global 分发；react 里混着 Next.js 专属约定）

## Decisions

1. **元指令 frontmatter 新增两个字段**（仅 rule 类）：
   - `tags: [<tag>...]` — 必填，受控词表内，用于查找与分类；一条 rule 可属多类
   - `requires: [<rule-name>...]` — 可选，唯一的边类型；只为「去重导致的内容依赖」
     建边，不做 conflicts/extends。语义边界：requires 只表达任何组合下都成立的
     固有依赖，「仅在某组合下需要同时出现」的关系归 profile 清单表达
     （DITA 间接寻址的教训：文件内直接引用会破坏跨组合复用）
   - 选择与加载是两根轴：tags/profile 决定文件是否拼进项目；`scope` 决定进了
     项目后如何加载。JS 专属但 global 落点是合法组合

2. **受控词表 `meta/tags.json`（分面化）**：词表按维度（facet）分组，每面
   声明是否互斥；tag 存储仍是扁平字符串，分面只是词表组织装置。初始四面：
   - lang（互斥）：ts、python
   - layer（互斥）：frontend、backend
   - framework（互斥）：react、nextjs、nestjs
   - concern（可多选）：core、workflow、testing、docs、ai
   校验：tag 必须在词表内且跨面不重名；互斥面内一条 rule 至多一个值；
   ready rule 必须有 tags；词表中零引用的孤儿 tag 报违规。
   词表演化与内容演化同仓同提交，不设独立审批流。

3. **profile 账 `profiles.json`**（仓库根，与 skills.json 同风格的单文件账）：
   `{ "<name>": { "description": "...", "rules": ["<rule-name>", ...] } }`。
   profile 是显式清单不是 tag 查询结果——tag 用来找，profile 用来锁定，
   避免项目拼装结果随 rule 库演化漂移。校验三条：rule 名存在、requires 闭包
   满足、constitution 必含。初始 seed：`nextjs-app`、`react-spa`、`nestjs-api`、
   `python-cli`。组合语义顺序无关：同一 rules 集合的任何排列必须产出
   相同结果（约束未来装配实现；DITAVAL 多文件过滤顺序敏感是可审计性反例）。

4. **拆分清单**（原子化判据：存在真实项目只要文件的一半）：
   - constitution 瘦身：「TS 类型」红线（双重断言、`@ts-ignore`）迁入
     typescript rule；constitution 只留语言无关内容（三原则 + emoji/commit/
     kebab-case/生成文件）。本仓分发副本 `.claude/rules/constitution.md` 同步
   - dependencies 拆二：`dependencies-ts`（e18e、UnJS、Pure ESM、zod、
     oxlint + oxfmt + tsc + dependency-cruiser 工具链）+ `ai-sdk`
     （Vercel AI SDK）；原 `dependencies` 元指令与产物删除，lock 项清理
   - react 拆二：`react`（feature-based 目录、组件与类型、状态阶梯）+
     `nextjs`（`app/` 只做路由、页面保持薄；scope 同 `**/*.tsx`）
   - markdown 拆二：`markdown`（结构/格式/图示/术语/来源）+ `docs-retrieval`
     （LLM 友好节；源笔记标注过条件适用）
   - 不拆：typescript、nestjs、testing、python、context-management
   - requires 边：`nextjs → react`、`react → typescript`、`nestjs → typescript`、
     `docs-retrieval → markdown`
   - tag 指派：constitution[core]、context-management[core, workflow]、
     dependencies-ts[ts]、ai-sdk[ai, ts]、typescript[ts]、react[ts, frontend, react]、
     nextjs[ts, frontend, nextjs]、nestjs[ts, backend, nestjs]、
     testing[ts, testing]、markdown[docs]、docs-retrieval[docs, ai]、python[python]

5. **hash 排除管理字段**：lock 基线的元指令 hash 只算正文 + 构建相关
   frontmatter（name/status/scope），排除 tags/requires——补 tag 不得把资产
   打成 stale 触发无谓重建。产物 hash 不变（整文件）。实施顺序因此固定：
   先落 imeta 机械层（解析/hash/校验），再做拆分与补 tag。

6. **imeta 变更**（不新增动作，registry/keymap 不动）：
   - frontmatter 解析扩展 tags/requires；词表、requires 悬空引用、profile
     三类校验并入 `status`，违规非零退出并输出明细
   - `status --tag <t>` 过滤；`--json` 带出 tags/requires
   - writeback 的 frontmatter 冻结对 tags/requires 保持不变——管理字段不属
     产物回写范围，回写触碰它们应当报错（现有冻结逻辑已覆盖，无需代码变更）

## Testing

- 单测：词表校验（未知 tag 报错）、requires 闭包解析（悬空引用、传递闭包）、
  profile 校验（缺 constitution、漏 requires）、hash 排除逻辑（改 tags 不改
  hash、改正文改 hash）
- 拆分走正常 build 流程验证：新元指令构建、旧产物删除后 status 收敛全 synced

## Error Handling

- 未知 tag / 悬空 requires / profile 引用不存在的 rule：status 报违规明细，
  非零退出；不阻塞与之无关的构建
- profiles.json / tags.json 格式非法：报错并指出文件与字段

## Non-Goals

- compose/export/拼装命令（使用端 CLI 职责，边界维持 2026-07-12 裁决）
- conflicts/extends 等更多边类型；新边类型的准入门槛是出现一个现有机制
  无法回答的 competency question——第一个真实互斥案例出现前不加 conflicts
- 按 tag 动态求值或自动生成的 profile（false drops 不可审计；组合爆炸）
- 树状分类目录（目录保持 kind + 加载语义）
- skill/template 的 tags（先只做 rule，需求出现再扩）
- 分发基线登记（profile 版本 + rule hash 的发布记录，使用端立项时补）

调研背书与来源见 `docs/research/2026-07-15-rule-organization-survey.md`；
规模升级信号：rule 超约 100-150 条或 profile 数超 rule 数一半时重新评估
分层 tag 与 profile 继承。
