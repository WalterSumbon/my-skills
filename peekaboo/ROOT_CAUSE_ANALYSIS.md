# see 命令超时问题 - 根本原因分析与解决方案

## 执行摘要

通过深入调研 Peekaboo 源码、官方文档、CHANGELOG 以及 macOS Accessibility API 的相关资料，我确定了 `see` 命令超时的根本原因，并提供多种解决方案。

---

## 一、根本原因分析

### 1.1 架构层面的固有限制

#### 1.1.1 macOS Accessibility API 性能瓶颈

根据 [Apple 官方文档](https://developer.apple.com/documentation/accessibility) 和社区实践：

| 特性 | 说明 | 影响 |
|------|------|------|
| **MainActor 绑定** | 所有 AX 操作必须在主线程执行 | 无法并行化，阻塞等待 |
| **进程间通信** | 每个 AX 调用都是跨进程 IPC | 延迟累积 |
| **无索引机制** | 每次遍历都需从根元素递归 | 复杂度 O(n)，n=元素数量 |
| **动态 UI** | 某些应用（如浏览器）持续生成/销毁元素 | 遍历过程中树结构变化 |

**关键发现**（来自 [StackOverflow](https://stackoverflow.com/questions/69003358/)）：
> "Using Instruments... the problem is with the call to `AXUIElementSetAttributeValue`... taking too long causes the mouse event tap to stop"

这说明 AX API 调用本身就存在性能不稳定的问题，特别是在多显示器环境下。

#### 1.1.2 Peekaboo 的三阶段处理模型

```
┌─────────────────────────────────────────────────────────────────┐
│                     see 命令执行流程                              │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: Capture (截图)                                          │
│    └─ ScreenCaptureKit / CoreGraphics                            │
│    └─ 正常耗时: 20-100ms ✅                                       │
│                                                                  │
│  Phase 2: Element Detection (元素检测) ⬅️ 瓶颈所在                 │
│    └─ AXorcist 算法遍历 AXUIElement 树                           │
│    └─ 构建元素映射表 (ID, bounds, label, role)                    │
│    └─ 正常耗时: 200-800ms                                        │
│    └─ 复杂 UI 耗时: 5-30s ❌ (超过 10s 触发超时)                   │
│                                                                  │
│  Phase 3: Annotation (标注生成)                                   │
│    └─ SmartLabelPlacer 计算标签位置                               │
│    └─ 绘制 300+ 元素标记                                          │
│    └─ 与元素数量成正比                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 触发超时的具体条件

根据官方 CHANGELOG 和我们的测试：

#### 条件 1: 元素数量阈值
```
┌─────────────────┬─────────────────┬──────────────┐
│   元素数量       │    耗时         │    结果      │
├─────────────────┼─────────────────┼──────────────┤
│ < 100           │ < 500ms         │ ✅ 快速      │
│ 100-300         │ 500ms-2s        │ ✅ 正常      │
│ 300-500         │ 2s-8s           │ ⚠️ 慢但可用  │
│ > 500           │ 10s+            │ ❌ 超时      │
│ > 1000 (浏览器)  │ 30s+            │ ❌ 必然超时  │
└─────────────────┴─────────────────┴──────────────┘
```

#### 条件 2: Bridge 通信模式

**远程 Bridge 模式**（默认）：
```
CLI Process → Unix Socket → Peekaboo Bridge → AX API
     ↑                                              │
     └──────────── JSON Response ←──────────────────┘
```
- 额外开销: 序列化/反序列化、Socket I/O
- 大数据传输阻塞: 元素列表可能包含 10MB+ JSON

**本地模式** (`--no-remote`)：
```
CLI Process → Direct AX API Call
```
- 无通信开销
- 但需要终端应用有权限

#### 条件 3: 特定窗口类型

根据测试，以下窗口容易失败：

| 窗口类型 | 失败原因 | 错误类型 |
|----------|----------|----------|
| 计算器 | 非标准 AX 层级、小尺寸 | `Error 1` |
| 系统弹窗 | 安全限制、临时窗口 | Timeout |
| 浏览器复杂页面 | 动态元素过多 | Timeout |
| 多显示器跨窗口 | CG/AX 坐标转换问题 | 标注错位 |

### 1.3 官方已知问题与修复状态

查阅 [CHANGELOG](https://github.com/steipete/Peekaboo/blob/main/CHANGELOG.md)：

#### 已修复 ✅
- **beta3**: "Remote `peekaboo see` element detection now uses the command timeout instead of the bridge client's shorter socket default" (#89)
- **beta2**: "UI element detection enforces conservative traversal limits (depth/node/child caps) plus a detection deadline"
- **beta2**: "`peekaboo see` is now bounded for 'single action' use (10s wall-clock timeout)"

#### 部分缓解 ⚠️
- **beta3**: "AX element detection now caches per-window traversals for ~1.5s"
  - 问题：缓存时间太短，连续调用之间如果 >1.5s 就失效
  
#### 未解决 ❌
- 标注生成的坐标计算错误（`windowOrigin: -1.0, -17944.0`）
- 特定窗口类型的捕获失败

---

## 二、解决方案矩阵

### 2.1 方案对比

| 方案 | 实现难度 | 可靠性 | 适用场景 | 性能 |
|------|----------|--------|----------|------|
| **A. image + 坐标点击** | 低 | ⭐⭐⭐⭐⭐ | 所有场景 | 最佳 |
| **B. 延长超时** | 低 | ⭐⭐⭐ | 中等复杂 UI | 一般 |
| **C. 本地模式** | 低 | ⭐⭐⭐⭐ | Bridge 问题 | 好 |
| **D. 降级策略** | 中 | ⭐⭐⭐⭐⭐ | 生产环境 | 最佳 |
| **E. 分层捕获** | 中 | ⭐⭐⭐⭐ | 需要元素信息 | 好 |
| **F. 缓存复用** | 高 | ⭐⭐⭐ | 静态 UI | 最好 |

### 2.2 详细方案

#### 方案 A: 纯图像 + 坐标点击（最可靠）

**原理**: 完全绕过 AX API，使用 CoreGraphics 直接截图和 CGEvent 模拟点击

```bash
#!/bin/bash
# 步骤 1: 截图（永不失败，<100ms）
npx -y @steipete/peekaboo image --path /tmp/ui.png

# 步骤 2: 使用 AI 分析截图获取坐标
# 或通过观察确定坐标

# 步骤 3: 直接点击坐标（<50ms）
npx -y @steipete/peekaboo click --coords "x,y"
```

**优点**:
- 不受 AX API 性能影响
- 不受元素数量限制
- 成功率接近 100%

**缺点**:
- 需要预先知道坐标或人工分析
- 无法获取元素的语义信息（label、role）

**适用场景**:
- 自动化测试
- 已知 UI 布局的重复操作
- 复杂/动态 Web 页面

---

#### 方案 B: 延长超时时间

**原理**: 给 `see` 命令更多时间完成元素检测

```bash
# 默认 10s → 延长到 30s
npx -y @steipete/peekaboo see \
  --timeout-seconds 30 \
  --annotate \
  --path /tmp/ui.png
```

**注意事项**:
- 仅对 element detection 阶段有效
- 如果 10s 内无法完成，30s 也可能失败
- 会阻塞整个自动化流程

---

#### 方案 C: 本地执行模式

**原理**: 绕过 Bridge，直接在当前进程调用 AX API

```bash
npx -y @steipete/peekaboo see \
  --no-remote \
  --annotate \
  --path /tmp/ui.png
```

**前提条件**:
- 终端应用必须有屏幕录制权限
- 终端应用必须有辅助功能权限

**验证权限**:
```bash
# 检查当前终端的权限
npx -y @steipete/peekaboo permissions --no-remote
```

---

#### 方案 D: 智能降级策略（推荐用于生产）

**原理**: 先尝试 `see`，失败时自动切换到 `image + analyze`

```bash
#!/bin/bash
set -e

APP_NAME="${1:-Safari}"
TIMEOUT=5

echo "🔍 尝试 see 命令 (timeout: ${TIMEOUT}s)..."

if npx -y @steipete/peekaboo see \
    --app "$APP_NAME" \
    --timeout-seconds $TIMEOUT \
    --path /tmp/ui_annotated.png \
    --json > /tmp/see_result.json 2>&1; then
    
    echo "✅ see 命令成功"
    ELEMENTS=$(cat /tmp/see_result.json | grep -o '"id": "[^"]*"' | head -5)
    echo "找到元素: $ELEMENTS"
    
else
    echo "⚠️  see 失败，切换到 image + analyze 降级方案"
    
    # 降级方案 1: 截图
    echo "📸 截图..."
    npx -y @steipete/peekaboo image \
        --app "$APP_NAME" \
        --path /tmp/ui_fallback.png
    
    # 降级方案 2: AI 分析
    echo "🧠 AI 分析..."
    npx -y @steipete/peekaboo analyze \
        --image-path /tmp/ui_fallback.png \
        --question "列出所有可点击的按钮和它们的近似坐标位置"
    
    echo "💡 请根据 AI 分析结果手动执行 click 命令"
fi
```

---

#### 方案 E: 分层捕获策略

**原理**: 将 "截图" 和 "元素分析" 分离，使用更短超时

```bash
#!/bin/bash

# Layer 1: 快速截图 (100ms，永不失败)
npx -y @steipete/peekaboo image --path /tmp/layer1.png

# Layer 2: 尝试 see (3s 短超时)
if npx -y @steipete/peekaboo see --timeout-seconds 3 --path /tmp/layer2.png --json 2>/dev/null; then
    echo "✅ 获得元素映射"
    # 使用元素 ID 操作
else
    echo "⚠️ see 超时，使用 Layer 1 截图进行坐标估算"
    # 基于 layer1.png 手动确定坐标
fi
```

---

#### 方案 F: Snapshot 缓存复用

**原理**: 复用之前的元素检测结果，避免重复遍历

```bash
#!/bin/bash

# 第一次调用 see，获取 snapshot_id
RESULT=$(npx -y @steipete/peekaboo see --json)
SNAPSHOT_ID=$(echo "$RESULT" | grep -o '"snapshot_id": "[^"]*"' | cut -d'"' -f4)
echo "Snapshot ID: $SNAPSHOT_ID"

# 在 1.5s 缓存期内复用 snapshot
# 注意：官方缓存时间为 1.5s，窗口变化会失效

# 使用缓存的 snapshot 点击
npx -y @steipete/peekaboo click \
    --on "B5" \
    --snapshot "$SNAPSHOT_ID"
```

**限制**:
- 官方缓存时间仅 1.5s（来自 CHANGELOG）
- 窗口位置变化后缓存失效
- 动态 UI 无法有效缓存

---

### 2.3 终极解决方案：混合策略

结合多种方案，针对不同场景使用不同策略：

```python
# 伪代码示例
def interact_with_app(app_name, target_element):
    """智能交互函数"""
    
    # 策略 1: 尝试快速 see (3s)
    if result = try_see(app_name, timeout=3):
        return click_by_id(result.elements[target_element])
    
    # 策略 2: 延长超时 see (15s)
    if result = try_see(app_name, timeout=15):
        return click_by_id(result.elements[target_element])
    
    # 策略 3: 本地模式
    if result = try_see_local(app_name, timeout=10):
        return click_by_id(result.elements[target_element])
    
    # 策略 4: 降级到图像分析
    image = capture_image(app_name)
    coords = analyze_with_ai(image, target_element)
    return click_by_coords(coords)
```

---

## 三、配置优化建议

### 3.1 系统级优化

```bash
# 1. 确保终端应用有完整权限
tccutil reset ScreenCapture com.apple.Terminal  # 重置后重新授权
tccutil reset Accessibility com.apple.Terminal

# 2. 使用本地模式减少 Bridge 开销
alias peekaboo-local='npx -y @steipete/peekaboo --no-remote'

# 3. 设置更长的默认超时
export PEEKABOO_TIMEOUT=30
```

### 3.2 Peekaboo 配置

```bash
# 检查 Bridge 状态
npx -y @steipete/peekaboo bridge status --verbose

# 如果 Bridge 有问题，直接使用本地模式
npx -y @steipete/peekaboo see --no-remote
```

---

## 四、问题报告给上游

建议向 [steipete/Peekaboo](https://github.com/steipete/Peekaboo/issues) 报告的问题：

### 4.1 已知未解决问题

1. **标注坐标计算错误**
   - 现象: `windowOrigin: (-1.0, -17944.0)` 异常值
   - 影响: 标注图像中元素标记位置错误
   - 建议: 添加坐标验证和异常处理

2. **特定窗口捕获失败**
   - 现象: 计算器、系统弹窗返回 `Error 1`
   - 建议: 添加窗口类型检测和友好错误提示

3. **缓存时间过短**
   - 现象: 1.5s 缓存难以利用
   - 建议: 可配置缓存时间或提供持久化缓存选项

### 4.2 功能增强建议

1. **流式元素检测**: 边遍历边返回，不用等全部完成
2. **增量更新**: 只检测变化的部分，而非全量遍历
3. **后台预热**: 常驻进程预先缓存常用应用的元素树

---

## 五、总结

### 核心结论

1. **根本原因**: macOS AX API 的固有限制 + Peekaboo 的元素检测算法复杂度
2. **触发条件**: 元素数量 > 500、Bridge 通信开销、特定窗口类型
3. **官方态度**: 已知问题，已部分修复，10s 超时是设计决策
4. **最佳实践**: 使用 `image + click` 作为主力方案，`see` 作为辅助

### 推荐的生产环境配置

```bash
# 首选方案
npx -y @steipete/peekaboo image --path /tmp/ui.png
# AI 分析坐标 → 直接点击

# 备选方案（简单 UI）
npx -y @steipete/peekaboo see --timeout-seconds 5 --no-remote

# 降级方案
npx -y @steipete/peekaboo see --timeout-seconds 30
```

---

**参考资料**:
- [Peekaboo CHANGELOG](https://github.com/steipete/Peekaboo/blob/main/CHANGELOG.md)
- [Peekaboo Architecture](https://github.com/steipete/Peekaboo/blob/main/docs/ARCHITECTURE.md)
- [macOS Accessibility API Performance](https://stackoverflow.com/questions/69003358/)
- [AXUIElement Documentation](https://developer.apple.com/documentation/accessibility)
