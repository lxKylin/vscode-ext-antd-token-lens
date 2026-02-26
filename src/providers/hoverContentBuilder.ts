import * as vscode from 'vscode';
import { TokenInfo, TokenRegistry } from '@/tokenManager/tokenRegistry';
import { ThemeManager } from '@/tokenManager/themeManager';
import { Config } from '@/utils/config';
import { ColorConverter, ColorFormats } from '@/utils/colorConverter';
import { ColorContrast } from '@/utils/colorContrast';

/**
 * Hover 内容构建器
 * 负责构建美观、信息丰富的 Hover 信息面板
 */
export class HoverContentBuilder {
  private readonly cache = new Map<string, vscode.MarkdownString>();
  private cacheVersion = 0;

  constructor(
    private readonly tokenRegistry: TokenRegistry,
    private readonly themeManager: ThemeManager
  ) {
    // 监听主题变化，清除缓存
    this.themeManager.onThemeChange(() => {
      this.clearCache();
    });
  }

  /**
   * 构建 Hover 内容
   * @param tokenName Token 名称
   * @returns MarkdownString
   */
  build(tokenName: string): vscode.MarkdownString | undefined {
    // 检查缓存
    const cacheKey = this.getCacheKey(tokenName);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 构建内容
    const content = this.buildContent(tokenName);

    // 缓存结果
    if (content) {
      this.cache.set(cacheKey, content);
    }

    return content;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(tokenName: string): string {
    const theme = this.themeManager.getCurrentTheme();
    const verbosity = Config.getHoverVerbosity();
    return `${tokenName}:${theme}:${verbosity}:${this.cacheVersion}`;
  }

  /**
   * 清除缓存
   */
  private clearCache(): void {
    this.cache.clear();
    this.cacheVersion++;
  }

  /**
   * 构建内容（原 build 方法的逻辑）
   */
  private buildContent(tokenName: string): vscode.MarkdownString | undefined {
    const currentTheme = this.themeManager.getCurrentTheme();
    const tokenInfo = this.tokenRegistry.get(tokenName, currentTheme);

    if (!tokenInfo) {
      return this.buildNotFoundContent(tokenName);
    }

    const verbosity = Config.getHoverVerbosity();
    const markdown = new vscode.MarkdownString('', true);
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    // 构建不同详细程度的内容
    switch (verbosity) {
      case 'minimal':
        this.buildMinimalContent(markdown, tokenInfo);
        break;
      case 'detailed':
        this.buildDetailedContent(markdown, tokenInfo, tokenName);
        break;
      case 'normal':
      default:
        this.buildNormalContent(markdown, tokenInfo, tokenName);
        break;
    }

    return markdown;
  }

  /**
   * 构建简洁版内容
   */
  private buildMinimalContent(
    markdown: vscode.MarkdownString,
    tokenInfo: TokenInfo
  ): void {
    // Token 名称
    markdown.appendMarkdown(`**Token**: \`${tokenInfo.name}\`\n\n`);

    // 当前值
    if (tokenInfo.isColor) {
      markdown.appendMarkdown(
        `**值**: ${this.renderColorValue(tokenInfo.value)}\n`
      );
    } else {
      markdown.appendMarkdown(`**值**: \`${tokenInfo.value}\`\n`);
    }
  }

  /**
   * 构建标准版内容
   */
  private buildNormalContent(
    markdown: vscode.MarkdownString,
    tokenInfo: TokenInfo,
    tokenName: string
  ): void {
    // 标题
    markdown.appendMarkdown(`### 🎨 ${tokenInfo.name}\n\n`);

    // 语义说明
    if (tokenInfo.description) {
      markdown.appendMarkdown(`**语义**: ${tokenInfo.description}\n\n`);
    }

    // 当前主题值
    const currentTheme = this.themeManager.getCurrentTheme();
    markdown.appendMarkdown(`**当前主题 (${currentTheme})**: `);

    if (tokenInfo.isColor) {
      markdown.appendMarkdown(`${this.renderColorValue(tokenInfo.value)}\n\n`);
    } else {
      markdown.appendMarkdown(`\`${tokenInfo.value}\`\n\n`);
    }

    // 多主题对比
    if (Config.getShowMultiTheme() && tokenInfo.isColor) {
      this.buildThemeComparison(markdown, tokenName);
    }

    // 颜色格式转换
    if (Config.getShowColorFormats() && tokenInfo.isColor) {
      this.buildColorFormats(markdown, tokenInfo.value);
    }

    // 来源信息
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(
      `**来源**: ${this.getSourceLabel(tokenInfo.source)}\n`
    );

    // 分类标签
    if (tokenInfo.category) {
      markdown.appendMarkdown(`**分类**: \`${tokenInfo.category}\`\n`);
    }
  }

  /**
   * 构建详细版内容
   */
  private buildDetailedContent(
    markdown: vscode.MarkdownString,
    tokenInfo: TokenInfo,
    tokenName: string
  ): void {
    // 包含标准版内容
    this.buildNormalContent(markdown, tokenInfo, tokenName);

    // 添加额外信息
    markdown.appendMarkdown(`\n---\n\n`);

    // 相关 Token
    const relatedTokens = this.getRelatedTokens(tokenName);
    if (relatedTokens.length > 0) {
      markdown.appendMarkdown(`**相关 Token**:\n\n`);
      relatedTokens.forEach((related) => {
        const currentTheme = this.themeManager.getCurrentTheme();
        const relatedTokenInfo = this.tokenRegistry.get(related, currentTheme);
        if (relatedTokenInfo && relatedTokenInfo.isColor) {
          markdown.appendMarkdown(
            `- ${this.renderColorValue(relatedTokenInfo.value)} ${related}\n`
          );
        } else {
          markdown.appendMarkdown(`- ${related}\n`);
        }
      });
      markdown.appendMarkdown(`\n`);
    }

    // 快捷操作
    markdown.appendMarkdown(`**快捷操作**:\n\n`);
    markdown.appendMarkdown(
      `- [📋 复制值](command:antdToken.copyTokenValue?${encodeURIComponent(JSON.stringify([tokenName]))})\n`
    );
    markdown.appendMarkdown(
      `- [🔍 查找所有引用](command:antdToken.findReferences?${encodeURIComponent(JSON.stringify([tokenName]))})\n`
    );
  }

  /**
   * 构建未找到提示
   */
  private buildNotFoundContent(tokenName: string): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString('', true);
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    markdown.appendMarkdown(`### ⚠️ Token 未找到\n\n`);
    markdown.appendMarkdown(`Token \`${tokenName}\` 未在注册表中找到。\n\n`);
    markdown.appendMarkdown(`可能的原因：\n\n`);
    markdown.appendMarkdown(`- Token 名称拼写错误\n`);
    markdown.appendMarkdown(`- 需要更新 Token 数据源\n`);
    markdown.appendMarkdown(`- 这是一个自定义 Token\n\n`);
    markdown.appendMarkdown(
      `[🔄 刷新 Token 数据](command:antdToken.refreshTokens)\n`
    );

    return markdown;
  }

