/**
 * Token 文件自动扫描器
 * 自动扫描项目中的 Token 文件并加载
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SourceManager } from './sourceManager';
import { SourceConfig, SourceType } from './sourceTypes';
import { Config } from '../utils/config';

export class AutoScanner implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private scanResults: Map<string, SourceConfig> = new Map();

  constructor(private sourceManager: SourceManager) {}

  /**
   * 启动自动扫描
   */
  async start(): Promise<void> {
    if (!Config.getEnableAutoScan()) {
      console.log('[AutoScanner] Auto scan is disabled');
      return;
    }

    console.log('[AutoScanner] Starting auto scan...');

    // 执行初始扫描
    await this.scan();

    // 监听文件创建和删除
    this.watchFileChanges();
  }

  /**
   * 扫描项目中的 Token 文件
   */
  async scan(): Promise<void> {
    const patterns = Config.getAutoScanPatterns();
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      console.log('[AutoScanner] No workspace folders');
      return;
    }

    const foundFiles: vscode.Uri[] = [];

    // 查找匹配的文件
    for (const pattern of patterns) {
      try {
        const files = await vscode.workspace.findFiles(
          pattern,
          '**/node_modules/**', // 排除 node_modules
          100 // 限制最多 100 个文件
        );
        foundFiles.push(...files);
      } catch (error) {
        console.error(
          `[AutoScanner] Error scanning pattern ${pattern}:`,
          error
        );
      }
    }

    console.log(
      `[AutoScanner] Found ${foundFiles.length} potential token files`
    );

    // 为每个文件创建数据源配置
    for (const fileUri of foundFiles) {
      await this.processFile(fileUri);
    }
  }

  /**
   * 处理单个文件
   */
  private async processFile(fileUri: vscode.Uri): Promise<void> {
    const filePath = fileUri.fsPath;
    const ext = path.extname(filePath);

    // 确定数据源类型
    let sourceType: SourceType;
    if (['.css', '.less', '.scss', '.sass'].includes(ext)) {
      sourceType = SourceType.CSS;
    } else {
      return; // 不支持的文件类型
    }

    // 创建数据源配置
    const config: SourceConfig = {
      type: sourceType,
      enabled: true,
      priority: 50, // 自动扫描的优先级介于内置和用户配置之间
      filePath,
      watch: true
    };

    const sourceId = `auto:${filePath}`;

    // 检查是否已添加
    if (this.scanResults.has(sourceId)) {
      return;
    }

    // 验证文件内容（确保包含 Token）
    const isValid = await this.validateTokenFile(fileUri, sourceType);
    if (!isValid) {
      return;
    }

    // 添加到数据源管理器
    await this.sourceManager.addSource(config);
    this.scanResults.set(sourceId, config);

    console.log(`[AutoScanner] Added token file: ${filePath}`);
  }

  /**
   * 验证文件是否包含 Token 定义
   */
  private async validateTokenFile(
    fileUri: vscode.Uri,
    sourceType: SourceType
  ): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const content = document.getText();

      switch (sourceType) {
        case SourceType.CSS:
          // 检查是否包含 CSS 变量定义
          return /--[\w-]+\s*:\s*[^;]+;/.test(content);

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * 监听文件变化
   */
  private watchFileChanges(): void {
    const patterns = Config.getAutoScanPatterns();

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      // 文件创建
      watcher.onDidCreate(async (uri) => {
        console.log(`[AutoScanner] File created: ${uri.fsPath}`);
        await this.processFile(uri);
      });

      // 文件删除
      watcher.onDidDelete((uri) => {
        console.log(`[AutoScanner] File deleted: ${uri.fsPath}`);
        const sourceId = `auto:${uri.fsPath}`;
        this.scanResults.delete(sourceId);
        this.sourceManager.removeSource(sourceId);
      });

      this.disposables.push(watcher);
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.scanResults.clear();
  }
}
