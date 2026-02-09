/**
 * JavaScript/TypeScript 配置文件 Token 数据源
 * 从 JS/TS 配置文件解析 theme.token 对象
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTokenSource } from './baseSource';
import { SourceType, SourceConfig, ExtendedTokenInfo } from '../sourceTypes';

export class JavaScriptTokenSource extends BaseTokenSource {
  private fileWatcher?: vscode.FileSystemWatcher;
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(config: SourceConfig) {
    super(SourceType.JAVASCRIPT, config);

    if (config.watch && config.filePath) {
      this.setupFileWatcher(config.filePath);
    }
  }

  async load(): Promise<ExtendedTokenInfo[]> {
    if (!this.config.filePath) {
      throw new Error('JavaScript file path is required');
    }

    try {
      const content = await this.readFile(this.config.filePath);
      const tokens = this.parseJavaScript(content, this.config.filePath);

      console.log(
        `[JSSource] Loaded ${tokens.length} tokens from ${this.config.filePath}`
      );
      return tokens;
    } catch (error) {
      console.error(`[JSSource] Load failed:`, error);
      throw error;
    }
  }

  async validate(): Promise<boolean> {
    if (!this.config.enabled || !this.config.filePath) {
      return false;
    }

    const ext = path.extname(this.config.filePath);
    if (!['.js', '.ts', '.mjs', '.cjs'].includes(ext)) {
      return false;
    }

    try {
      await fs.access(this.config.filePath);
      return true;
    } catch {
      return false;
    }
  }

  getDescription(): string {
    return `JavaScript 配置: ${path.basename(this.config.filePath || '')}`;
  }

  private async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      return document.getText();
    } catch {
      return await fs.readFile(filePath, 'utf-8');
    }
  }

  private parseJavaScript(
    content: string,
    filePath: string
  ): ExtendedTokenInfo[] {
    const tokens: ExtendedTokenInfo[] = [];

    try {
      // 方案1：使用正则提取对象字面量（简单但不完整）
      tokens.push(...this.parseWithRegex(content, filePath));
    } catch (error) {
      console.error('[JSSource] Parse error:', error);
    }

    return tokens;
  }

  private parseWithRegex(
    content: string,
    filePath: string
  ): ExtendedTokenInfo[] {
    const tokens: ExtendedTokenInfo[] = [];

    // 匹配 token: { ... } 对象
    // 例如：token: { colorPrimary: '#1677ff', ... }
    const tokenObjRegex = /token\s*:\s*\{([^}]+)\}/g;
    let match;

    while ((match = tokenObjRegex.exec(content)) !== null) {
      const objContent = match[1];

      // 提取属性
      const propRegex = /([\w]+)\s*:\s*['"]([^'"]+)['"]/g;
      let propMatch;

      while ((propMatch = propRegex.exec(objContent)) !== null) {
        const propName = propMatch[1];
        const propValue = propMatch[2];

        // 转换为 CSS Token 名称
        // colorPrimary -> --ant-color-primary
        const tokenName = this.convertToTokenName(propName);
        const category = this.detectCategory(tokenName, propValue) as any;

        tokens.push({
          name: tokenName,
          value: propValue,
          theme: 'light', // JS 配置默认为 light
          category,
          source: 'custom', // 兼容现有 TokenInfo 类型
          sourceType: SourceType.JAVASCRIPT,
          sourceFile: filePath,
          priority: this.config.priority,
          isColor: this.isColorValue(propValue)
        });
      }
    }

    return tokens;
  }

  private convertToTokenName(propName: string): string {
    // camelCase -> kebab-case
    const kebabCase = propName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();

    return `--ant-${kebabCase}`;
  }

  private setupFileWatcher(filePath: string): void {
    const pattern = new vscode.RelativePattern(
      path.dirname(filePath),
      path.basename(filePath)
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.fileWatcher.onDidChange(() => {
      console.log(`[JSSource] File changed: ${filePath}`);
      this.onDidChangeEmitter.fire();
    });

    this.fileWatcher.onDidDelete(() => {
      console.log(`[JSSource] File deleted: ${filePath}`);
      this.onDidChangeEmitter.fire();
    });

    this.disposables.push(this.fileWatcher, this.onDidChangeEmitter);
  }

  dispose(): void {
    super.dispose();
    this.fileWatcher?.dispose();
  }
}
