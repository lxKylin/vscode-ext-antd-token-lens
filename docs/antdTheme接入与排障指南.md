# 使用指南：antdTheme 接入、命名主题预览与排障

这份指南是阶段 7 面向真实项目接入的主文档，重点回答三类问题：

- 什么时候应该使用 `antdTheme`
- `designToken`、`themeConfig`、`filePath` 应该怎么选
- 主题源不生效时，应该先看哪里、怎么定位

如果你只是第一次安装扩展，先看仓库根目录 README；如果你已经准备把项目里的 Ant Design 主题配置接进插件，优先看本文。

## 1. `antdTheme` 解决什么问题

内置 `builtin` 数据源提供的是官方默认 light / dark Token，`css` / `less` / `scss` 数据源解决的是“项目里已经落地成 CSS 变量的 Token”。

`antdTheme` 解决的是另一类问题：你的主题还停留在 Ant Design 的 `ThemeConfig` 或 `Design Token` 配置里，还没有提前导出成 CSS 变量，但你希望 Hover、Completion、颜色装饰、数值装饰、JS / TS Token 支持都能看到这套主题的最终静态结果。

它会基于项目本地安装的 `antd` 调用 `theme.getDesignToken()`，把结果并入插件当前的数据源体系。

## 2. 先选哪种输入方式

### 推荐选择顺序

| 输入方式      | 适合场景                                                          | 优点                         | 代价                             |
| ------------- | ----------------------------------------------------------------- | ---------------------------- | -------------------------------- |
| `designToken` | 只想覆盖少量 seed token，例如品牌色、圆角、字号                   | 最轻量，配置最短             | 只能表达 `token` 层级            |
| `themeConfig` | 需要表达完整静态主题对象，例如 `token`、`algorithm`、`components` | 与 Ant Design 配置结构最接近 | 配置写在 settings 中会更长       |
| `filePath`    | 项目里已经有独立主题文件，想直接复用                              | 避免在 settings 中重复维护   | 主题文件必须满足“纯对象导出”约束 |

### 实际解析优先级

同一个 `antdTheme` source 如果同时配置了多个输入字段，插件会始终按下面顺序选择：

`themeConfig` > `designToken` > `filePath`

这意味着：

- 配了 `themeConfig` 时，会直接忽略同一 source 上的 `designToken` 与 `filePath`
- 没有 `themeConfig` 但有 `designToken` 时，会自动包装为 `{ token: designToken }`
- 只有前两者都不存在时，才会去读取 `filePath`

如果你误配了多个入口，`Ant Design Token Lens: 查看 Token 数据源` 里会把低优先级入口标成 warning，方便你回头清理配置。

## 3. 推荐配置写法

### 单主题品牌色：优先用 `designToken`

```json
{
  "antdToken.sources": [
    {
      "type": "antdTheme",
      "id": "brand-light",
      "themeName": "brand-light",
      "baseTheme": "light",
      "designToken": {
        "colorPrimary": "#13c2c2",
        "borderRadius": 10
      }
    }
  ]
}
```

适合“只改几项品牌 seed token”的项目。

### Light / Dark 双主题：优先用 `themeConfig`

```json
{
  "antdToken.sources": [
    {
      "type": "antdTheme",
      "id": "brand-light",
      "themeName": "brand-light",
      "baseTheme": "light",
      "priority": 5,
      "themeConfig": {
        "token": {
          "colorPrimary": "#1677ff",
          "borderRadius": 8
        }
      }
    },
    {
      "type": "antdTheme",
      "id": "brand-dark",
      "themeName": "brand-dark",
      "baseTheme": "dark",
      "priority": 5,
      "themeConfig": {
        "token": {
          "colorPrimary": "#177ddc"
        },
        "algorithm": ["dark"]
      }
    }
  ]
}
```

适合“同一个品牌下同时维护 light / dark 结果”的项目。

### 多品牌并列：复用项目文件时用 `filePath`

```json
{
  "antdToken.sources": [
    {
      "type": "antdTheme",
      "id": "brand-a-light",
      "themeName": "brand-a-light",
      "baseTheme": "light",
      "filePath": "src/theme/brandA/light.ts",
      "exportName": "themeConfig",
      "watch": true
    },
    {
      "type": "antdTheme",
      "id": "brand-b-dark",
      "themeName": "brand-b-dark",
      "baseTheme": "dark",
      "filePath": "src/theme/brandB/dark.ts",
      "exportName": "themeConfig",
      "watch": true
    }
  ]
}
```

