---
name: auto-optimize
description: 量化驱动优化框架 - 通过定义指标、自动测试、迭代优化任何可量化的目标（代码、文档、配置、模型等）。
user-invocable: true
---

# auto-optimize - 量化驱动优化框架

通过定义量化指标 (EVAL.md)，自动测试、迭代优化任何目标。

## 快速开始

```bash
# 1. 创建 EVAL.md 定义优化目标和验收标准
# 2. 运行优化
npx -y auto-optimize --target ./my-project

# 3. 查看优化历史
npx -y auto-optimize visualize --target ./my-project --open
```

## 核心概念

```
┌─────────────────────────────────────────────────────────────┐
│                 auto-optimize 优化循环                        │
├─────────────────────────────────────────────────────────────┤
│  EVAL.md                                                    │
│    ├─ 指标定义 (可量化的目标)                                 │
│    ├─ 测试方法 (如何测量)                                    │
│    └─ 验收标准 (目标值/否决项)                                │
│         ↓                                                   │
│  执行测试 → 收集指标 → 对比标准                               │
│         ↓                                                   │
│  达标? ─┬─→ 完成                                            │
│         └─→ 分析差距 → 生成优化方案 → 应用修改                 │
│              ↓                                              │
│         记录到 optimization_history.json → git commit              │
│              ↓                                              │
│         返回重新测试                                         │
└─────────────────────────────────────────────────────────────┘
```

## EVAL.md 规范

创建与目标同级的 `EVAL.md` 文件：

```markdown
# 优化目标

描述要优化什么，目标是什么。

## 指标定义

| ID | 名称 | 描述 | 测试命令 | 目标值 | 一票否决 |
|----|------|------|----------|--------|----------|
| I1 | 大小 | 文件体积 | wc -c main.js | < 10KB | 否 |
| I2 | 性能 | 执行时间 | time ./benchmark | < 100ms | 是 |
| I3 | 覆盖率 | 测试覆盖 | ./test.sh | > 90% | 否 |

## 测试脚本

```bash
#!/bin/bash
# test.sh - auto-optimize 会调用此脚本收集指标
# 输出格式: 指标ID=数值

echo "I1=$(wc -c < main.js)"
echo "I2=$(./benchmark | grep time | awk '{print $2}')"
echo "I3=$(./test.sh --coverage | grep percent | awk '{print $2}')"
```

## 优化策略

- 优先减少 I1（大小）
- I2 不达标时停止（一票否决）
- 允许牺牲 I3 换取 I1

## 约束条件

- 不能修改 API 签名
- 保持向后兼容
- 使用 ES6 语法
```

## 使用场景

### 场景 1: 优化 Skill 文档

```bash
cd ~/.agents/skills/peekaboo

cat > EVAL.md << 'EOF'
## 指标定义
| ID | 名称 | 测试命令 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 大小 | wc -c SKILL.md | < 5KB | 否 |
| I2 | 成功率 | ./test_commands.sh | 100% | 是 |
EOF

npx -y auto-optimize
```

### 场景 2: 优化代码性能

```bash
cd ./my-project

cat > EVAL.md << 'EOF'
## 指标定义
| ID | 名称 | 测试命令 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 执行时间 | time ./benchmark | < 50ms | 是 |
| I2 | 内存占用 | ./memory_test | < 10MB | 否 |
| I3 | 代码行数 | wc -l src/*.js | < 500 | 否 |
EOF

npx -y auto-optimize --max-rounds 20
```

### 场景 3: 优化配置文件

```bash
cd ./deployment

cat > EVAL.md << 'EOF'
## 指标定义
| ID | 名称 | 测试命令 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 启动时间 | time docker up | < 5s | 是 |
| I2 | 镜像大小 | docker images | < 100MB | 否 |
EOF

npx -y auto-optimize
```

### 场景 4: 优化 AI 模型提示词

