---
name: python
description: Python 工具链选型：uv 单一入口、ruff、pyright、现代类型语法
status: ready
scope: "**/*.py"
tags: [python]
---

# 元指令：python rule

Python 项目的工具链与工程约定，作用于 `**/*.py`。

## 目标

固化 notes 仓 Python 节点的选型（uv / ruff / pyright）与 uv 工作流实践。
只写选型与纪律；uv 子命令用法属可查阅内容，产物里点到即可不展开教学。

## 约束（素材，构建时组织成产物）

工具链（单一入口 uv）：

- 包管理、venv、Python 版本管理、全局 CLI 工具一律走 uv，
  不用 pip/venv/pyenv/pipx/poetry 拼装
- uv 项目里禁止 `pip install`——绕过 lock 文件污染 `.venv`
- `uv.lock` 必须提交；CI 里 `uv sync --frozen` 禁改 lock
- 命令经 `uv run` 在 `.venv` 里跑，不手动 activate
- Python 版本 `uv python pin` 写入 `.python-version`
- 全局工具 `uv tool install` / `uvx`；注意 `uv tool install` ≠ `uv add`，
  混用会把工具装进项目环境
- 单文件脚本用 PEP 723 内联依赖声明 + `uv run <file>.py`，
  不建项目目录、不污染全局
- 项目元数据用 pyproject.toml（PEP 621）；dev 依赖用 dependency
  groups（PEP 735，`uv add --dev`）

lint 与格式化：

- ruff 一体化承担 lint + format，不另配 black/isort/flake8；
  PEP 8 细节交给 ruff 强制，不写进规则背诵

类型：

- 类型检查用 pyright
- 注解用现代语法：`X | Y` 不用 `Optional[X]`/`Union`（PEP 604）、
  内置容器泛型 `list[int]` 不用 `typing.List`（PEP 585）、
  3.12+ 项目用 PEP 695 泛型语法（`def f[T](x: T)`）

## 产物要求

- scoped 落点；工具链纪律给一行级正/反例（命令对比），
  类型语法给新旧写法对照
- 素材源：notes 仓 `20-areas/20-04-tech-tree/python/00-MOC-Python.md`、
  `PyEco-uv工作流.md`、`Python-现代工具链清单.md`、`Python-PEP速查.md`