适合已有多套主题文件、想保持主题定义和业务代码放在一起维护的项目。

## 4. `filePath` 文件应该怎么写

### 支持的写法：纯对象导出

```ts
import { theme } from 'antd';

export const themeConfig = {
  token: {
    colorPrimary: '#1677ff'
  },
  algorithm: [theme.darkAlgorithm]
};
```

```ts
export default {
  token: {
    colorPrimary: '#13c2c2'
  }
};
```

### 不支持的写法：函数、运行时逻辑、异步逻辑

```ts
export const createTheme = () => ({
  token: {
    colorPrimary: process.env.BRAND_COLOR ?? '#1677ff'
  }
});
```

```ts
export default async function loadTheme() {
  const response = await fetch('/theme.json');
  return response.json();
}
```

当前阶段只支持静态可解析的纯对象，不会执行函数，不会等待异步逻辑，也不会推导运行时副作用。

## 5. 如何组织命名主题

### `baseTheme` 与命名主题的关系

- `baseTheme` 仍然只有 `light` 或 `dark` 两个值，用来表达这套命名主题属于哪一类基础主题
- `themeName` / `id` 才是命名主题真正的区分维度，例如 `brand-a-light`、`brand-a-dark`、`brand-b-light`
- 当前活动命名主题决定 Hover、Completion、颜色装饰、数值装饰、JS / TS Token 支持优先展示哪一套值

可以把 `baseTheme` 理解成“归类”，把命名主题理解成“实际预览目标”。

### 推荐命名方式

- 单品牌双主题：`brand-light`、`brand-dark`
- 多品牌并列：`brand-a-light`、`brand-a-dark`、`brand-b-light`、`brand-b-dark`
- 纯品牌变体：`brand-a`、`brand-b`，再用 `baseTheme` 标记它们归属 light / dark

## 6. 如何切换主题预览

### 什么时候用 `toggleThemePreview`

执行 `Ant Design Token Lens: 切换主题预览` 时，插件只会在基础 `light` / `dark` 之间快速切换。

适合：

- 你只关心基础亮暗主题
- 你想快速确认当前 token 在 light 和 dark 下的差异

### 什么时候用 `selectThemePreview`

执行 `Ant Design Token Lens: 选择命名主题预览` 时，可以显式切到某一个命名主题，例如 `brand-a-dark`。

适合：

- 你有多套命名主题并列存在
- 你需要精确查看某个品牌、某个变体下的值
- 你需要从显式预览切回默认自动预览

### 清除命名主题预览后会怎样

在 `选择命名主题预览` 面板中选“自动 / 默认预览”后，插件会清除显式 preview theme，回到当前基础主题的默认结果。

旧的 light / dark 预览能力没有被删除；只是从阶段 7 开始，light / dark 不再是唯一主题维度。

## 7. 主题切换会影响哪些链路

命名主题预览会同步影响：

- Hover
- Completion
- 颜色装饰
- 数值装饰
- JavaScript / TypeScript 中的 `token.xxx` 支持

如果同一个 token 在多个命名主题下值不同：

- Hover 会优先展示当前活动命名主题
- 其他命名主题的值会继续作为补充结果显示
- 排序会优先当前主题，其次同基础主题的兼容结果，再展示其他命名主题

## 8. 数据源如何共存

当前数据源模型是叠加关系，不是互斥关系。以下 source 可以同时存在：

- `builtin`
- `css`
- `less`
- `scss`
- `antdTheme`

常见组合方式：

- 用 `builtin` 兜底官方默认 token
- 用 `antdTheme` 提供项目级静态主题结果
- 用 `css` / `less` / `scss` 补充已经落地成 CSS 变量的覆盖值

当多个数据源提供同名 token 时，仍按 source priority 决定最终采用哪一个值。

## 9. 出问题时先看哪里

### 第一步：查看数据源状态

先执行 `Ant Design Token Lens: 查看 Token 数据源`。

它会显示每个 source 最近一次运行结果。对于 `antdTheme`，重点看这些字段：

