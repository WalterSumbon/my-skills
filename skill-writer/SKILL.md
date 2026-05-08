---
name: skill-writer
description: 编写和更新 skill 的规范、流程和最佳实践。Use when creating, reviewing, or improving a skill folder, SKILL.md, or bundled skill resources.
---

# Skill 的定义

Skill 是一个让 agent 在特定任务中获得稳定工作流、领域知识、工具脚本或素材的操作手册资料包。它遵循"渐进式披露"原则：

1. `name` 和 `description`：默认进入上下文，用于判断是否触发 skill。
2. `SKILL.md` 正文：仅在 skill 触发后读取，放核心流程和使用指引。
3. 其他资源：按需读取或执行，放详细参考、脚本、模板、素材。

# 创建或更新流程

1. 明确这个 skill 要支持的真实用户请求，至少确认核心任务和触发场景。
2. 判断哪些信息必须放在 `SKILL.md`，哪些应拆到资源文件。
3. 创建或更新 skill 文件夹，文件夹名必须等于 skill name。
4. 编写 `SKILL.md`：先写准确的 frontmatter，再写短而可执行的正文。
5. 测试新增脚本或关键资源，确保可直接运行。
6. 运行校验脚本；如果失败，修复后重新校验。
7. [可选]对复杂 skill 做真实任务 forward-testing，并根据结果迭代。

# 文件结构

每个 skill 单独成一个文件夹：

```
<skill-name>/
├── SKILL.md              # 必需
├── scripts/              # 可选：可执行脚本
├── references/           # 可选：详细参考资料
└── assets/               # 可选：模板、图片、字体、样例素材
```

只创建实际需要的资源目录。其他目录仅在任务明确需要时添加。

# `SKILL.md` 规范

`SKILL.md` 由 YAML frontmatter 和 Markdown 正文组成。

## Frontmatter

只包含 `name` 和 `description`：

```yaml
---
name: skill-name
description: 说明这个 skill 做什么，以及在什么用户请求或任务上下文中使用。
---
```

- `name`：使用小写字母、数字和连字符；建议 64 个字符以内；必须与文件夹名一致。
- `description`：这是触发机制。必须同时说明功能和使用场景，因为正文只有触发后才会被读取。

# Description 写法

好的 `description` 应该能让 agent 只靠它判断是否触发 skill：

- 先说明能力：这个 skill 帮 agent 做什么。
- 再说明场景：什么用户请求、文件类型、工作流或任务上下文应该使用它。
- 使用具体触发词，避免 “适用于各种场景” 这类宽泛描述。
- 只放必要细节；执行步骤放正文。
- 只有常见且严重的误触发场景，才写不应使用的边界。

## Markdown 正文

正文只写 agent 执行任务时必须知道的内容：

- 使用命令式表达，像操作手册一样说明步骤。
- 保留核心流程、关键约束、资源导航和少量高价值示例。
- 把低频、过长、变体化的内容拆到资源文件。
- 如果存在资源文件，明确说明它们是什么，以及何时读取或执行。
- 避免泛泛解释 skill 是什么；假设 agent 已理解基础概念。
- 需要特别关注的要求使用粗体或 `<IMPORTANT>...</IMPORTANT>` 标识。

# 资源分层判断

- `SKILL.md`：放每次使用都需要的核心流程、约束和资源索引。
- `references/`：放详细文档、领域知识、API 说明、长示例和变体规则。
- `scripts/`：放重复、易错、需要确定性的操作。新增脚本必须实际运行测试。
- `assets/`：放最终输出会使用的模板、图片、字体、样例素材等。

避免把同一信息同时放在 `SKILL.md` 和资源文件中。详细信息一旦拆出去，就在 `SKILL.md` 中保留清晰入口。

# 验证

完成创建或修改后运行校验脚本：

```bash
scripts/quick_validate.py <path/to/skill-folder>
```

如果当前环境没有该脚本，说明无法运行该项验证，并用可用方式检查 frontmatter、文件结构和资源引用。

新增或修改 `scripts/` 下的脚本时，必须实际执行代表性用例。复杂 skill 应使用真实任务做 forward-testing：只给测试 agent skill 路径和任务，不泄漏预期答案或修复思路。
