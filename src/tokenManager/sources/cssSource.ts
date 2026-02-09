/**
 * CSS 文件 Token 数据源
 * 从 CSS 文件解析 CSS 变量
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTokenSource } from './baseSource';
import { SourceType, SourceConfig, ExtendedTokenInfo } from '../sourceTypes';
import { CSSParser } from '../cssParser';

export class CSSTokenSource extends BaseTokenSource {
  private fileWatcher?: vscode.FileSystemWatcher;
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(config: SourceConfig) {
    super(SourceType.CSS, config);

    if (config.watch && config.filePath) {
      this.setupFileWatcher(config.filePath);
    }
  }

  async load(): Promise<ExtendedTokenInfo[]> {
    if (!this.config.filePath) {
      throw new Error('CSS file path is required');
    }

    try {
      const content = await this.readFile(this.config.filePath);
      const tokens = await this.parseCSS(content, this.config.filePath);

      console.log(
        `[CSSSource] Loaded ${tokens.length} tokens from ${this.config.filePath}`
      );
      return tokens;
    } catch (error) {
      console.error(`[CSSSource] Load failed:`, error);
      throw error;
    }
  }

  async validate(): Promise<boolean> {
    if (!this.config.enabled || !this.config.filePath) {
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
    return `CSS 文件: ${path.basename(this.config.filePath || '')}`;
  }

  private async readFile(filePath: string): Promise<string> {
    // 尝试使用 VS Code workspace API
    const uri = vscode.Uri.file(filePath);
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      return document.getText();
    } catch {
      // 降级到 Node.js fs
      return await fs.readFile(filePath, 'utf-8');
    }
  }

  private async parseCSS(
    content: string,
    filePath: string
  ): Promise<ExtendedTokenInfo[]> {
    const tokens: ExtendedTokenInfo[] = [];
    const parser = new CSSParser();

    // 解析 CSS 内容
    const variables = parser.extractVariables(content);
    const resolved = parser.resolveVariableReferences(variables);

    for (const [name, value] of Object.entries(resolved)) {
      const normalizedName = this.normalizeTokenName(name);

      // 检测主题（基于文件名或内容）
      const theme = this.detectTheme(filePath, content);

      // 检测分类
      const category = this.detectCategory(normalizedName, value) as any;

      tokens.push({
        name: normalizedName,
        value: value.trim(),
        theme,
        category,
        source: 'custom', // 兼容现有 TokenInfo 类型
        sourceType: SourceType.CSS,
        sourceFile: filePath,
        priority: this.config.priority,
        isColor: this.isColorValue(value)
      });
    }

    return tokens;
  }

  private detectTheme(filePath: string, content: string): 'light' | 'dark' {
    const fileName = path.basename(filePath).toLowerCase();

    // 从文件名检测
    if (fileName.includes('dark')) {
      return 'dark';
    }
    if (fileName.includes('light')) {
      return 'light';
    }

    // 从内容检测（查找注释或选择器）
    if (content.includes('[data-theme="dark"]') || content.includes('.dark')) {
      return 'dark';
    }

    // 默认为 light
    return 'light';
  }

  private setupFileWatcher(filePath: string): void {
    const pattern = new vscode.RelativePattern(
      path.dirname(filePath),
      path.basename(filePath)
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.fileWatcher.onDidChange(() => {
      console.log(`[CSSSource] File changed: ${filePath}`);
      this.onDidChangeEmitter.fire();
    });

    this.fileWatcher.onDidDelete(() => {
      console.log(`[CSSSource] File deleted: ${filePath}`);
      this.onDidChangeEmitter.fire();
    });

    this.disposables.push(this.fileWatcher, this.onDidChangeEmitter);
  }

  dispose(): void {
    super.dispose();
    this.fileWatcher?.dispose();
  }
}
