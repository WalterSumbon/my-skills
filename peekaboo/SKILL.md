---
name: peekaboo
description: macOS 屏幕捕获与 GUI 自动化工具。基于 Peekaboo MCP 3.0.0-beta3，提供 24+ 种工具用于截图、应用控制、窗口管理、鼠标键盘交互等。
user-invocable: true
---

# Peekaboo - macOS 屏幕捕获与 GUI 自动化

> **版本**: 3.0.0-beta3  
> **系统要求**: macOS 15.0+

## 核心原则

**直接执行** - 使用提供的工具直接操作，不要只描述动作。  
**简洁沟通** - 保持响应简短，以行动为导向。  
**持续尝试** - 在放弃前尝试多种方法。  
**错误恢复** - 从失败中学习并调整方法。

## 前置检查

在使用任何功能前，先检查权限状态：

```bash
npx -y @steipete/peekaboo permissions
```

**必需权限**:
- 屏幕录制 (Screen Recording)
- 辅助功能 (Accessibility)

## MCP 配置

在 `~/.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "peekaboo": {
      "command": "npx",
      "args": ["-y", "@steipete/peekaboo", "mcp"]
    }
  }
}
```

## 工具总览（24个）

### 📸 视觉与截图（4个）
| 工具 | 功能 | 关键参数 |
|------|------|----------|
| `see` | 截图并分析 UI 元素，返回元素 ID | `annotate`, `app_target`, `path` |
| `image` | 截图 | `app_target`, `path`, `format` |
| `analyze` | 分析已有图片 | `image_path`, `question` |
| `capture` | 视频/连续截图 | `mode`, `duration_seconds` |

### 🖱️ 鼠标与键盘交互（7个）
| 工具 | 功能 | 关键参数 |
|------|------|----------|
| `click` | 点击元素或坐标 | `on`/`coords`, `double`, `right` |
| `type` | 输入文字 | `text`, `on`, `press_return` |
| `hotkey` | 快捷键组合 | `keys` (如 "cmd,c") |
| `press` | 单键/按键序列 | `keys`, `count` |
| `scroll` | 滚动 | `direction`, `amount` |
| `move` | 移动鼠标 | `to`/`coords`, `duration` |
| `swipe` | 滑动手势 | `from`, `to`, `duration` |
| `drag` | 拖拽 | `from`, `to`, `duration` |

### 🪟 窗口与应用管理（5个）
| 工具 | 功能 | 关键参数 |
|------|------|----------|
| `app` | 应用控制 | `action`: launch/quit/focus/switch |
| `window` | 窗口操作 | `action`: focus/move/resize/close |
| `space` | Spaces 管理 | `action`: list/switch/move-window |
| `list` | 列出应用/窗口 | `item_type`, `app` |
| `dock` | Dock 交互 | `action`: launch/list/show/hide |

### 📋 系统与辅助（6个）
| 工具 | 功能 | 关键参数 |
|------|------|----------|
| `permissions` | 检查权限 | 无 |
| `sleep` | 暂停 | `duration` (毫秒) |
| `clipboard` | 剪贴板操作 | `action`: get/set/clear/save/restore |
| `menu` | 菜单栏交互 | `action`: list/click, `path` |
| `dialog` | 对话框交互 | `action`: click/input/file |
| `agent` | AI 自动化代理 | `task` |

---

## 详细使用指南

### 1. 截图与视觉分析

#### `see` - 首选的 UI 分析工具

**何时使用**: 任何需要与 UI 交互的场景，先执行 `see` 获取元素地图。

⚠️ **注意**: `see` 命令在复杂 UI 上可能需要 10 秒以上，可能超时。如果超时，尝试：
1. 使用 `image` 代替
2. 直接通过坐标点击
3. 简化 UI（关闭多余窗口）

**参数说明**:
```json
{
  "annotate": true,        // 生成带标记的截图
  "app_target": "Safari",  // 指定应用（可选）
  "path": "/tmp/ui.png",   // 保存路径（可选）
  "snapshot": "A1B2C3"     // 复用 snapshot ID（可选）
}
```

**输出示例**:
```
📝 Created annotated screenshot with 342 interactive elements
🖼️  Screenshot saved to: /tmp/ui.png
📱 Application: Safari
🧊 Detection method: AXorcist
📊 UI elements detected: 515
⚙️  Interactable elements: 342

Element IDs: B1, B2, T1, T2... (B=Button, T=TextField)
```

**最佳实践**:
- 始终先运行 `see` 了解当前 UI 状态
- 使用返回的元素 ID (如 `B1`, `T2`) 进行后续点击
- 每次 UI 变化后重新运行 `see` 获取新 snapshot

