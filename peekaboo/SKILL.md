---
name: peekaboo
description: macOS GUI 自动化 - 截图、点击、输入、应用控制。推荐用 image+click，see 命令可能超时。
user-invocable: true
---

# Peekaboo - macOS GUI 自动化

**版本**: 3.0.0-beta3 | **要求**: macOS 15.0+, 屏幕录制+辅助功能权限

## 快速开始

```bash
# 检查权限
npx -y @steipete/peekaboo permissions

# 截图（最可靠）
npx -y @steipete/peekaboo image --path /tmp/ui.png

# 点击坐标
npx -y @steipete/peekaboo click --coords "100,200" --wait-for 1000
```

## ⚠️ 关键限制

| 问题 | 原因 | 解决 |
|------|------|------|
| `see` 超时 | 元素>500时AX API慢 | 用 `image`+`click --coords` 代替 |
| `see` 标注错 | 坐标计算bug | 看 `--json` 输出，忽略标注图 |
| 计算器/小窗口失败 | 非标准AX层级 | 用 `--mode frontmost` |

**推荐**: 生产环境用 `image` + 坐标点击，不用 `see`。

## MCP 配置

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

## 核心工具

### 截图
```bash
# 前台窗口
npx -y @steipete/peekaboo image --path /tmp/1.png

# 指定应用
npx -y @steipete/peekaboo image --app "Safari" --path /tmp/2.png
```

### 点击
```bash
# 坐标（推荐）
npx -y @steipete/peekaboo click --coords "100,200" --wait-for 1000

# 元素ID（需先用see获取）
npx -y @steipete/peekaboo click --on "B5" --wait-for 1000
```

### 输入
```bash
# 输入文字
npx -y @steipete/peekaboo type "Hello"

# 快捷键
npx -y @steipete/peekaboo hotkey --keys "cmd,c" --no-auto-focus
```

### 应用控制
```bash
# 启动
npx -y @steipete/peekaboo app launch "Safari" --wait-until-ready

# 切换（注意：用系统显示的语言名称）
npx -y @steipete/peekaboo app switch --to "Safari"

# 退出
npx -y @steipete/peekaboo app quit --app "Safari"
```

### 窗口管理
```bash
# 列出窗口
npx -y @steipete/peekaboo list windows --app "Chrome"

# 调整大小
npx -y @steipete/peekaboo window set-bounds --app "Terminal" --x 0 --y 0 --width 1280 --height 720

# 移动窗口到当前Space
npx -y @steipete/peekaboo space move-window --app "Chrome" --to-current --follow
```

## see 命令（慎用）

⚠️ **可能超时（10s+）或失败**，仅用于简单UI。

```bash
# 基本用法
npx -y @steipete/peekaboo see --annotate --path /tmp/ui.png

# 短超时+本地模式（更稳定）
npx -y @steipete/peekaboo see --timeout-seconds 5 --no-remote --json
```

**失败时降级**:
```bash
# see失败后，用image+坐标替代
npx -y @steipete/peekaboo image --path /tmp/fallback.png
# 观察截图，计算坐标，然后点击
npx -y @steipete/peekaboo click --coords "x,y" --wait-for 1000
```

## 完整工作流示例

### 示例1: 打开浏览器并截图
```bash
npx -y @steipete/peekaboo app launch "Safari" --wait-until-ready
npx -y @steipete/peekaboo app switch --to "Safari"
npx -y @steipete/peekaboo hotkey --keys "cmd,t" --no-auto-focus
npx -y @steipete/peekaboo type "github.com"
npx -y @steipete/peekaboo hotkey --keys "return" --no-auto-focus
sleep 2
npx -y @steipete/peekaboo image --path /tmp/github.png
```

### 示例2: 计算器自动化（用坐标）
```bash
# 启动计算器（英文名称）
npx -y @steipete/peekaboo app launch "Calculator" --wait-until-ready

# 点击 2+2= （基于计算器按钮坐标）
npx -y @steipete/peekaboo click --coords "60,280" --wait-for 1000  # 2
npx -y @steipete/peekaboo click --coords "140,360" --wait-for 1000 # +
npx -y @steipete/peekaboo click --coords "60,280" --wait-for 1000  # 2
npx -y @steipete/peekaboo click --coords "220,440" --wait-for 1000 # =

# 截图验证
npx -y @steipete/peekaboo image --app "计算器" --path /tmp/calc_result.png

# 关闭（用中文名称）
npx -y @steipete/peekaboo app quit --app "计算器"
```

## 故障排查

### 权限问题
```bash
# 检查权限
npx -y @steipete/peekaboo permissions

# 重置权限（需要重新授权）
tccutil reset ScreenCapture com.apple.Terminal
tccutil reset Accessibility com.apple.Terminal
```

### 超时/失败
- **see 超时**: 改用 `image` + `click --coords`
- **窗口找不到**: 用 `app switch` 先激活
- **Bridge 错误**: 加 `--no-remote` 本地执行
- **点击/输入超时**: 加 `--wait-for 1000` 或 `--no-auto-focus`

### 应用名称语言
- `app launch` 用 **英文** 名称（如 "Calculator"）
- `app switch` / `app quit` 用 **系统显示的语言**（如 "计算器"）

## 资源

- GitHub: https://github.com/steipete/peekaboo
- NPM: https://www.npmjs.com/package/@steipete/peekaboo
- 帮助: `npx -y @steipete/peekaboo --help`
