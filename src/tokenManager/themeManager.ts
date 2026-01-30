/**
 * 主题管理器
 * 管理当前激活的主题，并在主题切换时通知相关模块
 */

import * as vscode from 'vscode';

export type ThemeMode = 'light' | 'dark';
export type ThemeConfig = 'auto' | 'light' | 'dark';

export class ThemeManager {
  private currentTheme: ThemeMode;
  private listeners: ((theme: ThemeMode) => void)[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // 从 VS Code 检测初始主题
    this.currentTheme = this.detectVSCodeTheme();

    // 监听 VS Code 主题变更
    this.watchVSCodeTheme();

    // 监听配置变更
    this.watchConfiguration();
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): ThemeMode {
    return this.currentTheme;
  }

  /**
   * 手动设置主题（用于测试或用户配置）
   */
  setTheme(theme: ThemeMode): void {
    if (this.currentTheme !== theme) {
      this.currentTheme = theme;
      this.notifyListeners();
    }
  }

  /**
   * 注册主题变更监听器
   */
  onThemeChange(listener: (theme: ThemeMode) => void): vscode.Disposable {
    this.listeners.push(listener);

    // 返回一个可销毁的对象
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * 检测 VS Code 当前主题
   */
  private detectVSCodeTheme(): ThemeMode {
    // 先检查配置
    const config = vscode.workspace.getConfiguration('antdToken');
    const themeMode = config.get<ThemeConfig>('themeMode', 'auto');

    if (themeMode === 'light' || themeMode === 'dark') {
      return themeMode;
    }

    // auto 模式：跟随 VS Code 主题
    const theme = vscode.window.activeColorTheme;
    return theme.kind === vscode.ColorThemeKind.Dark ||
      theme.kind === vscode.ColorThemeKind.HighContrast
      ? 'dark'
      : 'light';
  }

  /**
   * 监听 VS Code 主题变更事件
   */
  private watchVSCodeTheme(): void {
    const disposable = vscode.window.onDidChangeActiveColorTheme(() => {
      const newTheme = this.detectVSCodeTheme();
      if (this.currentTheme !== newTheme) {
        this.currentTheme = newTheme;
        this.notifyListeners();
      }
    });

    this.disposables.push(disposable);
  }

  /**
   * 监听配置变更
   */
  private watchConfiguration(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('antdToken.themeMode')) {
        const newTheme = this.detectVSCodeTheme();
        if (this.currentTheme !== newTheme) {
          this.currentTheme = newTheme;
          this.notifyListeners();
        }
      }
    });

    this.disposables.push(disposable);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentTheme);
      } catch (error) {
        console.error('Error in theme change listener:', error);
      }
    }
  }

  /**
   * 清理所有监听器和资源
   */
  dispose(): void {
    this.listeners = [];

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