| 字段                                  | 怎么理解                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| `状态`                                | 成功、警告、失败                                              |
| `Theme Name`                          | 当前 source 贡献的主题显示名                                  |
| `Base Theme`                          | 归属 `light` 还是 `dark`                                      |
| `Themes`                              | 当前 source 实际注册到 ThemeManager 的命名主题列表            |
| `配置入口`                            | 本次实际采用的是 `themeConfig`、`designToken` 还是 `filePath` |
| `主题文件/来源`                       | inline 还是具体文件路径                                       |
| `Export Name`                         | 文件模式下实际使用的导出名                                    |
| `antd Version`                        | 解析到的项目本地 antd 版本                                    |
| `antd Package Path`                   | 实际命中的 antd 包路径                                        |
| `最近一次 Token 数量`                 | 本次加载实际注入了多少 token                                  |
| `最近一次错误码` / `最近一次错误说明` | 最近失败或 warning 的直接原因                                 |
| `警告`                                | 低优先级入口被忽略、配置不规范等非致命问题                    |

### 第二步：重新加载并看摘要

执行 `Ant Design Token Lens: 重新加载 Token 数据源`。

如果有错误，命令会直接给出“成功 / 警告 / 失败”摘要，并提醒你继续回到“查看 Token 数据源”定位详情。

## 10. 常见失败场景与排查方式

### 1. 三个输入都没配

- 典型现象：source 直接失败，没有 token 产出
- 先看哪里：`查看 Token 数据源` 中的 `最近一次错误说明`
- 修复方式：至少提供 `themeConfig`、`designToken`、`filePath` 之一

### 2. `filePath` 路径错误

- 典型现象：状态为失败，`主题文件/来源` 指向的文件不存在
- 先看哪里：`最近一次错误说明`、`主题文件/来源`
- 修复方式：把路径改成相对工作区根目录的真实文件路径

### 3. `exportName` 不匹配

- 典型现象：文件存在，但提示未找到指定导出
- 先看哪里：`Export Name`、`最近一次错误说明`
- 修复方式：确认文件里真有对应的命名导出，或者删除 `exportName` 让插件回退到默认导出 / `themeConfig`

### 4. 导出值是函数

- 典型现象：文件可读，但报“只支持纯对象”或导出不可解析
- 先看哪里：`最近一次错误说明`
- 修复方式：改成静态对象导出，不要导出工厂函数

### 5. 导出值不是纯对象

- 典型现象：导出里包含运行时表达式、实例、数组根值或其他不可静态提取结构
- 先看哪里：`最近一次错误说明`
- 修复方式：把导出收敛为普通对象字面量；复杂逻辑留在业务代码里，不要直接给插件解析

### 6. 工作区里没有安装 `antd`

- 典型现象：`antdTheme` source 失败，且显示 antd 解析失败
- 先看哪里：`antd Version`、`antd Package Path`、`解析起点`
- 修复方式：在当前工作区安装项目本地 `antd`。插件不会静默回退到扩展内置版本

### 7. `algorithm` 标记无法识别

- 典型现象：source 能加载，但带 warning 或 error
- 先看哪里：`算法摘要`、`警告`、`最近一次错误说明`
- 修复方式：仅使用当前支持的 `default`、`dark`、`compact`，或使用可识别的 Ant Design 算法引用

### 8. watcher 已触发，但新内容不可解析

- 典型现象：改完主题文件后 source 重新加载，但状态变成 warning 或 error
- 先看哪里：先执行 `重新加载 Token 数据源`，再查看 `最近一次错误说明`
- 修复方式：回到最近一次改动，检查文件是否仍然是纯对象、导出名是否变化、算法字段是否写错

## 11. 能力边界

当前阶段已支持：

- 项目本地 `antd` + 静态 `ThemeConfig` / `designToken` 生成 token
- 多命名主题并列注册与显式预览
- source diagnostics、reload 摘要与状态查看
- Hover、Completion、Decorator、JS / TS Token 支持跟随当前命名主题刷新

当前阶段仍不支持：

- 运行时局部 `ConfigProvider` 继承链推断
- 复杂业务逻辑主题推导
- 依赖运行时副作用、环境变量或异步逻辑的主题文件
- 组件级 token 的独立索引与展示模型

## 12. 给旧用户的迁移建议

- 之前只用 `light` / `dark` 预览的工作流仍然有效，可以继续使用 `切换主题预览`
- 当你需要精确比较多套品牌主题时，再引入 `选择命名主题预览`
- `baseTheme` 仍然重要，但现在它只是命名主题的基础归类，不再代表全部主题语义

## 13. 建议阅读顺序

1. 先看仓库 README，完成基础安装与最小配置
2. 再看本文，决定是用 `designToken`、`themeConfig` 还是 `filePath`
3. 真正遇到问题时，先执行 `查看 Token 数据源`，再回到本文的排障章节
