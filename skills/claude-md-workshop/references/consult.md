# 咨询模式路由表

> 当 SKILL.md 路由到咨询模式时，按本文件分主题加载更深的 reference。

## 适用输入

- "这条怎么改？"
- "这个应该放哪里？"
- "这个写法对吗？"
- 用户贴一小段（一条规则 / 一个章节）问

## 主题路由

按用户问什么，加载对应 reference 的对应节。每次只加载需要的那节，不读全文。

| 用户问 | 加载 | 关键原则 |
|--------|------|---------|
| 措辞/强调词 | `principles.md` §2 | 强调金字塔；NEVER ≤ 5；正向 > 负向 |
| 长度/要不要拆 | `principles.md` §1 | < 200 行；删除测试；@import 不省 token |
| 位置/章节顺序 | `principles.md` §3 | 首尾效应；标准章节顺序 |
| 完整性（行为/范围/失败） | `principles.md` §4 | 三要素缺一会瞎编 |
| 反模式判断 | `principles.md` §6 | 九类；对号入座 |
| 进阶（AIDEV / Golden Rule / 规模 Gate） | `principles.md` §7 | |
| 载体选择（放哪 / 迁 hook） | `principles.md` §8 | 被忽视 3 次 → hook |
| 骨架长什么样 | `archetypes.md` | 五种原型；对号入座 |
| 这条该不该写 | `checklist.md` §A 真实度三问 | |
| 反模式命中判定 | `checklist.md` §E | |
| Things That Will Bite You 怎么写 | `assets/examples/bite-you-samples.md` | |
| NEVER 怎么写 | `assets/examples/never-samples.md` | |
| Golden Rule 变体 | `assets/examples/golden-rule-samples.md` | |
| 失败模式怎么写 | `assets/examples/failure-mode-samples.md` | |

> 注：表是给 skill 内部用的，产出给用户的回答用列表。

## 回答格式

- **结论**：一句话判断（对/不对/建议改/建议留）
- **理由**：引用上面路由到的原则（说清是哪条）
- **重写**（可选）：如果用户贴了草稿需要改 → 给 before/after

保持一次只回答一条。如果用户问了多个问题，分多轮答。

## 禁做

- 不展开整份 `principles.md` / `checklist.md`（只读路由命中的节）
- 不自作主张改用户其他段（即使一眼看出有问题，等用户问再说）
- 不和 `claude-md-improver` 比较
