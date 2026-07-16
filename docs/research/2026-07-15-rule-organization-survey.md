# 原子化 rule 组织体系调研

调研目标：为「原子 rule + tags + requires + profile」设计（spec
`2026-07-15-rule-composition-design.md`）寻找成熟体系的印证与修正。
方法：四个研究 agent 并行深挖四个源流，共约 45 次真实检索，全部结论带来源；
最有分量的新事实（ESLint extends 复活）已抽查原文核实。

## 四个源流的核心结论

### 图书馆学（分类与受控词表）

- profile 显式清单 = pre-coordination（标引时固定词间关系），按 tag 动态求值 =
  post-coordination，后者的经典缺陷是 false drops（假组配——词间关系在组合时
  丢失）。美国国会图书馆 2007 年评估后保留 pre-coordination，理由是消歧、
  可提示性与精确性（[LC: Pre- vs. Post-Coordination, 2007](https://www.loc.gov/catdir/cpso/pre_vs_post.pdf)）
- tag 的正确定位是维护端查询与审计（post-coordinate 的价值在回答未预期的
  查询），不是运行时装载依据
- 分面分类 vs 枚举层级的分歧核心是「组合时合成 vs 预先枚举」；分面作为
  词表组织装置（维度分组 + 面内互斥）的收益与集合大小无关，实用分面数
  3-7 个（[Hedden: Faceted Classification](https://www.hedden-information.com/faceted-classification-and-faceted-taxonomies/)）；
  Ranganathan 式记法与 citation order 服务物理排架，数字场景不需要
- folksonomy 的统计收敛需要约百人级独立标注（Golder & Huberman,
  [JIS 2006](https://journals.sagepub.com/doi/10.1177/0165551506062337)），
  单维护者场景自由打标必然漂移，受控词表是唯一解；Stack Overflow 的治理
  三件套可平移：造词高门槛、synonym 入口归一、孤儿 tag 定期清理
  （[SO Blog: Tag Folksonomy](https://stackoverflow.blog/2010/08/01/tag-folksonomy-and-tag-synonyms/)）
- 受控词表的主要死因不是词表太小而是「审批流僵化落后于内容」——对策是
  词表演化与内容演化同仓同提交

### 技术文档单源体系（DITA / S1000D / docs-as-code）

- rule=topic、profile=map 的对应在技术写作界有二十年生产验证：topic 是
  "the basic unit of authoring and reuse"，交付物由 map 显式清单组装
  （[OASIS DITA: topic benefits](https://docs.oasis-open.org/dita/v1.2/os/spec/archSpec/topicbenefits.html)）
- 粒度之争的行业答案：元素级条件文本/片段转引（profiling/conref）的正当
  前提是「单元内 80/20 共享且拆文件代价高」，且是 DITA 公认最易失控的机制
  （"content spaghetti"，[Writerside: Content reuse](https://blog.jetbrains.com/writerside/2022/08/content-reuse-a-productivity-booster-or-a-vicious-circle/)）；
  短小 rule 文件不满足前提，文件级原子化胜出
- requires 写在 rule 内（DITA 的反向选择——它把引用上移到 map 做间接寻址）
  成立的边界：requires 只表达任何组合下都成立的固有依赖；组合特定的关系
  归 profile 清单
- S1000D 的 DMRL 是需求侧清单，多出「计划 vs 实际」对账语义——profile
  引用缺失 rule 应是对账状态；其 ACT/CCT 属性定义独立成被引用的受控文件，
  印证词表要有独立 SSoT 文件
- DITA-OT 的 DITAVAL 多文件过滤顺序敏感是可审计性反例——组合语义必须
  顺序无关（[dita-ot: project files](https://www.dita-ot.org/dev/topics/using-project-files.html)）
- 小团队 DITA 翻车案例的死因是文件多副本令复用收益归零
  （[CIDM: The DITA Tales](https://infomanagementcenter.com/resources/best-practices-newsletter/2025-best-practices-newsletter/the-dita-tales/)）——
  「源只在本仓改、下游副本不回改」是生死线级纪律
- docs-as-code 没长出组合体系的根因是「没有账」（无 reuse tracking）；
  我们的注册表 + lock 正是在 markdown 上外挂最小账本

### 软件规则/策略/配置组合

- ESLint legacy `extends` 级联死因：来源不可追溯、glob 合并语义连官方都怕
  （"It's confusing even to us"，[ESLint: new config system Part 1](https://eslint.org/blog/2022/08/new-config-system-part-1/)）；
  flat config 用一维显式数组替代。2025 年 extends 以「顺序化浅层展开」复活
  （已抽查核实，[ESLint: Evolving flat config](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/)），
  复发诱因是被组合物格式不统一——我们的原子是统一格式 markdown，诱因不存在
- OPA bundle 与 Sentinel policy set 都选「显式命名分组 + 构建期不重叠校验」，
  没有 conflicts 边与自动裁决；Sentinel 用三级 enforcement level 让强度
  标注替代冲突裁决（[Sentinel: Enforcement Levels](https://developer.hashicorp.com/sentinel/docs/concepts/enforcement-levels)）
- lockfile 的存在本身是「自动求解不可信赖为最终事实」的行业级证词
  （[Lockfile Format Design — Nesbitt](https://nesbitt.io/2026/01/17/lockfile-format-design-and-tradeoffs.html)）；
  「requires 只校验、profile 显式列全」= 跳过求解器直接手写 lockfile，
  10-50 节点规模的标准正解
- Gentoo USE flags 的组合爆炸教训 → 红线：永不提供「按 tags 自动生成
  profile」，组合点必须是枚举的、被真实项目使用的
  （[Gentoo devmanual: USE flags](https://devmanual.gentoo.org/general-concepts/use-flags/index.html)）
- K8s 三派（Helm 模板/Kustomize 补丁/jsonnet 求值）都是「组合单元大而
  不可拆」时的单元内变换机制；原子够小 + 整篇选取则全部不需要。出现
  「这条规则在 A 项目要改两句」时的正确响应是拆原子或复制，不是加参数化
- AI 规则生态（Ruler/rulesync）停在分发/转译层（目录全量拼接、frontmatter
  定向），装配层（profile + requires）是空白——自建不违反 Library-First；
  rulesync 的 frontmatter（globs/description）是事实最大公约数，字段命名
  保持兼容可降低未来接入成本（[intellectronica/ruler](https://github.com/intellectronica/ruler)、
  [dyoshikawa/rulesync](https://github.com/dyoshikawa/rulesync)）

### 知识管理（Zettelkasten / MOC / 本体论 / 库治理）

- 原子性可操作判据三条（[zettelkasten.de: atomicity guide](https://zettelkasten.de/atomicity/guide/)）：
  不可再删（删任何部分即不完整）、可命名（起不出精确标题=拆错粒度）、
  自足（脱离上下文可读，出现「如上所述」即非原子）；外加 Matuschak 的
  concept-oriented（按行为约束切，不按项目来源切）。过度原子化有共识批评
  （碎片化链接网络、点击折磨），AI 一次性注入的消费方式更不怕单文件略长——
  粒度宁粗勿碎
- profile 与 MOC/结构笔记同构且更强：共享「显式、人工策展、非排他」，
  差别是 MOC 允许不完备、profile 可机器校验完备性
  （[Nick Milo: relationships between notes](https://medium.com/@nickmilo22/in-what-ways-can-we-form-useful-relationships-between-notes-9b9ec46973c6)）
- 单一 requires 边是文献支持的甜点位：本体过度工程是知识图谱头号错误，
  加边的准入门槛是 competency question——「新边类型必须先有一个现有机制
  无法回答的问题」；最可能出现的第二种边是 conflicts，第一个真实互斥案例
  出现前不加（[knowledgegraph.dev: Ontology Best Practices](https://knowledgegraph.dev/article/Best_Practices_for_Ontology_Development_in_Knowledge_Graphs.html)、
  Semantic MediaWiki 的 typed link 维护成本教训）
- 词表退化信号可全部机器化：零引用 tag、rule 无 tag、tag 不在词表；
  修订用事件驱动（每次加 rule 顺带审词表）替代日历驱动
- 「组合优于分类」三个独立传统支持：Shirky 的 Ontology is Overrated
  （层级归类是物理书架的 hack）、DITA 的 authoring/delivery 分离、
  PARA 的按 actionability 组织（profile 即 project 语义）；制衡：Shirky
  只反层级不反受控——受控词表立场（Merholz 一侧）同样成立

## 对现有设计的裁定

确认（每一项都有至少两个独立源流背书）：

- 文件级原子 + 显式 profile 清单（DITA map、DMRL、MOC、flat config、
  policy set 五方同构）
- 受控 tag 词表、tag 只作维护端查询（LC pre-coordination、SO 治理、
  ACT/CCT）
- 唯一 requires 边、校验不求解（lockfile、competency question 门槛）
- 无继承、无 conflicts、无动态求值（ESLint 级联之死、OPA 无自动裁决、
  false drops）

增改（本次调研产出的设计修正）：

- 词表分面化：tags.json 按维度分组，面内可声明互斥，存储仍是扁平字符串
- 孤儿 tag 纳入校验（零引用 tag 报违规）
- requires 语义边界成文：只表达固有依赖，组合特定关系归 profile
- 组合语义顺序无关成文（约束未来装配实现）
- conflicts 边的准入门槛成文（competency question）
- 原子性三判据进 rule 拆分指引

考虑后拒绝：

- Sentinel 式 rule 级强度标注——我们的强度分层在条目级（RFC 2119 词），
  一条 rule 内混合多种强度，文件级标注失真
- SKOS 词间关系、分面记法、自动反链、图可视化——回本规模 10^3 起

## 规模适配与升级信号

- 当前设计的每个部件都在文献支持的低维护区间（10-50 条目）
- 升级信号：rule 超约 100-150 条或 profile 数超 rule 数一半（组合爆炸征兆）
  → 重新评估分层 tag 或 profile 继承；同一 rule 开始维护近似副本（变体压力）
  → 先拆公共部分，片段级机制是最后手段
- 永久红线：不按 tags 自动生成 profile；不做运行时求值；分发基线
  （profile 版本 + rule hash）在使用端立项时补
