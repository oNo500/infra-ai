---
paths:
  - "**/*.py"
---

# Python

工具链选型：uv 单一入口、ruff、pyright。PEP 8 细节与可自动修复项交给 ruff 强制，
不在此重述；本 rule 只写选型纪律与 lint 管不到的判断。

## 工具链：uv 单一入口

包管理、venv、Python 版本管理、全局 CLI 工具一律走 uv，
不用 pip/venv/pyenv/pipx/poetry 拼装。

- MUST NOT 在 uv 项目里 `pip install`——绕过 `uv.lock` 污染 `.venv`
  - 正：`uv add requests`；反：`pip install requests`
- `uv.lock` MUST 提交；CI 里用 `uv sync --frozen`，禁止 CI 改动 lock
- 命令经 `uv run` 在 `.venv` 里执行，不手动 activate
  - 正：`uv run pytest`；反：`source .venv/bin/activate && pytest`
- Python 版本用 `uv python pin <ver>` 固定，写入 `.python-version`
- 全局 CLI 工具用 `uv tool install`（一次性运行用 `uvx`）；`uv tool install` ≠ `uv add`，
  混用会把工具装进项目环境
  - 正：`uv tool install httpie`（全局工具）；反：`uv add httpie`（装进了项目依赖）
- 单文件脚本用 PEP 723 内联依赖声明 + `uv run <file>.py`，不为脚本建项目目录、
  不污染全局环境
- 项目元数据写 pyproject.toml（PEP 621）；dev 依赖用 dependency groups（PEP 735）
  - 正：`uv add --dev pytest`；反：把 pytest 写进 `dependencies`

## lint 与格式化

- ruff 一体化承担 lint + format，不另配 black/isort/flake8
  - 正：`uv run ruff check --fix && uv run ruff format`；反：black + isort + flake8 拼装

## 类型

- 类型检查用 pyright，经 `uv run pyright` 执行
- 注解用现代语法（ruff 的 UP 系列可自动迁移；未配 ruff 的项目手动遵守）：
  - 联合类型（PEP 604）：正 `int | None`；反 `Optional[int]`、`Union[int, str]`
  - 内置容器泛型（PEP 585）：正 `list[int]`、`dict[str, int]`；反 `typing.List[int]`
  - 泛型语法（PEP 695，3.12+）：正 `def first[T](xs: list[T]) -> T`；反 `T = TypeVar("T")`
