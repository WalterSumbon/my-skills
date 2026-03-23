---
name: auto-optimize
description: 量化驱动自主优化框架 - 借鉴 Karpathy autoresearch，通过定义指标让 AI 自主实验、测量、迭代改进。
user-invocable: true
---

# auto-optimize - 量化驱动自主优化

> 借鉴 [Karpathy autoresearch](https://github.com/karpathy/autoresearch) 思想：让 AI 自主实验，人类去睡觉，醒来看到优化结果。

**版本**: 1.0.0 | **要求**: Git, 可量化的优化目标

## 核心思想

```
┌─────────────────────────────────────────────────────────────────┐
│                    自主优化循环 (NEVER STOP)                      │
├─────────────────────────────────────────────────────────────────┤
│  1. 读取 EVAL.md / PROGRAM.md 了解目标和约束                     │
│  2. 分析当前指标状态                                             │
│  3. 提出优化想法 → 应用修改                                       │
│  4. 运行测试 → 收集指标                                          │
│  5. 记录结果 (JSON/TSV)                                          │
│  6. 改进? ─┬─→ git commit (保留)                                 │
│            └─→ git reset (丢弃)                                  │
│  7. 返回步骤 2，永不停止直到人类中断                               │
└─────────────────────────────────────────────────────────────────┘
```

**关键原则**: 
- **固定预算**: 每个实验固定时间/资源，结果可比
- **简单决策**: 改进就保留，否则丢弃
- **NEVER STOP**: 一旦开始，持续运行直到手动停止

## 快速开始

```bash
# 1. 创建 EVAL.md 定义优化目标
cat > EVAL.md << 'EOF'
## 指标定义
| ID | 名称 | 测试命令 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 执行时间 | time ./run.sh | < 100ms | 是 |

## 约束
- 只能修改 main.py
- 不能添加依赖
EOF

# 2. 启动自主优化（NEVER STOP 模式）
npx -y auto-optimize run --never-stop

# 3. 人类去睡觉，醒来查看结果
cat optimization_history.json
```

## 文件规范

### EVAL.md - 验收指标（人类编写）

```markdown
# 优化目标

缩短代码执行时间。

## 指标定义

| ID | 名称 | 测试命令 | 目标值 | 一票否决 |
|----|------|----------|--------|----------|
| I1 | 执行时间 | time ./benchmark | < 100ms | 是 |
| I2 | 代码行数 | wc -l main.py | < 200 | 否 |

## 测试脚本

```bash
#!/bin/bash
echo "I1=$(time ./benchmark | grep real | awk '{print $2}')"
echo "I2=$(wc -l < main.py)"
```

## 约束条件

- 只能修改 `main.py`
- 不能添加外部依赖
- 保持 API 兼容

## 简化原则

小改进 + 丑陋代码 = 不值得
删除代码 + 同等结果 = 值得保留
```

### PROGRAM.md - Agent 指令（可选，人类编写）

类似 Karpathy 的 `program.md`，告诉 Agent 如何优化：

```markdown
# PROGRAM.md

## Setup
1. 读取 EVAL.md 了解指标和约束
2. 运行测试建立基线
3. 创建 optimization_history.json

## Experiment Loop

LOOP FOREVER:
  1. 分析当前代码和指标
  2. 提出一个具体的优化想法
  3. 修改代码（只能改 main.py）
  4. 运行测试
  5. 记录结果
  6. 如果 I1 < 之前 → git commit
  7. 如果 I1 >= 之前 → git reset

## 优化思路
- 先尝试缓存常用结果
- 然后尝试减少循环嵌套
- 最后尝试算法优化

## 停止条件
- 达到目标值 < 100ms
- 连续 10 次无改进
- 或被人类手动停止
```

### optimization_history.json - 优化历史（自动生成）

```json
{
  "target_name": "my-project",
  "start_time": "2026-03-23T10:00:00Z",
  "rounds": [
    {
      "round": 1,
      "timestamp": "2026-03-23T10:05:00Z",
      "elapsed_ms": 300000,
      "metrics": {"I1": 150},
      "status": "keep",
      "change": "add caching",
      "commit": "abc123"
    },
    {
      "round": 2,
      "timestamp": "2026-03-23T10:10:00Z",
      "elapsed_ms": 300000,
      "metrics": {"I1": 80},
      "status": "keep",
      "change": "optimize loop",
      "commit": "def456"
    }
  ]
}
```

### results.tsv - 实验记录（可选，类似 Karpathy）

```
round	metric_before	metric_after	change	status	description
1	150ms	150ms	0ms	baseline	initial
2	150ms	120ms	-30ms	keep	add caching
3	120ms	80ms	-40ms	keep	optimize loop
4	80ms	85ms	+5ms	discard	try threading
```

## 命令行工具

### run - 启动优化

```bash
# 基本用法
npx -y auto-optimize run --target ./my-project

# NEVER STOP 模式（推荐，Karpathy 风格）
npx -y auto-optimize run --never-stop --target ./my-project

# 分支模式（每个实验一个分支）
npx -y auto-optimize run --branch-per-experiment --target ./my-project

# 指定最大轮次
npx -y auto-optimize run --max-rounds 50 --target ./my-project
```

### visualize - 可视化历史

```bash
# 生成 HTML 报告
npx -y auto-optimize visualize --target ./my-project --open

# 导出 TSV
npx -y auto-optimize visualize --target ./my-project --export tsv
```

### init - 初始化项目

```bash
# 创建 EVAL.md 和 PROGRAM.md 模板
npx -y auto-optimize init --target ./my-project --template code
```

## 使用场景

### 场景 1: 优化 Skill 文档（模仿 peekaboo 优化）

```bash
cd ~/.agents/skills/my-skill

cat > EVAL.md << 'EOF'
## 指标定义
| ID | 名称 | 测试命令 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 大小 | wc -c SKILL.md | < 5KB | 否 |
| I2 | 成功率 | ./test.sh | 100% | 是 |

## 约束
- 只能修改 SKILL.md
- 保留所有功能示例
EOF

npx -y auto-optimize run --never-stop
# 人类去睡觉，醒来查看 optimization_history.json
```

### 场景 2: 优化代码性能（Karpathy 风格）

```bash
cd ./my-project

cat > EVAL.md << 'EOF'
## 指标定义
| ID | 名称 | 测试命令 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 执行时间 | time ./benchmark | < 50ms | 是 |
| I2 | 内存 | ./memory_test | < 10MB | 否 |

## 约束
- 只能修改 main.py
- 不能添加依赖
- 保持向后兼容
EOF

cat > PROGRAM.md << 'EOF'
## 优化思路
1. 先尝试添加缓存
2. 然后尝试减少循环
3. 最后尝试算法优化
EOF

npx -y auto-optimize run --never-stop --branch-per-experiment
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

npx -y auto-optimize run --max-rounds 20
```

## 设计选择（借鉴 Karpathy）

| 设计 | 说明 |
|------|------|
| **固定预算** | 每个实验固定时间/资源，结果可比 |
| **单一文件修改** | Agent 只改指定文件，diff 可 review |
| **简单保留/丢弃** | 改进 → commit，否则 → reset |
| **TSV 记录** | 人类可读的实验记录 |
| **分支管理** | 每个实验独立分支，清晰可追溯 |
| **NEVER STOP** | 一旦开始，持续运行直到手动停止 |

## 故障排查

### EVAL.md 不存在
```bash
Error: EVAL.md not found

解决:
npx -y auto-optimize init --target ./my-project
```

### 测试脚本失败
```bash
Error: Test script exited with code 1

解决:
1. 单独运行测试命令验证
2. 确保输出格式: ID=value
3. 使用 --verbose 查看详情
```

### 无法决定保留/丢弃
```bash
Warning: Ambiguous improvement

解决:
在 EVAL.md 中明确定义优先级:
"I1 为主要指标，I2 为次要指标"
```

## 与 Karpathy autoresearch 的对比

| 特性 | Karpathy autoresearch | auto-optimize |
|------|----------------------|---------------|
| 适用范围 | ML 训练 (train.py) | 任何可量化目标 |
| 时间预算 | 固定 5 分钟 | 灵活定义 |
| 指标 | 单一 (val_bpb) | 多指标支持 |
| 记录格式 | TSV | JSON + TSV |
| 版本管理 | 分支 (autoresearch/mar5) | commit 或分支 |
| 人类输入 | program.md | EVAL.md + PROGRAM.md |
| 停止条件 | NEVER STOP | NEVER STOP 或 max-rounds |

## 最佳实践

1. **从简单开始**: 先定义一个主要指标，后续再加
2. **固定预算**: 每个实验固定时间/资源，确保可比性
3. **约束明确**: 告诉 Agent 什么能改，什么不能改
4. **NEVER STOP**: 让 Agent 持续运行，人类异步查看结果
5. ** mornings review**: 早上醒来查看 optimization_history.json

## 资源

- https://github.com/karpathy/autoresearch - 灵感来源
- https://github.com/anthropics/auto-optimize - 本项目
- `npx -y auto-optimize --help`