#### `image` - 简单截图

```json
{
  "app": "Safari",           // 指定应用窗口（CLI: --app）
  "path": "/tmp/shot.png",   // 保存路径
  "format": "png"            // png 或 jpg
}
```

**app 选项** (CLI 参数):
- 省略 - 前台窗口
- `"Safari"` - 指定应用
- `"screen:0"` - 指定屏幕
- `"frontmost"` - 前台应用

### 2. 鼠标交互

#### `click` - 点击

**三种点击方式**:

1. **按元素 ID 点击**（最可靠）:
```json
{
  "on": "B5",           // 从 see 返回的元素 ID
  "double": false,      // 是否双击
  "right": false        // 是否右键
}
```

2. **按坐标点击**:
```json
{
  "coords": "100,200"   // x,y 坐标
}
```

3. **按文字查询点击**:
```json
{
  "query": "Submit"     // 模糊匹配元素文字
}
```

#### `type` - 输入文字

```json
{
  "text": "Hello World",
  "on": "T1",              // 指定输入框（可选）
  "clear": true,           // 先清空（可选）
  "press_return": true,    // 完成后按回车（可选）
  "delay": 5,              // 按键间隔毫秒（可选）
  "profile": "human"       // human 或 linear（可选）
}
```

**特殊键**: `{return}`, `{tab}`, `{escape}`, `{delete}`

#### `hotkey` - 快捷键

```json
{
  "keys": "cmd,c",           // 复制
  "keys": "cmd,shift,t",     // 重新打开标签页
  "keys": "return"           // 回车键
}
```

**支持的修饰符**: `cmd`, `shift`, `alt`/`option`, `ctrl`, `fn`

#### `scroll` - 滚动

```json
{
  "direction": "down",    // up/down/left/right
  "amount": 5,            // 滚动单位数
  "smooth": true,         // 平滑滚动
  "on": "B10"             // 在指定元素上滚动（可选）
}
```

### 3. 应用与窗口管理

#### `app` - 应用控制

**action 类型**:
- `launch` - 启动应用
- `quit` - 退出应用
- `focus` - 聚焦应用
- `switch` - 切换到应用
- `hide`/`unhide` - 隐藏/显示应用

**示例**:
```json
// 启动并等待
{
  "action": "launch",
  "name": "Safari",
  "waitUntilReady": true
}

// 切换应用
{
  "action": "switch",
  "to": "Google Chrome"
}
```

#### `window` - 窗口操作

**action 类型**: `focus`, `move`, `resize`, `set-bounds`, `close`, `minimize`, `maximize`

```json
// 移动并调整大小
{
  "action": "set-bounds",
  "app": "Terminal",
  "x": 0,
  "y": 0,
  "width": 1280,
  "height": 720
}

// 关闭特定窗口
{
  "action": "close",
  "app": "Safari",
  "title": "特定标签页"
}
```

#### `space` - Spaces 管理

```json
// 列出所有 Spaces
{
  "action": "list",
  "detailed": true
}

// 切换到 Space 2
{
  "action": "switch",
  "to": 2
}

// 移动窗口到当前 Space
{
  "action": "move-window",
  "app": "Chrome",
  "to_current": true,
  "follow": true
}
```

### 4. 系统工具

#### `list` - 列出系统信息

```json
// 列出所有运行中的应用
{
  "item_type": "running_applications"
}

// 列出特定应用的窗口
{
  "item_type": "application_windows",
  "app": "Chrome",
  "include_window_details": ["ids", "bounds"]
}
```

#### `clipboard` - 剪贴板

```json
// 读取
{
  "action": "get"
}

// 写入
{
  "action": "set",
  "text": "要复制的内容"
}

// 保存并恢复
{
  "action": "save",
  "slot": "original"
}
// ... 其他操作 ...
{
  "action": "restore",
  "slot": "original"
}
```

#### `menu` - 菜单栏

```json
// 列出菜单
{
  "action": "list",
  "app": "TextEdit"
}

// 点击菜单项
{
  "action": "click",
  "app": "TextEdit",
  "path": "File > Save"
}
```

---

## 标准工作流

### 工作流 1: 与新应用交互

```
1. list (item_type: running_applications) - 确认应用状态
2. app (action: launch/switch) - 启动或切换到应用
3. see (annotate: true) - 分析 UI
4. click (on: "元素ID") / type (text: "...") - 交互
5. see - 验证结果
```

### 工作流 2: 表单填写

