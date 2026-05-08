---
name: skill-writer
description: 编写skill的规范和最佳实践。Use when create or update a skill.
user-invocable: true
---

# skill的定义

skill的本质是一个模型可以根据description自行决定是否取用的操作手册资料包。整体遵循"渐进式披露"的原则，渐进的层次如下：
1. skill name和description：最短，默认放到system prompt中
2. markdown内容：更详细的内容，不会默认放到system prompt中，仅当模型调用这个skill时才会传递给模型阅读
3. 其他资源：按需读取/使用的资源，如文本、脚本等

# 文件结构

每个skill单独成一个文件夹，文件夹名称为skill的名称。目录结构如下：

```
<skill-name>/
├── SKILL.md
├── [other directory or files]
```

其中，SKILL.md是必需的，其他文件或目录根据需要添加，并且可以在SKILL.md中进行相对路径引用。

# SKILL.md规范

SKILL.md是skill的核心文件。

格式为包含yaml front matter和markdown内容的文件：
- yaml front matter部分包含skill的元信息。其中name、description是必须的，其他字段根据需要添加。这2个字段的信息会放到system prompt中，供模型决定是否调用这个skill。
  - name: skill的名称，必须与文件夹名称一致。只能包含小写字母、数字和连字符，且必须以字母开头。长度不超过20个字符。 
  - description: skill的简要描述。需要清晰、简洁地说明skill的功能和用途，并且说明在什么场景下使用这个skill。长度不超过200个字符。
- markdown内容部分包含skill的描述、使用说明等。这部分的内容不会直接放到system prompt中，只有当模型调用这个skill时，才会将这部分内容作为调用结果传递给模型。

# 最佳实践

- skill name应该具有描述性，能够清晰地传达skill的功能和用途。
- skill description要求：
  - 简洁明了，能够让模型快速理解skill的功能和适用场景
  - 至少包含2个部分:
    1. skill的功能和用途的简要概括
    2. 适用场景的说明，告诉模型在什么情况下应该调用这个skill
  - 不应该包含过多的细节信息，细节信息应该放在markdown内容部分
  - 不应该包含过于宽泛的描述，如"适用于各种场景"，而是应该具体说明适用的场景，以便模型更好地判断是否调用这个skill
  - 不应该包含不应该使用这个skill的场景，除非这些误用场景非常核心且常见，或者编写者要求
- markdown要求：
  - 包含模型一定需要知道的最核心的信息，低频使用/过长的内容应该放到other directory or files中。
  - 如果存在other directory or files，需要说明这些资源是什么，以及模型在什么情况下需要使用这些资源。
  - 清晰的流程说明是好的
  - 简短适当的常用示例是好的，但也不要过多
  - 尽量用"应该做什么"替代"不要做什么"，也不需要解释为什么这样做。像一本操作手册一样。
  - 需要模型特别关注的部分，用粗体或<IMPORTANT>...</IMPORTANT>标识出来。
  - 适当的格式化（如标题、列表等）可以提升可读性。
  - 越短越好。考虑精简语言，或者将低频/非核心部分内容放到other directory or files中。
- 其他资源要求：
  - 常见的目录命名：
    - "examples"：存放示例文件
    - "scripts"：存放脚本文件
    - "references"：存放参考资料
    - "templates"：存放模板文件
    - "data"：存放数据文件
  - 资源文件的命名应该具有描述性，能够清晰地传达文件的内容和用途。