```bash
cd ./prompts

cat > EVAL.md << 'EOF'
## 指标定义
| ID | 名称 | 测试命令 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 准确率 | ./eval_prompt.sh | > 95% | 是 |
| I2 | 令牌数 | ./count_tokens.sh | < 500 | 否 |
| I3 | 延迟 | time ./inference.sh | < 2s | 否 |
EOF

npx -y auto-optimize
```

## optimization_history.json 格式

自动生成的优化记录：

```json
{
  "target_name": "my-project",
  "target_type": "code|config|document|model|skill",
  "start_time": "2026-03-23T10:00:00Z",
  "total_time_ms": 3600000,
  "current_round": 5,
  "rounds": [
    {
      "round": 1,
      "timestamp": "2026-03-23T10:15:00Z",
      "elapsed_ms": 600000,
      "change": "Initial version",
      "metrics": {"I1": 15.2, "I2": 120},
      "delta": {},
      "commit": "abc123",
      "note": "基线测量"
    },
    {
      "round": 2,
      "timestamp": "2026-03-23T10:45:00Z",
      "elapsed_ms": 600000,
      "change": "Remove unused imports",
      "metrics": {"I1": 12.8, "I2": 115},
      "delta": {"I1": -2.4, "I2": -5},
      "commit": "def456",
      "note": "大小减少 16%"
    }
  ],
  "final_metrics": {"I1": 8.5, "I2": 95},
  "status": "completed|failed|in_progress"
}
```

## 命令行工具

### optimize - 执行优化

```bash
npx -y auto-optimize [options]

Options:
  --target <path>      优化目标路径 (默认: .)
  --max-rounds <n>     最大轮次 (默认: 10)
  --auto-commit        每次突破自动 git commit
  --no-interactive     非交互模式
  --strategy <name>    使用特定优化策略
```

### visualize - 可视化历史

```bash
npx -y auto-optimize visualize [options]

Options:
  --target <path>      目标路径 (默认: .)
  --port <n>           HTTP 端口 (默认: 8080)
  --open               自动打开浏览器
  --export <format>    导出格式: html|png|pdf|json
```

### init - 初始化 EVAL.md

```bash
npx -y auto-optimize init --target ./my-project --template skill|code|config
```

## 优化策略

auto-optimize 内置多种优化策略，根据 EVAL.md 自动选择或手动指定：

| 策略 | 适用场景 | 说明 |
|------|----------|------|
| `minimize` | 体积优化 | 删除冗余、压缩、简化 |
| `performance` | 性能优化 | 算法改进、缓存、并行 |
| `correctness` | 正确性优化 | 修复 bug、边界处理 |
| `readability` | 可读性优化 | 重构、注释、命名 |
| `balance` | 平衡优化 | 多指标 trade-off |

## 故障排查

### EVAL.md 不存在
```bash
Error: EVAL.md not found in ./my-project

解决:
npx -y auto-optimize init --target ./my-project
```

### 测试脚本失败
```bash
Error: Test script exited with code 1

解决:
1. 检查 EVAL.md 中的测试命令是否能独立运行
2. 确保测试脚本输出格式: ID=value
3. 使用 --verbose 查看详细错误
```

### 指标无法改善
```bash
Warning: No improvement after 5 rounds

解决:
1. 检查目标值是否过于激进
2. 检查约束条件是否矛盾
3. 尝试手动优化一轮作为示例
```

## 最佳实践

1. **指标要可量化**: "快" → "< 100ms"
2. **测试要稳定**: 避免 flaky test
3. **目标要合理**: 设置可达到的里程碑
4. **记录要详细**: 即使失败的尝试也要记录原因
5. **约束要明确**: 什么可以改，什么不能改

## 与 CI/CD 集成

```yaml
# .github/workflows/auto-optimize.yml
name: Optimize
on: [push]
jobs:
  auto-optimize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run auto-optimize
        run: npx -y auto-optimize --max-rounds 5
      - name: Upload history
        uses: actions/upload-artifact@v2
        with:
          name: auto-optimize-history
          path: optimization_history.json
```

## 资源

- https://github.com/anthropics/auto-optimize
- `npx -y auto-optimize --help`
- `npx -y auto-optimize learn`
