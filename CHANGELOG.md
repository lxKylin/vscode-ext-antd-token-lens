# Change Log

All notable changes to the "ant-design-token-lens" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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
