# Ant Design CSS Token VS Code 插件

一款让 Ant Design CSS Token 在 VS Code 中「可见、可理解、可操作」的插件。

## 项目介绍

在使用 Ant Design v5/v6 进行前端开发时，CSS Token（如 `--ant-color-primary`）是抽象的，开发者无法直观看到真实颜色效果。本插件旨在解决这个痛点，让 Token 使用更加直观和高效。

## 功能特性

### ✅ 已完成（阶段1 + 阶段2）

#### 阶段1：Token 数据管理

- ✅ Token 数据管理：完整的 Token 注册表和查询系统
- ✅ 主题管理：自动检测和切换 Light/Dark 主题
- ✅ 高性能：10000 次查询仅需 1ms
- ✅ 类型安全：完整的 TypeScript 类型定义
- ✅ 完善测试：35 个测试用例

#### 阶段2：颜色可视化

- ✅ **智能扫描**：自动识别代码中的 `var(--ant-*)` Token
- ✅ **颜色装饰**：在编辑器中直接显示 Token 对应的颜色
- ✅ **实时更新**：编辑代码或切换主题时自动更新颜色显示
- ✅ **多样式支持**：方形、圆形、下划线、背景等多种装饰样式
- ✅ **多文件支持**：支持 CSS、Less、Sass、JavaScript、TypeScript、JSX/TSX、Vue、HTML
- ✅ **高性能**：1000 行文件扫描 < 50ms，支持大文件
- ✅ **可配置**：灵活的样式、位置、大小配置

### 🚧 开发中（阶段3）

- Hover 提示：悬浮显示 Token 详细信息
- 跳转定义：快速跳转到 Token 定义位置

### 📅 计划中（阶段4+）

- 自动补全：智能提示可用的 Token
- 自定义 Token 支持
- Token 使用统计
- 设计规范检查

## 使用示例

### 颜色可视化效果

```css
.button {
  /* ■ 蓝色色块会显示在这里 → */
  color: var(--ant-color-primary);

  /* ■ 灰色色块会显示在这里 → */
  background: var(--ant-color-bg-container);

  /* ■ 边框颜色也会显示 → */
  border: 1px solid var(--ant-color-border);
}
```

### 支持的文件类型

- **样式文件**: CSS, Less, Sass/Scss
- **脚本文件**: JavaScript, TypeScript
- **框架文件**: JSX, TSX (React), Vue
- **标记文件**: HTML

### 可用命令

打开命令面板（Cmd/Ctrl + Shift + P），输入：

- `Ant Design Token: Toggle Color Decorator` - 启用/禁用颜色装饰器
- `Ant Design Token: Refresh Token Decorations` - 刷新所有装饰

### 配置选项

在 VS Code 设置中搜索 "antdToken"：

```json
{
  // 主题模式
  "antdToken.themeMode": "auto", // "auto" | "light" | "dark"

  // 颜色装饰器
  "antdToken.colorDecorator.enabled": true,
  "antdToken.colorDecorator.style": "square", // "square" | "circle" | "underline" | "background"
  "antdToken.colorDecorator.position": "before", // "before" | "after"
  "antdToken.colorDecorator.size": "medium" // "small" | "medium" | "large"
}
```

## 技术架构

### 完整架构（阶段1 + 阶段2）

````
src/
├── data/                          # 数据定义
│   ├── antdTokens.ts             # Token 类型和加载
│   └── tokenMetadata.ts          # Token 元数据
├── tokenManager/                  # Token 管理
│   ├── tokenRegistry.ts          # Token 注册表
│   ├── themeManager.ts           # 主题管理器
│   ├── cssParser.ts              # CSS 解析器
│   └── tokenScanner.ts           # Token 扫描器 ✨ 新增
├── providers/                     # 功能提供者 ✨ 新增
│   ├── colorDecorator.ts         # 颜色装饰器
│   └── documentDecorationManager.ts  # 装饰管理器
├── utils/                         # 工具函数 ✨ 新增
│   ├── config.ts                 # 配置管理
│   └── performance.ts            # 性能监控
├── assets/css/                    # 内置 Token
│   ├── antd-light-theme.css
│   └── antd-dark-theme.css
└── test/                          # 测试文件
    ├── tokenManager/              # 管理器测试
    ├── providers/                 # 提供者测试 ✨ 新增
    └── integration/               # 集成测试

## 数据统计

- 支持 Token 数量：542（Light 271 + Dark 271）
- 颜色类 Token：200+
- 带语义描述：100+
- 自动分类准确率：> 95%

## 开发与测试

### 安装依赖

```bash
pnpm install
````

### 编译项目

```bash
pnpm run compile
```

### 运行测试

```bash
pnpm test
```

### 开发调试

按 `F5` 启动调试，会打开一个新的 VS Code 窗口加载插件。

## 使用示例

```typescript
import { tokenRegistry, themeManager } from './tokenManager';

// 查询 Token
const token = tokenRegistry.get(
  '--ant-color-primary',
  themeManager.getCurrentTheme()
);

console.log(token?.value); // '#1677ff' (light)
console.log(token?.description); // '品牌主色'

// 搜索 Token
const colorTokens = tokenRegistry.search('color');

// 监听主题变化
themeManager.onThemeChange((theme) => {
  console.log('Theme changed to:', theme);
});
```

## 开发进度

- [x] 阶段1：Token 数据层（已完成）
- [ ] 阶段2：颜色可视化
- [ ] 阶段3：Hover 提示
- [ ] 阶段4：自动补全
- [ ] 阶段5：自定义 Token

详见 [docs/开发计划.md](docs/开发计划.md)

## 开发文档

- [需求说明](docs/需求说明.md)
- [开发计划](docs/开发计划.md)
- [阶段1完成总结](docs/阶段1-完成总结.md)

## License

MIT
