import * as vscode from 'vscode';
import { TokenScanner } from '@/tokenManager/tokenScanner';
import { ColorDecorator } from './colorDecorator';
import { Config } from '@/utils/config';
import { debounce, PerformanceMonitor } from '@/utils/performance';

/**
 * 文档装饰管理器
 * 负责管理编辑器的装饰生命周期
 */
export class DocumentDecorationManager {
  private disposables: vscode.Disposable[] = [];
  private updateTimeout: NodeJS.Timeout | undefined;
  private readonly UPDATE_DELAY = 300; // 防抖延迟（毫秒）

  constructor(
    private scanner: TokenScanner,
    private decorator: ColorDecorator
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
        if (event.affectsConfiguration('antdToken.colorDecorator')) {
          this.refreshAllEditors();
        }
      })
    );

    // 延迟初始化，确保配置已加载
    setTimeout(() => {
      // 初始化当前编辑器
      if (vscode.window.activeTextEditor) {
        this.updateEditor(vscode.window.activeTextEditor);
      }

      // 初始化所有可见编辑器
      vscode.window.visibleTextEditors.forEach((editor) => {
        this.updateEditor(editor);
      });
    }, 100);
  }

  /**
   * 更新编辑器装饰
   */
  private updateEditor(editor: vscode.TextEditor): void {
    // 检查是否启用装饰器
    const enabled = Config.getDecoratorEnabled();

    if (!enabled) {
      this.decorator.clear(editor);
      return;
    }

    // 检查是否支持该文件类型
    if (!this.scanner.isSupportedDocument(editor.document)) {
      return;
    }

    // 执行扫描和装饰
    PerformanceMonitor.measure(
      `updateEditor:${editor.document.fileName}`,
      () => {
        const matches = this.scanner.scanDocument(editor.document);
        this.decorator.decorate(editor, matches);
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
    this.decorator.refresh();

    // 重新装饰所有可见编辑器
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.updateEditor(editor);
    });
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
    this.decorator.dispose();
  }
}
