# Change Log

All notable changes to the "ant-design-token-lens" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.4.0] - 2026-03-15

### Added

- 新增 `antdTheme` 数据源，支持基于项目本地 `antd` 的 `theme.getDesignToken()` 读取静态主题结果
- 新增三种 `antdTheme` 输入方式：`themeConfig`、`designToken`、`filePath`
- 新增 `ThemeConfigLoader`，支持按 `themeConfig > designToken > filePath` 的优先级解析主题输入
- 新增结构化 source diagnostics / status 模型，用于记录数据源 health、错误码、warning、token 数量、耗时和主题元数据
- 新增命令 `antdToken.showSources`，可查看每个数据源最近一次加载状态、错误原因和主题信息
- 新增命令 `antdToken.reloadSources`，支持重新加载所有数据源并输出成功 / 警告 / 失败摘要
- 新增命令 `antdToken.selectThemePreview`，支持显式切换到某个命名主题，或恢复自动 / 默认预览
- 新增多命名主题模型，支持在同一工作区内并列注册多套主题结果
- 新增面向真实项目接入的 `antdTheme` 使用与排障指南

### Changed

- `antdToken.toggleThemePreview` 保持 Light / Dark 快速切换语义，同时兼容新的命名主题预览模型
- Hover、Completion、颜色装饰、非颜色数值装饰、JavaScript / TypeScript Token 支持现在会跟随当前命名主题预览结果刷新
- `showSources` 展示内容增强，`antdTheme` 数据源会额外显示 `themeName`、`baseTheme`、实际采用的配置入口、解析到的 `antd` 信息、最近错误与 warning
- README、docs 和 CHANGELOG 已统一为阶段 8 的对外说明，补齐 `antdTheme` 接入、命名主题预览、source diagnostics、多 source 共存和限制边界

### Notes

- 当前仅支持项目本地安装的 `antd`，不会回退到扩展内置版本
- `filePath` 仅支持静态可解析的纯对象导出，不支持函数导出、异步逻辑、运行时副作用或局部 `ConfigProvider` 继承链推断

## [0.3.0] - 2026-03-14

### Added

- 新增非颜色 Token 行内数值展示能力，支持在编辑器中直接显示 `size`、`font`、`motion`、`opacity`、`zIndex` 等 Token 的当前值
- 新增配置项 `antdToken.valueDecorator.enabled`
- 新增配置项 `antdToken.valueDecorator.position`
- 新增配置项 `antdToken.valueDecorator.maxLength`
- 新增配置项 `antdToken.valueDecorator.categories`
- 新增配置项 `antdToken.valueDecorator.mode`

### Changed

- 装饰器体系扩展为可组合模式，颜色装饰与非颜色值装饰可同时工作
- 非颜色 Token 在 CSS 与 JavaScript/TypeScript 场景中复用同一套展示与格式化逻辑

## [0.2.1] - 2026-03-05

- 修复任意字母+ ( 即可触发补全

## [0.2.0] - 2026-02-28

- JavaScript/TypeScript Token 支持（`token.colorPrimary`，`token`支持别名）
  - 颜色装饰：与 CSS Token 相同的背景高亮风格
  - Hover 提示：悬停显示颜色预览、当前属、描述、类别
  - 代码补全：`token.` 触发 camelCase 名称补全
- 新增配置项 `antdToken.enableJsSupport`（默认开启）
- 支持配置变更时动态启用/禁用 JS/TS Token 功能

## [0.1.2] - 2026-02-27

- 修复 ES 模块冲突

## [0.1.1] - 2026-02-27

- 修改插件 icon
- 移除拼音搜索

## [0.1.0] - 2026-02-26

- 优化补全提示
- 添加 Token 数据源，可添加自定义Token
- VSCode 依赖版本调整为 `1.105.1`及以上
- 添加对 Tailwind CSS 中 bg-(--xx) 这种格式的支持
