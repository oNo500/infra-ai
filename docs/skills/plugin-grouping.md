# Plugin 分组分发（待用）

`pnpx skills` 支持通过 `.claude-plugin` manifest 把仓库里的多个 skill 声明成**命名分组**，
用户可按组安装一批，而非逐个 `-s <name>` 或 `--all` 全装。

当前仓内 skill 数量少，尚未引入。本文记录机制与 schema，规模上来后照此落地。

**来源**：[vercel-labs/skills](https://github.com/vercel-labs/skills) README 的
`Plugin Manifest Discovery` 一节（核对版本 `skills@1.5.11`）。schema 字段与官方
[Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) 兼容。

## 机制

若仓库根存在 `.claude-plugin/marketplace.json` 或 `.claude-plugin/plugin.json`，
其中声明的 skill 会被 `pnpx skills` 发现。声明的 skill 路径**在其声明深度直接搜**，
不受默认 depth-2 目录遍历限制 —— 因此 skill 可放进任意子目录，不必平铺。

## marketplace.json schema

```json
{
  "metadata": { "pluginRoot": "./plugins" },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "my-plugin",
      "skills": ["./skills/review", "./skills/test"]
    }
  ]
}
```

- `metadata.pluginRoot` — plugin 源目录的根（相对仓库根）
- `plugins[].name` — 分组名，用户按此名安装
- `plugins[].source` — plugin 源目录（相对 `pluginRoot`）
- `plugins[].skills` — 该组包含的 skill 路径数组（相对仓库根）

## 与 skills.json 的关系

`skills.json` 是本仓自造的全量总账（记 `source` 三类来源 + 镜像同步元数据），
`.claude-plugin/marketplace.json` 是 skills.sh 官方 manifest（管分发分组）。两者 schema 不同、
职责不同。

引入分组时，为避免 SSoT 漂移，`marketplace.json` 应**从 `skills.json` 生成**
（如 `make manifest`），而非两处手写。生成规则：按 skill 的分组维度（可给 `skills.json`
的条目加 `group` 字段）聚合出 `plugins[]`，`skills[]` 填仓内持有的 `custom`/`mirror`
条目路径（`official` 类不入 manifest，它不在 `skills/` 里）。

## 何时引入

- skill 数量增长到按领域/用途分组比逐个安装更省事时
- 需要给其他项目一次性装"某一套" skill（如"前端套件""调研套件"）时

在此之前保持 `skills.json` 平铺 + 逐个/全装即可，不提前引入 manifest。
