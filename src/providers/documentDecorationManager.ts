import * as vscode from 'vscode';
import { TokenScanner } from '@/tokenManager/tokenScanner';
import { Config } from '@/utils/config';
import { PerformanceMonitor } from '@/utils/performance';
import { TokenDecorator } from './tokenDecorator';

/**
 * 文档装饰管理器
 * 负责管理编辑器的装饰生命周期
 */
export class DocumentDecorationManager {
  private readonly disposables: vscode.Disposable[] = [];
  private updateTimeout: NodeJS.Timeout | undefined;
  private readonly UPDATE_DELAY = 300; // 防抖延迟（毫秒）
  private readonly INITIAL_UPDATE_DELAY = 300;

  constructor(
    private scanner: TokenScanner,
    private readonly decorators: TokenDecorator[]
  ) {
    this.initialize();
  }

  /**
   * 初始化：注册编辑器事件监听
   */
  private initialize(): void {
    // 监听文档打开/切换
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateEditor(editor);
        }
      })
    );

    // 监听文档内容变更
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
          this.scheduleUpdate(editor);
        }
      })
    );

    // 监听可见编辑器变化
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        editors.forEach((editor) => this.updateEditor(editor));
      })
    );

    // 监听配置变化
    this.disposables.push(
      Config.onConfigChange((event) => {
        if (
          this.decorators.some((decorator) =>
            event.affectsConfiguration(decorator.configurationSection)
          )
        ) {
          this.refreshAllEditors();
        }
      })
    );

    // 延迟初始化，确保配置已加载，同时避免在激活阶段集中扫描所有编辑器。
    setTimeout(() => {
      const editors = Array.from(
        new Set([
          ...vscode.window.visibleTextEditors,
          ...(vscode.window.activeTextEditor
            ? [vscode.window.activeTextEditor]
            : [])
        ])
      );

      editors.forEach((editor, index) => {
        setTimeout(() => {
          this.updateEditor(editor);
        }, index * 25);
      });
    }, this.INITIAL_UPDATE_DELAY);
  }

  /**
   * 更新编辑器装饰
   */
  private updateEditor(editor: vscode.TextEditor): void {
    // 检查是否支持该文件类型
    if (!this.scanner.isSupportedDocument(editor.document)) {
      this.decorators.forEach((decorator) => decorator.clear(editor));
      return;
    }

    // 执行扫描和装饰
    PerformanceMonitor.measure(
      `updateEditor:${editor.document.fileName}`,
      () => {
        const matches = this.scanner.scanDocument(editor.document);
        this.decorators.forEach((decorator) => {
          if (!decorator.isEnabled()) {
            decorator.clear(editor);
            return;
          }

          decorator.decorate(editor, matches);
        });
      }
    );
  }

  /**
   * 延迟更新（防抖）
   */
  private scheduleUpdate(editor: vscode.TextEditor): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.updateEditor(editor);
    }, this.UPDATE_DELAY);
  }

  /**
   * 刷新所有编辑器
   */
  private refreshAllEditors(): void {
    // 清除装饰器缓存
    this.decorators.forEach((decorator) => decorator.refresh());

    // 重新装饰所有可见编辑器
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.updateEditor(editor);
    });
  }

  /**
   * 更换扫描器（用于动态替换扫描逻辑）
   */
  updateScanner(scanner: TokenScanner): void {
    this.scanner = scanner;
    this.refreshAllEditors();
  }

  /**
   * 手动刷新装饰
   */
  refresh(): void {
    this.refreshAllEditors();
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.disposables.forEach((d) => d.dispose());
    this.decorators.forEach((decorator) => decorator.dispose());
  }
}
