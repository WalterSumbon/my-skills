# auto-optimize 框架自身验收指标

## 优化目标

auto-optimize 是一个通用的量化驱动优化框架，可用于优化任何可量化的目标。

## 指标定义

| ID | 名称 | 描述 | 测试方法 | 目标值 | 一票否决 |
|----|------|------|----------|--------|----------|
| I1 | 文档大小 | SKILL.md 体积 | wc -c SKILL.md | < 10KB | 否 |
| I2 | 完整性 | 必需文件存在 | ls -1 | 4 files | 是 |
| I3 | 可用性 | 可视化脚本可执行 | node visualize.js --help | exit 0 | 是 |

## 测试脚本

```bash
#!/bin/bash
set -e

echo "Testing refine framework..."

# I1: 文档大小
SIZE=$(wc -c < SKILL.md)
if [ "$SIZE" -gt 10000 ]; then
  echo "I1=FAIL (size: $SIZE bytes > 10KB)"
  exit 1
fi
echo "I1=$SIZE"

# I2: 必需文件存在
REQUIRED="SKILL.md EVAL.md optimization_history.json visualize.js"
COUNT=0
for file in $REQUIRED; do
  if [ -f "$file" ]; then
    COUNT=$((COUNT + 1))
  fi
done
echo "I2=$COUNT"

# I3: 可视化脚本可执行
if node visualize.js --help > /dev/null 2>&1; then
  echo "I3=1"
else
  echo "I3=0"
  exit 1
fi

echo "All tests passed!"
```

## 验收标准

- I1 < 10KB: 文档简洁
- I2 = 4: 4 个必需文件齐全
- I3 = 1: 可视化脚本可正常执行

## 优化策略

- 保持核心概念清晰
- 添加多个使用场景示例
- 确保 visualize.js 独立可运行
