# Peekaboo Skill 测试计划

## 测试目标
验证所有 24 个工具在 skill 指导下能正确被 agent 调用，任务完成率 100%。

## 测试环境
- macOS 15.0+
- Peekaboo 3.0.0-beta3
- 权限已授予

## 测试清单

### Phase 1: 基础工具测试（无需特定应用）
- [ ] permissions - 权限检查
- [ ] list - 列出运行中的应用
- [ ] sleep - 暂停

### Phase 2: 截图工具测试
- [ ] image - 截图
- [ ] see - 截图并分析 UI
- [ ] capture - 视频捕获

### Phase 3: 应用控制测试
- [ ] app (launch) - 启动计算器
- [ ] app (switch) - 切换到计算器
- [ ] app (quit) - 退出计算器

### Phase 4: 窗口管理测试
- [ ] window (list) - 列出窗口
- [ ] window (focus) - 聚焦窗口
- [ ] window (resize) - 调整窗口大小

### Phase 5: 鼠标键盘交互测试
- [ ] click (坐标) - 点击计算器按钮
- [ ] click (元素ID) - 点击分析出的元素
- [ ] type - 输入文字
- [ ] hotkey - 快捷键
- [ ] scroll - 滚动

### Phase 6: 系统工具测试
- [ ] clipboard - 剪贴板操作
- [ ] menu - 菜单栏交互
- [ ] space - Spaces 操作
- [ ] dock - Dock 操作

### Phase 7: 复杂任务测试
- [ ] 完整工作流: 打开计算器 → 计算 2+2 → 截图验证 → 关闭

## 评分标准
- 工具调用成功率: 成功调用次数 / 总调用次数
- 任务完成率: 完成的任务数 / 总任务数（允许最多3次尝试）
