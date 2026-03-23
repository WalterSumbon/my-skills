---
name: refine-skill
description: Skill优化工具 - 通过量化指标驱动迭代，自动测试、记录优化历史、可视化改进过程。
user-invocable: true
---

# refine-skill - Skill 优化工具

通过量化指标驱动 Skill 迭代优化，自动测试、记录历史、可视化改进。

## 快速开始

```bash
# 1. 为目标 skill 创建 EVAL.md 定义验收指标
# 2. 运行优化流程
npx -y @anthropic-ai/sk refine --skill ./my-skill --max-rounds 10

# 3. 查看优化历史可视化
npx -y @anthropic-ai/sk refine visualize --skill ./my-skill
```

## 文件规范

### EVAL.md - 验收指标定义

与 `SKILL.md` 同级，定义量化验收标准：

```markdown
# 验收指标

## 指标定义

| 指标ID | 名称 | 测试方法 | 目标值 | 一票否决 |
|--------|------|----------|--------|----------|
| I1 | 工具调用成功率 | 执行 EVAL.md 中的测试命令 | >= 95% | 是 |
| I2 | 文档大小 | wc -c SKILL.md | < 5KB | 否 |
| I3 | 启动时间 | time cold start | < 2s | 否 |

## 测试脚本

```bash
#!/bin/bash
# test.sh - 由 refine-skill 调用
npx -y @my-skill/test --suite all
```

## 失败处理

- 每项指标最多重试 3 次
- 一票否决项失败立即停止
```

### refine_history.json - 优化历史

自动生成的优化记录：

```json
{
  "skill_name": "peekaboo",
  "start_time": "2026-03-23T10:00:00Z",
  "total_time_ms": 3600000,
  "rounds": [
    {
      "round": 1,
      "timestamp": "2026-03-23T10:15:00Z",
      "elapsed_ms": 900000,
      "change": "Initial version",
      "metrics": {
        "I1": 0.85,
        "I2": 16442,
        "I3": 1.5
      },
      "commit": "abc123"
    }
  ]
}
```

## 优化流程

```
┌─────────────────────────────────────────────────────────────┐
│                    refine-skill 优化循环                     │
├─────────────────────────────────────────────────────────────┤
│  1. 读取 EVAL.md 获取指标定义                                 │
│  2. 执行测试脚本收集当前指标                                  │
│  3. 检查是否满足所有目标值                                    │
│     ├─ 是 → 优化完成                                          │
│     └─ 否 → 继续                                               │
│  4. 分析问题并生成优化方案                                    │
│  5. 应用优化修改 SKILL.md                                     │
│  6. 重新测试收集新指标                                        │
│  7. 记录到 refine_history.json                                │
│  8. git commit 保存突破                                        │
│  9. 返回步骤 2                                                │
└─────────────────────────────────────────────────────────────┘
```

## 使用示例

### 示例 1: 优化 peekaboo skill

```bash
# 进入 skill 目录
cd ~/.agents/skills/peekaboo

# 创建 EVAL.md（如不存在）
cat > EVAL.md << 'EOF'
# 验收指标

## 指标定义

| ID | 名称 | 测试方法 | 目标 | 否决 |
|----|------|----------|------|------|
| I1 | 命令成功率 | 执行14个核心命令 | 100% | 是 |
| I2 | 文档大小 | wc -c SKILL.md | < 5KB | 否 |

## 测试命令

```bash
#!/bin/bash
set -e
npx -y @steipete/peekaboo permissions
npx -y @steipete/peekaboo image --path /tmp/t1.png
npx -y @steipete/peekaboo click --coords "100,200" --wait-for 1000
# ... 共14个命令
```
EOF

# 运行优化
npx -y refine-skill optimize --max-rounds 10

# 查看可视化
npx -y refine-skill visualize
```

### 示例 2: 在代码中调用

```typescript
import { RefineSkill } from 'refine-skill';

const refine = new RefineSkill({
  skillPath: './my-skill',
  maxRounds: 10,
  autoCommit: true
});

const result = await refine.optimize();
console.log(`优化完成: ${result.rounds} 轮, 最终指标:`, result.finalMetrics);
```

## 可视化脚本

```bash
# 一键启动浏览器查看优化历史
npx -y refine-skill visualize --skill ./my-skill --open
```

生成包含以下图表的 HTML 页面：
- **指标趋势图**: 每轮各指标的变化曲线
- **耗时分析图**: 每轮优化耗时分布
- **突破标记**: 标注每次 git commit 的节点

## 故障排查

### EVAL.md 不存在
```bash
Error: EVAL.md not found

解决:
1. 创建 EVAL.md 文件
2. 或者运行: npx -y refine-skill init --skill ./my-skill
```

### 测试脚本失败
```bash
Error: Test script exited with code 1

解决:
1. 检查 EVAL.md 中的测试命令是否能独立运行
2. 检查依赖是否安装
3. 查看 refine_history.json 中的错误记录
```

### Git 未初始化
```bash
Warning: Git not initialized, skipping auto-commit

解决:
cd ./my-skill && git init
```

## 最佳实践

1. **指标要量化**: "快" → "< 2s"
2. **测试要自动化**: 避免人工判断
3. **提交要及时**: 每次突破立即 commit
4. **记录要完整**: 即使失败的尝试也要记录
5. **可视化要查看**: 定期审视优化趋势

## 资源

- https://github.com/anthropics/refine-skill
- `npx -y refine-skill --help`
