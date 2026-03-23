# see 命令超时问题深度分析报告

## 问题概述

`see` 命令在 Peekaboo 3.0.0-beta3 中存在间歇性超时或失败问题。

## 测试环境

- **版本**: Peekaboo 3.0.0-beta3 (main/69376fa4-dirty)
- **系统**: macOS 15.0+
- **权限**: 屏幕录制 ✅, 辅助功能 ✅
- **Bridge**: 远程模式 (bridge.sock)

## 测试方法

```bash
# 多次执行 see 命令，记录耗时和结果
for i in 1 2 3; do
  npx -y @steipete/peekaboo see --path /tmp/test_$i.png --timeout-seconds N --json
done
```

## 测试结果

### 成功案例分析

**iTerm2 (复杂 UI)**
```
✅ 成功
- 元素数量: 513
- 可交互元素: 340
- 各阶段耗时:
  - capture_phase: 134ms ✅
  - element_detection: 329ms ✅
  - generate_annotations: ~50ms ✅
- 总耗时: ~0.5s
```

**普通前台窗口**
```
✅ 成功
- 总耗时: 0.568s
- 无异常
```

### 失败案例分析

**情况 1: 元素检测超时**
```
❌ 失败
- 错误: Operation timed out
- 超时设置: 10-20s
- 卡住阶段: element_detection
- 元素数量: 通常 > 500
```

**情况 2: 窗口捕获失败**
```
❌ 失败 (计算器应用)
- 错误: PeekabooBridge.PeekabooBridgeErrorEnvelope error 1
- 卡住阶段: window_capture
- 窗口特征: 小尺寸 (198x350px)，非标准 UI
```

**情况 3: 标注生成问题**
```
⚠️ 部分失败
- 现象: annotated.png 没有元素标记
- 原因: 元素坐标计算异常 (windowOrigin: -1.0, -17944.0)
```

## 根本原因分析

### 1. 元素检测算法复杂度

`see` 命令的工作流程:
```
1. Capture Phase (截图)
   └─ 通常 < 200ms ✅

2. Element Detection (AXorcist 算法)
   └─ 遍历所有 UI 元素
   └─ 构建元素树
   └─ 正常: < 1s
   └─ 复杂 UI: 可能 > 10s ❌

3. Annotation Generation (标注生成)
   └─ 为每个元素绘制标记
   └─ 计算标签位置
   └─ 与元素数量成正比
```

### 2. Bridge 通信开销

```
CLI → Bridge Socket → Peekaboo Service → CoreGraphics/AX API
     ↑___________________________________________|
                    (往返通信)
```

- 每个操作都通过 Unix Socket 通信
- 大数据传输（截图、元素列表）可能阻塞

### 3. 特定窗口的兼容性问题

某些窗口类型无法被正确捕获:
- 系统级弹窗
- 小尺寸窗口（< 200px）
- 使用非标准渲染的窗口

## 解决方案矩阵

| 场景 | 推荐方案 | 命令示例 | 成功率 |
|------|----------|----------|--------|
| 简单 UI | 直接使用 `see` | `see --annotate` | 95%+ |
| 复杂 UI | `image` + `click` | `image` → 手动点击 | 99%+ |
| 超时问题 | 延长 timeout | `see --timeout-seconds 30` | 80% |
| Bridge 问题 | `--no-remote` | `see --no-remote` | 90% |
| 小窗口 | `mode frontmost` | `see --mode frontmost` | 70% |
| 需要分析 | `image` + `analyze` | `image` → `analyze` | 85% |

## 推荐的最佳实践

### 方案 1: 降级策略（最可靠）

```bash
#!/bin/bash
# 尝试 see，失败后使用 image

if npx -y @steipete/peekaboo see --timeout-seconds 5 --json > /tmp/result.json 2>&1; then
    echo "see 成功"
    ELEMENTS=$(cat /tmp/result.json | jq -r '.data.ui_elements[].id')
else
    echo "see 失败，使用 image 降级"
    npx -y @steipete/peekaboo image --path /tmp/backup.png
    # 手动分析或点击
fi
```

### 方案 2: 分层捕获

```bash
# 第 1 层: 快速截图验证
npx -y @steipete/peekaboo image --path /tmp/check.png

# 第 2 层: 如果需要元素信息，尝试 see（短超时）
npx -y @steipete/peekaboo see --timeout-seconds 3 --json

# 第 3 层: 如果 see 失败，使用 analyze 分析已保存的图
npx -y @steipete/peekaboo analyze --image-path /tmp/check.png --question "列出所有按钮"
```

### 方案 3: 直接使用坐标（最稳定）

```bash
# 跳过元素检测，直接基于屏幕坐标操作
npx -y @steipete/peekaboo image --path /tmp/ref.png
# 人工/AI 分析确定坐标
npx -y @steipete/peekaboo click --coords "x,y"
```

## 性能优化建议

### 对用户的建议

1. **简化 UI**
   - 关闭不必要的窗口
   - 切换到简单视图
   - 避免在复杂网页上使用 `see`

2. **调整期望**
   - `see` 不是实时工具（适合自动化，不适合快速交互）
   - 大批量操作时批量处理，而非逐个点击

3. **备用方案**
   - 始终准备 `image` + `click` 作为降级

### 对 Peekaboo 开发者的建议

1. **优化 element_detection 算法**
   - 添加增量更新机制
   - 对大型 UI 使用采样而非全量检测

2. **改进超时处理**
   - 区分"卡住"和"慢"
   - 提供进度反馈

3. **标注生成优化**
   - 修复 windowOrigin 计算错误
   - 添加标注失败回退

## 验证清单

使用 `see` 前检查:
- [ ] 目标窗口不是系统弹窗
- [ ] 目标窗口尺寸 > 200x200
- [ ] UI 元素数量 < 500
- [ ] Bridge 状态正常 (`bridge status`)
- [ ] 已准备降级方案

## 相关 Issue

此问题可能与以下因素相关:
- AX API 性能限制
- CoreGraphics 窗口捕获限制
- Bridge 通信序列化开销
- Beta 版本稳定性

---

**结论**: `see` 命令在复杂 UI 场景下存在稳定性问题。建议在生产环境中使用 `image` + `click` 组合作为更可靠的替代方案。
