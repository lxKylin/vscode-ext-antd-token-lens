/**
 * 主题管理器
 * 管理当前激活的主题，并在主题切换时通知相关模块
 */

import * as vscode from 'vscode';
import { SourceBaseTheme, ThemeDescriptor } from './sourceTypes';

export type ThemeMode = 'light' | 'dark';
export type ThemeConfig = 'auto' | 'light' | 'dark';

const BUILTIN_THEME_DESCRIPTORS: ThemeDescriptor[] = [
  {
    id: 'light',
    name: 'light',
    baseTheme: 'light',
    sourceId: 'builtin',
    sourceType: undefined,
    isBuiltin: true,
    priority: 100,
    metadata: { sourceLabel: 'builtin' }
  },
  {
    id: 'dark',
    name: 'dark',
    baseTheme: 'dark',
    sourceId: 'builtin',
    sourceType: undefined,
    isBuiltin: true,
    priority: 100,
    metadata: { sourceLabel: 'builtin' }
  }
];

export class ThemeManager {
  private currentTheme: ThemeMode;
  private previewThemeId: string | undefined;
  private availableThemes: ThemeDescriptor[] = BUILTIN_THEME_DESCRIPTORS.map(
    (theme) => ({ ...theme })
  );
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

  getCurrentThemeDescriptor(): ThemeDescriptor {
    const activeTheme = this.resolveActiveThemeDescriptor();
    return {
      ...activeTheme,
      isActive: true
    };
  }

  getAvailableThemes(baseTheme?: SourceBaseTheme): ThemeDescriptor[] {
    const activeThemeId = this.getCurrentThemeDescriptor().id;
    return this.availableThemes
      .filter((theme) => (baseTheme ? theme.baseTheme === baseTheme : true))
      .map((theme) => ({
        ...theme,
        isActive: theme.id === activeThemeId
      }));
  }

  setAvailableThemes(themes: ThemeDescriptor[]): void {
    const previousSignature = this.getThemeSignature(this.availableThemes);
    const previousActive = this.resolveActiveThemeDescriptor().id;

    this.availableThemes = this.mergeAvailableThemes(themes);

    if (
      this.previewThemeId &&
      !this.availableThemes.some((theme) => theme.id === this.previewThemeId)
    ) {
      this.previewThemeId = undefined;
    }

    const nextSignature = this.getThemeSignature(this.availableThemes);
    const nextActive = this.resolveActiveThemeDescriptor().id;

    if (previousSignature !== nextSignature || previousActive !== nextActive) {
      this.notifyListeners();
    }
  }

  getPreviewThemeId(): string | undefined {
    return this.previewThemeId;
  }

  setPreviewTheme(themeId: string | undefined): void {
    if (!themeId) {
      this.clearPreviewTheme();
      return;
    }

    const targetTheme = this.availableThemes.find(
      (theme) => theme.id === themeId
    );
    if (!targetTheme) {
      throw new Error(`Theme not found: ${themeId}`);
    }

    const previousActive = this.resolveActiveThemeDescriptor().id;
    this.previewThemeId = themeId;
    const nextActive = this.resolveActiveThemeDescriptor().id;

    if (previousActive !== nextActive) {
      this.notifyListeners();
    }
  }

  clearPreviewTheme(): void {
    if (!this.previewThemeId) {
      return;
    }

    const previousActive = this.resolveActiveThemeDescriptor().id;
    this.previewThemeId = undefined;
    const nextActive = this.resolveActiveThemeDescriptor().id;

    if (previousActive !== nextActive) {
      this.notifyListeners();
    }
  }

  getCurrentTokenQuery(): { themeId?: string; baseTheme: SourceBaseTheme } {
    const activeTheme = this.resolveActiveThemeDescriptor();
    return {
      themeId: activeTheme.id,
      baseTheme: activeTheme.baseTheme
    };
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

  private resolveActiveThemeDescriptor(): ThemeDescriptor {
    if (this.previewThemeId) {
      const previewTheme = this.availableThemes.find(
        (theme) => theme.id === this.previewThemeId
      );
      if (previewTheme) {
        return previewTheme;
      }
    }

    return this.getDefaultThemeDescriptor(this.currentTheme);
  }

  private getDefaultThemeDescriptor(
    baseTheme: SourceBaseTheme
  ): ThemeDescriptor {
    const candidates = this.availableThemes
      .filter((theme) => theme.baseTheme === baseTheme)
      .sort((left, right) => {
        const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
        const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        if ((left.isBuiltin ?? false) !== (right.isBuiltin ?? false)) {
          return left.isBuiltin ? 1 : -1;
        }
        return left.name.localeCompare(right.name);
      });

    return (
      candidates[0] ??
      BUILTIN_THEME_DESCRIPTORS.find((theme) => theme.baseTheme === baseTheme)!
    );
  }

  private mergeAvailableThemes(themes: ThemeDescriptor[]): ThemeDescriptor[] {
    const merged = new Map<string, ThemeDescriptor>();

    for (const theme of BUILTIN_THEME_DESCRIPTORS) {
      merged.set(theme.id, { ...theme });
    }

    for (const theme of themes) {
      merged.set(theme.id, {
        ...theme,
        isBuiltin: theme.isBuiltin ?? false
      });
    }

    return Array.from(merged.values()).sort((left, right) => {
      if (left.baseTheme !== right.baseTheme) {
        return left.baseTheme.localeCompare(right.baseTheme);
      }
      const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      if ((left.isBuiltin ?? false) !== (right.isBuiltin ?? false)) {
        return left.isBuiltin ? 1 : -1;
      }
      return left.name.localeCompare(right.name);
    });
  }

  private getThemeSignature(themes: ThemeDescriptor[]): string {
    return themes
      .map((theme) => `${theme.id}:${theme.baseTheme}:${theme.priority ?? ''}`)
      .join('|');
  }
}
