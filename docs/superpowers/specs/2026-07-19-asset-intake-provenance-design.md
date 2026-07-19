# 资产引入规则与两层溯源设计

日期:2026-07-19
状态:已批准(用户裁决:范围 skill+rule / imeta links 独立动作 / url 改名 refUrl)

## 背景与纠正

此前给 skills.json 加的 `url` 字段语义不精确。用户纠正溯源模型为两层:

- **参考来源(refUrl)**:官方权威指导页(如 ai-sdk 的
  `https://ai-sdk.dev/docs/getting-started/coding-agents`)。它是官方对
  官方资产的权威指导,是引入资产时的信息源头;链接可能变更/失效,
  需要健康检查
- **实际来源**:真正获取资产的途径,因情况而异——某个 repo
  (已有 `repo/path/commit` 字段)、参考页里给的某条安装命令、
  或某工具安装目录内(如 surge 的安装目录自带 skill)

两者都要记:refUrl 回答「官方怎么说」,实际来源回答「东西从哪来」。

## 用户裁决

- 本轮范围:skill + rule 两类建齐 intake 规则与溯源字段;
  mcp(现仅 docs/mcp 文档)与 agent(kind 不存在)的立账另立项,
  intake 契约遇到它们时提示「待立项」而不建账
- 链接检查走独立 `imeta links` 动作(显式跑才走网络,
  `imeta status` 保持离线快)
- 字段命名:`url` 改名 `refUrl`(现仅 ai-sdk 一条在用,改零成本)

## 组成一:溯源 schema

### skills.json(SkillEntry)

- `url` → `refUrl`(可选,参考来源链接;迁移现有 ai-sdk 条目)
- 新增 `install`(可选,自由文本):实际来源为「命令或目录」时记录,
  如 `pnpx skills add vercel/ai` 或 `<surge 安装目录>/skills/`。
  仅记录不执行。mirror 类的实际来源仍是 `repo/path/commit`,不重复
- SKILLS.md 的 schema 说明同步(替换上一轮写的 url 段落)

### rule 元指令 frontmatter

- 允许可选 `refUrl`(参考来源链接)。定位是管理元数据:
  - `parseMetaFile` 解析进 `MetaAsset.refUrl`(缺省空串)
  - MUST NOT 进 `metaContentHash` 的 kept(改链接不触发产物 stale)
  - 不进 catalog(查询场景用不到,YAGNI;要看去元指令)
- 既有「正文首段标收编来源」纪律不变——refUrl 是机器可读补充,
  面向链接检查;人读的来源叙述仍在正文

## 组成二:intake 契约(meta/prompts/asset-intake.md)

AI 行为契约,流程:

1. 用户给官方链接(参考来源)
2. AI 真实抓取该页(mandate 真实工具调用,禁凭记忆),提取页面中
   提供/推荐的资产:skill、rule 素材、mcp、agent
3. 对每个可收资产判定类别与形态:
   - 操作性知识 → skill:按 SKILLS.md 现有三分法判 official/mirror/custom,
     建 skills.json 条目;`refUrl` 记参考来源;实际来源按情况落
     `repo/path/commit` 或 `install`
   - 姿态化约束素材 → rule:建/更新 meta/rules 元指令(stub 起步),
     frontmatter 记 `refUrl`,正文首段标收编来源
   - mcp / agent → 本轮不建账:输出「发现 <名称>,类别 mcp/agent,
     账未立项,refUrl=<链接>」提示,由用户决定是否立项
4. 全部产出走人审后入账;引入 official skill 时按 SKILLS.md 现有
   安装方式落地

契约同时定义「来源更新」步骤(与检查解耦):`imeta links` 报告
某资产参考来源失效后,更新可以是手动改账,也可以指派 AI 重新
上网检索定位新的权威页,按本契约的抓取纪律验证后更新 refUrl。

## 组成三:imeta links 动作

- 注册表:id `links`,kind query,无参数;TUI keymap 配键
  (assets 视图,键位避开已占用的 a/b/w/v/g)
- 扫描面:skills.json 全部条目的 `refUrl` + meta/rules(及将来各 kind)
  frontmatter 的 `refUrl`
- 网络判定(每链接一次请求,不跟随重定向):
  - HTTP 404/410 → **broken**:输出「<资产>: 参考来源需更新」+ 旧链接
  - HTTP 301/308(永久重定向)→ **moved**:同上提示,并附 Location 新址
  - 2xx/302/307 → ok
  - 超时/网络错误 → **unreachable**:警告但不定罪(网络抖动不算失效)
- 退出码:有 broken 或 moved 退 1;仅 ok/unreachable 退 0
- 只报不改:更新 refUrl 是独立步骤(见契约)
- 实现:ActionContext 新增可注入的 `fetchStatus(url): Promise<{ status: number; location?: string }>`
  能力(测试注入 fake,不打真网;默认实现走 fetch,超时 10s)

## 非目标(YAGNI)

- mcp/agent 立账(另立项;intake 契约只提示)
- 自动改写/自动修复 refUrl(检查只报)
- 执行 install 命令(纯记录)
- 链接检查并入 status 或定时任务
- 既有其余 official/mirror 条目的 refUrl 回填(触碰各条目时顺手补)

## 测试策略

- meta-cli 单测:SkillEntry refUrl/install 序列化;parseMetaFile 读
  rule frontmatter refUrl 且 metaContentHash 不受其影响;links 动作
  用 fake fetchStatus 覆盖 broken/moved/ok/unreachable 四态与退出码;
  parity.test.ts(新动作进 keymap)
- 契约文档无可执行测试,以 spec-review 与首次真实 intake 演练验收
