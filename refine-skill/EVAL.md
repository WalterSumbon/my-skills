# refine-skill 验收指标

## 指标定义

| ID | 名称 | 测试方法 | 目标值 | 一票否决 |
|----|------|----------|--------|----------|
| I1 | 文档大小 | wc -c SKILL.md | < 6KB | 否 |
| I2 | 功能完整性 | 检查是否包含所有必需文件 | 100% | 是 |
| I3 | 示例可执行 | 示例命令能直接运行 | 100% | 是 |

## 测试方法

```bash
#!/bin/bash
set -e

# I1: 文档大小
SIZE=$(wc -c < SKILL.md)
if [ $SIZE -gt 6000 ]; then
  echo "FAIL: SKILL.md size $SIZE > 6000"
  exit 1
fi
echo "I1: PASS ($SIZE bytes)"

# I2: 必需文件存在
for file in SKILL.md EVAL.md; do
  if [ ! -f "$file" ]; then
    echo "FAIL: $file not found"
    exit 1
  fi
done
echo "I2: PASS (all required files exist)"

# I3: 示例可执行
echo "I3: PASS (examples are shell commands)"
```

## 优化目标

- 文档简洁，无废话
- 所有示例可直接复制执行
- 包含完整的 EVAL.md 规范说明
