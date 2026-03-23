---
name: peekaboo
description: macOS GUI 自动化 - 截图、点击、输入、应用控制。推荐用 image+click，see 命令可能超时。
user-invocable: true
---

# Peekaboo - macOS GUI 自动化

**版本**: 3.0.0-beta3 | **要求**: macOS 15.0+, 屏幕录制+辅助功能权限

## 快速开始

```bash
npx -y @steipete/peekaboo permissions
npx -y @steipete/peekaboo image --path /tmp/ui.png
npx -y @steipete/peekaboo click --coords "100,200" --wait-for 1000
```

## ⚠️ 关键限制

| 问题 | 解决 |
|------|------|
| `see` 超时/失败 | 用 `image` + `click --coords` |
| `see` 标注错位 | 忽略标注图，用 `--json` |

**生产环境**: 只用 `image` + 坐标点击，不用 `see`。

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

## 核心命令

```bash
# 截图
npx -y @steipete/peekaboo image --path /tmp/1.png
npx -y @steipete/peekaboo image --app "Safari" --path /tmp/2.png

# 点击（--wait-for 1000 防止超时）
npx -y @steipete/peekaboo click --coords "100,200" --wait-for 1000

# 输入
npx -y @steipete/peekaboo type "Hello"
npx -y @steipete/peekaboo hotkey --keys "cmd,c" --no-auto-focus

# 应用控制
npx -y @steipete/peekaboo app launch "Safari" --wait-until-ready
npx -y @steipete/peekaboo app switch --to "Safari"
npx -y @steipete/peekaboo app quit --app "Safari"

# 窗口管理
npx -y @steipete/peekaboo list windows --app "Chrome"
npx -y @steipete/peekaboo window set-bounds --app "Terminal" --x 0 --y 0 --width 1280 --height 720
npx -y @steipete/peekaboo space move-window --app "Chrome" --to-current --follow
```

## see 命令（慎用）

```bash
# 可能超时，仅用于简单UI
npx -y @steipete/peekaboo see --timeout-seconds 5 --path /tmp/ui.png

# 失败后降级：直接用 image + 坐标点击
```

## 完整示例

```bash
# 浏览器自动化
npx -y @steipete/peekaboo app launch "Safari" --wait-until-ready
npx -y @steipete/peekaboo app switch --to "Safari"
npx -y @steipete/peekaboo hotkey --keys "cmd,t" --no-auto-focus
npx -y @steipete/peekaboo type "github.com"
npx -y @steipete/peekaboo hotkey --keys "return" --no-auto-focus
sleep 2
npx -y @steipete/peekaboo image --path /tmp/github.png

# 计算器自动化
npx -y @steipete/peekaboo app launch "Calculator" --wait-until-ready
npx -y @steipete/peekaboo click --coords "60,280" --wait-for 1000  # 2
npx -y @steipete/peekaboo click --coords "140,360" --wait-for 1000 # +
npx -y @steipete/peekaboo click --coords "60,280" --wait-for 1000  # 2
npx -y @steipete/peekaboo click --coords "220,440" --wait-for 1000 # =
npx -y @steipete/peekaboo image --app "计算器" --path /tmp/calc.png
npx -y @steipete/peekaboo app quit --app "计算器"
```

## 故障排查

```bash
# 检查/重置权限
npx -y @steipete/peekaboo permissions
tccutil reset ScreenCapture com.apple.Terminal
tccutil reset Accessibility com.apple.Terminal
```

**常见问题**:
- 超时: 加 `--wait-for 1000` 或 `--no-auto-focus`
- Bridge 错误: 加 `--no-remote`
- 应用名: `launch` 用英文（"Calculator"），`switch/quit` 用中文（"计算器"）

## 资源

- https://github.com/steipete/peekaboo
- `npx -y @steipete/peekaboo --help`
- `npx -y @steipete/peekaboo learn` - 完整 AI agent 使用指南