  /**
   * 构建主题对比
   */
  private buildThemeComparison(
    markdown: vscode.MarkdownString,
    tokenName: string
  ): void {
    markdown.appendMarkdown(`**多主题对比**:\n\n`);

    const lightToken = this.tokenRegistry.get(tokenName, 'light');
    const darkToken = this.tokenRegistry.get(tokenName, 'dark');

    if (lightToken) {
      markdown.appendMarkdown(
        `- Light: ${this.renderColorValue(lightToken.value)}\n`
      );
    }

    if (darkToken) {
      markdown.appendMarkdown(
        `- Dark: ${this.renderColorValue(darkToken.value)}\n`
      );
    }

    markdown.appendMarkdown(`\n`);
  }

  /**
   * 构建颜色格式转换
   */
  private buildColorFormats(
    markdown: vscode.MarkdownString,
    colorValue: string
  ): void {
    const formats = ColorConverter.convertToAllFormats(colorValue);

    if (!formats) {
      return;
    }

    markdown.appendMarkdown(`**颜色格式**:\n\n`);
    markdown.appendMarkdown(`- HEX: ${this.renderColorValue(formats.hex)}\n`);
    markdown.appendMarkdown(`- RGB: ${this.renderColorValue(formats.rgb)}\n`);
    markdown.appendMarkdown(`- HSL: ${this.renderColorValue(formats.hsl)}\n`);

    // 如果有透明度，显示带 alpha 的格式
    if (formats.rgba !== formats.rgb) {
      markdown.appendMarkdown(
        `- RGBA: ${this.renderColorValue(formats.rgba)}\n`
      );
      markdown.appendMarkdown(
        `- HSLA: ${this.renderColorValue(formats.hsla)}\n`
      );
    }

    markdown.appendMarkdown(`\n`);
  }

  /**
   * 渲染颜色值（增强版）
   */
  private renderColorValue(colorValue: string): string {
    // 检查是否为有效颜色
    if (!ColorConverter.isValidColor(colorValue)) {
      return `${colorValue}`;
    }

    // 创建一个 SVG 颜色块
    const isDark = ColorConverter.isDark(colorValue);
    const borderColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

    // 使用 SVG 作为 data URL 来显示颜色块
    const svg = `<svg width="14" height="14" xmlns="http://www.w3.org/2000/svg"><rect width="14" height="14" fill="${colorValue}" stroke="${borderColor}" stroke-width="1" rx="2"/></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    return `![color](${dataUrl}) ${colorValue}`;
  }

  /**
   * 获取来源标签
   */
  private getSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      builtin: 'Ant Design 官方',
      custom: '自定义',
      css: 'CSS 文件',
      js: 'JS/TS 文件'
    };
    return labels[source] || source;
  }

  /**
   * 获取相关 Token
   */
  private getRelatedTokens(tokenName: string): string[] {
    // 基于 Token 名称模式查找相关 Token
    // 例如: --ant-color-primary 相关的有 --ant-color-primary-hover 等
    const baseName = tokenName.replace(
      /-hover|-active|-disabled|-bg|-border$/g,
      ''
    );
    const allTokens = this.tokenRegistry.getAllTokenNames();

    return allTokens
      .filter((name) => name !== tokenName && name.startsWith(baseName))
      .slice(0, 5); // 最多显示 5 个相关 Token
  }
}