```
1. see (annotate: true) - 获取表单元素 ID
2. click (on: "T1") - 点击第一个输入框
3. type (text: "用户名") - 输入
4. click (on: "T2") - 点击密码框
5. type (text: "密码", press_return: true) - 输入并提交
```

### 工作流 3: 跨 Space 窗口操作

```
1. space (action: list, detailed: true) - 查看 Spaces
2. space (action: move-window, app: "Chrome", to_current: true, follow: true)
3. see - 确认窗口已移动
```

---

## 常见错误与解决

### 错误 1: 元素点击失败

**症状**: `click` 返回失败或找不到元素

**解决**:
1. 重新运行 `see` 获取最新元素 ID
2. 使用 `coords` 代替 `on` 进行坐标点击
3. 增加 `wait_for` 参数等待元素出现

### 错误 2: 应用窗口未激活

**症状**: 操作后截图显示的不是目标应用

**解决**:
1. 使用 `app (action: switch)` 而非 `app (action: focus)`
2. 添加 `sleep (duration: 500)` 等待切换完成
3. 使用 `window (action: focus, app: "应用名")`

### 错误 3: 权限被拒绝

**症状**: 所有操作都失败

**解决**:
1. 运行 `permissions` 检查权限状态
2. 重置权限: `tccutil reset ScreenCapture com.apple.Terminal`
3. 在系统设置中重新授权
4. 重启终端应用

### 错误 4: Space 切换无效

**症状**: 窗口仍在原 Space

**解决**:
1. 使用 `space (action: move-window, to_current: true, follow: true)`
2. 先 `app (action: switch)` 再移动窗口

---

## CLI 备用方案

当 MCP 连接不稳定时，使用 CLI：

```bash
# 检查权限
npx -y @steipete/peekaboo permissions

# 截图
npx -y @steipete/peekaboo image --path /tmp/shot.png

# 分析 UI
npx -y @steipete/peekaboo see --annotate --path /tmp/ui.png

# 点击坐标
npx -y @steipete/peekaboo click --coords "100,200"

# 切换应用
npx -y @steipete/peekaboo app switch --to "Safari"

# 输入文字
npx -y @steipete/peekaboo type --text "Hello"

# 快捷键
npx -y @steipete/peekaboo hotkey --keys "cmd,c"

# 滚动
npx -y @steipete/peekaboo scroll --direction down --amount 5

# 列出应用
npx -y @steipete/peekaboo list

# Spaces
npx -y @steipete/peekaboo space list
npx -y @steipete/peekaboo space switch --to 2
```

---

## 高级技巧

### 反检测自动化

与浏览器交互时，使用 human profile：

```json
{
  "profile": "human",  // 模拟人类行为
  "duration": 500      // 动画持续时间
}
```

### Snapshot 复用

在多步操作中复用 snapshot ID：

```json
// 第一步：获取 snapshot
{
  "tool": "see",
  "annotate": true
}
// 返回: Snapshot ID: A1B2C3

// 后续步骤使用相同 snapshot
{
  "tool": "click",
  "on": "B5",
  "snapshot": "A1B2C3"
}
```

### 窗口精确定位

使用 `window_id` 而非 `app` 名称：

```json
// 先获取窗口 ID
{
  "tool": "list",
  "item_type": "application_windows",
  "app": "Chrome"
}

// 使用 window_id 操作
{
  "tool": "window",
  "action": "focus",
  "window_id": 12345
}
```

---

## 🔧 故障排查（深度分析）

### 问题 1: `see` 命令超时或失败

**症状**:
```
error: The operation couldn't be completed. Operation timed out
error: INTERNAL_SWIFT_ERROR
```

**根本原因分析**:

1. **元素检测复杂度高** - `see` 命令包含三个阶段：
   - Capture Phase: 截图 (通常 < 200ms)
   - Element Detection: 分析 UI 元素 (可能 100ms - 10s+)
   - Annotation Generation: 生成标注图 (与元素数量成正比)

2. **UI 复杂度影响** - 测试数据显示：
   - iTerm2 (513 元素): 成功，~0.5s
   - 计算器 (小窗口): 失败，`PeekabooBridgeErrorEnvelope error 1`
   - Chrome (复杂页面): 可能超时

3. **Bridge 通信问题** - 远程 Bridge 可能响应慢

**解决方案（按优先级）**:

#### 方案 A: 使用 `image` + `click` 代替 `see`

```bash
# 第 1 步: 截图（永远不会超时）
npx -y @steipete/peekaboo image --path /tmp/ui.png

# 第 2 步: 手动观察截图确定坐标
# 第 3 步: 直接点击坐标
npx -y @steipete/peekaboo click --coords "100,200"
```

