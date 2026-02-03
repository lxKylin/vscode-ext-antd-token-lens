# Ant Design CSS Token VS Code 插件

一款让 Ant Design CSS Token 在 VS Code 中「可见、可理解、可操作」的插件。

## 项目介绍

在使用 Ant Design v5/v6 进行前端开发时，CSS Token（如 `--ant-color-primary`）是抽象的，开发者无法直观看到真实颜色效果。本插件旨在解决这个痛点，让 Token 使用更加直观和高效。

## 功能特性

### ✅ 已完成（阶段1 + 阶段2 + 阶段3 + 阶段4）

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

#### 阶段3：Hover 信息提示

- ✅ **智能悬浮提示**：鼠标悬停显示 Token 详细信息
- ✅ **多主题对比**：同时显示 Light 和 Dark 主题的颜色值
- ✅ **颜色格式转换**：HEX、RGB、HSL 等多种格式
- ✅ **颜色预览增强**：带边框的颜色块，直观清晰
- ✅ **分级信息展示**：Minimal、Normal、Detailed 三种模式
- ✅ **快捷命令**：复制值、查找引用、切换主题等
- ✅ **性能优化**：缓存机制、防抖处理，响应 < 100ms
- ✅ **完善测试**：72 个测试用例全部通过

#### 阶段4：智能自动补全 🆕

- ✅ **智能触发**：输入 `var(--` 或 `--ant` 自动弹出补全
- ✅ **上下文感知**：根据位置自动选择正确的插入格式
- ✅ **拼音搜索**：支持中文拼音首字母搜索（如：输入 `pp` 找到"品牌主色"）
- ✅ **智能排序**：最近使用优先、完全匹配优先、分类优先
- ✅ **丰富信息**：显示 Token 名称、描述、当前值、颜色预览
- ✅ **性能优化**：多级缓存、增量过滤，响应 < 200ms
- ✅ **Snippet 支持**：自动插入 `var()` 语法，支持 fallback 参数
- ✅ **高度可配置**：详细程度、最近使用、拼音搜索等多项配置

### 📅 计划中（阶段5+）

- Token 数据源管理：自定义 Token 支持
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

### Hover 信息提示 🆕

将鼠标悬停在任何 `var(--ant-*)` Token 上，查看详细信息：

- **Token 名称和语义**：了解 Token 的用途
- **当前主题值**：查看当前主题下的实际值
- **多主题对比**：同时显示 Light 和 Dark 主题的值
- **颜色格式转换**：HEX、RGB、HSL 等多种格式
- **颜色预览**：直观的颜色块显示
- **快捷操作**：复制值、查找引用等

#### Hover 示例

```css
.button {
  color: var(--ant-color-primary);
  /* 悬停后显示：
     🎨 --ant-color-primary
     语义: 品牌主色
     当前主题 (light): 🟦 #1677ff
     多主题对比:
       - Light: 🟦 #1677ff
       - Dark: 🟦 #177ddc
     颜色格式:
       - HEX: #1677FF
       - RGB: rgb(22, 119, 255)
       - HSL: hsl(216, 100%, 54%)
  */
}
```

### 可用命令

打开命令面板（Cmd/Ctrl + Shift + P），输入：

- `Ant Design Token: Toggle Color Decorator` - 启用/禁用颜色装饰器
- `Ant Design Token: Refresh Token Decorations` - 刷新所有装饰
- `Ant Design Token: Toggle Theme Preview` - 切换主题预览（快捷键：`Ctrl+Alt+T` / `Cmd+Alt+T`）
- `Ant Design Token: Refresh Token Data` - 刷新 Token 数据（快捷键：`Ctrl+Alt+R` / `Cmd+Alt+R`）

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
  "antdToken.colorDecorator.size": "medium", // "small" | "medium" | "large"

  // Hover 提示 🆕
  "antdToken.enableHover": true,
  "antdToken.showMultiTheme": true, // 显示多主题对比
  "antdToken.showColorFormats": true, // 显示颜色格式转换
  "antdToken.hoverVerbosity": "normal" // "minimal" | "normal" | "detailed"
}
```

## 技术架构

### 完整架构（阶段1 + 阶段2 + 阶段3）

````
src/
├── data/                          # 数据定义
│   ├── antdTokens.ts             # Token 类型和加载
│   └── tokenMetadata.ts          # Token 元数据
├── tokenManager/                  # Token 管理
│   ├── tokenRegistry.ts          # Token 注册表
│   ├── themeManager.ts           # 主题管理器
│   ├── cssParser.ts              # CSS 解析器
│   └── tokenScanner.ts           # Token 扫描器
├── providers/                     # 功能提供者
│   ├── colorDecorator.ts         # 颜色装饰器
│   ├── documentDecorationManager.ts  # 装饰管理器
│   ├── hoverProvider.ts          # Hover 提供者 ✨ 新增
│   └── hoverContentBuilder.ts    # Hover 内容构建器 ✨ 新增
├── utils/                         # 工具函数
│   ├── config.ts                 # 配置管理
│   ├── performance.ts            # 性能监控
│   ├── colorConverter.ts         # 颜色转换工具 ✨ 新增
│   └── colorContrast.ts          # 颜色对比度工具 ✨ 新增
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

## License

MIT