**适用**: 简单、确定的 UI 操作

#### 方案 B: 调整超时时间

```bash
# 默认 20s，延长到 30s
npx -y @steipete/peekaboo see --timeout-seconds 30 --annotate
```

**适用**: 复杂 UI 但元素检测能完成的情况

#### 方案 C: 使用 `--no-remote` 本地执行

```bash
# 绕过 Bridge，直接执行（需要终端有权限）
npx -y @steipete/peekaboo see --no-remote --annotate
```

**适用**: Bridge 通信问题

#### 方案 D: 简化 UI 后重试

```bash
# 关闭多余窗口，减少元素数量
# 切换到更简单的视图
# 然后重试 see
```

**适用**: 元素过多导致的性能问题

#### 方案 E: 分步捕获（推荐用于复杂场景）

```bash
# 第 1 步: 只截图，不分析
npx -y @steipete/peekaboo image --app "Safari" --path /tmp/safari.png

# 第 2 步: 使用 analyze 分析已保存的图片
npx -y @steipete/peekaboo analyze --image-path /tmp/safari.png --question "描述这个界面上的可点击元素"

# 第 3 步: 根据分析结果点击
npx -y @steipete/peekaboo click --coords "估计的坐标"
```

---

### 问题 2: `see` 标注图不显示元素标记

**症状**: 生成的 `*_annotated.png` 看起来和普通截图一样

**原因**: 
- 标注生成需要额外处理时间
- 某些 UI 元素坐标计算可能失败（如日志中 `windowOrigin: (-1.0, -17944.0)` 显示异常）

**解决**:
```bash
# 不使用 --annotate，只获取 JSON 输出
npx -y @steipete/peekaboo see --json --path /tmp/ui.png

# 解析 JSON 中的元素坐标，手动计算位置
# JSON 中的 rect 格式: {x, y, width, height}
```

---

### 问题 3: 特定应用窗口捕获失败

**症状**: `error 1` 或窗口无法找到

**已知的 problematic 应用**:
- 计算器 (小窗口，非标准 UI)
- 某些系统弹窗

**解决**:
```bash
# 使用 frontmost 模式代替指定应用
npx -y @steipete/peekaboo see --mode frontmost

# 或先切换到应用，再捕获前台
npx -y @steipete/peekaboo app switch --to "App"
npx -y @steipete/peekaboo see
```

---

### 问题 4: Bridge 连接问题

**诊断**:
```bash
# 检查 Bridge 状态
npx -y @steipete/peekaboo bridge status

# 检查 socket 文件
ls -la ~/Library/Application\ Support/Peekaboo/bridge.sock
```

**解决**:
```bash
# 重启 Bridge（杀死所有 peekaboo 进程）
pkill -f peekaboo

# 或使用 --no-remote 绕过 Bridge
npx -y @steipete/peekaboo see --no-remote
```

---

### 调试技巧

**开启详细日志**:
```bash
npx -y @steipete/peekaboo see --log-level trace --json 2>&1 | tee /tmp/debug.log
```

**关键日志字段**:
- `capture_phase`: 截图耗时
- `element_detection`: 元素检测耗时
- `generate_annotations`: 标注生成耗时

**性能基准**:
| 阶段 | 正常耗时 | 警告阈值 |
|------|----------|----------|
| capture_phase | < 200ms | > 1s |
| element_detection | < 1s | > 5s |
| generate_annotations | < 500ms | > 2s |

---

## CLI vs MCP 参数对照

| 功能 | MCP JSON 参数 | CLI 参数 | 示例 |
|------|---------------|----------|------|
| 启动应用 | `action: "launch"`, `name: "App"` | `app launch "App"` | ✅ 一致 |
| 指定应用 | `app: "Safari"` | `--app "Safari"` | ⚠️ 注意区别 |
| 截图目标 | `app: "Safari"` | `--app "Safari"` | CLI: `--app-target` ❌ |
| 点击坐标 | `coords: "100,200"` | `--coords "100,200"` | ✅ 一致 |
| 元素 ID 点击 | `on: "B1"` | `--on "B1"` | ✅ 一致 |

**常见错误**:
- ❌ `image --app-target "Safari"` → ✅ `image --app "Safari"`
- ❌ `app launch --name "Safari"` → ✅ `app launch "Safari"`

---

## 资源链接

- **GitHub**: https://github.com/steipete/peekaboo
- **NPM**: https://www.npmjs.com/package/@steipete/peekaboo
- **完整指南**: `npx -y @steipete/peekaboo learn`
