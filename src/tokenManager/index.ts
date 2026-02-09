/**
 * Token 管理模块统一入口
 * 提供全局单例和初始化函数
 */

import { TokenRegistry } from './tokenRegistry';
import { ThemeManager } from './themeManager';
import { SourceManager } from './sourceManager';
import { AutoScanner } from './autoScanner';

/** 全局 Token 注册表单例 */
export const tokenRegistry = new TokenRegistry();

/** 全局主题管理器单例 */
export const themeManager = new ThemeManager();

/** 全局数据源管理器 */
let sourceManager: SourceManager | undefined;

/** 全局自动扫描器 */
let autoScanner: AutoScanner | undefined;

/** 是否已初始化 */
let initialized = false;

/**
 * 初始化 Token 管理模块（新版本：使用 SourceManager）
 * @param assetsPath 资源文件路径
 */
export async function initializeTokenRegistry(
  assetsPath: string
): Promise<void> {
  if (initialized) {
    console.warn('TokenRegistry already initialized');
    return;
  }

  try {
    // 创建数据源管理器
    sourceManager = new SourceManager(tokenRegistry, assetsPath);
    await sourceManager.initialize();

    // 创建并启动自动扫描器
    autoScanner = new AutoScanner(sourceManager);
    await autoScanner.start();

    initialized = true;

    console.log(`TokenRegistry initialized with ${tokenRegistry.size} tokens`);
    console.log(`- Unique token names: ${tokenRegistry.uniqueSize}`);
    console.log(`- Current theme: ${themeManager.getCurrentTheme()}`);
  } catch (error) {
    console.error('Failed to initialize TokenRegistry:', error);
    throw error;
  }
}

/**
 * 获取数据源管理器
 */
export function getSourceManager(): SourceManager | undefined {
  return sourceManager;
}

/**
 * 获取自动扫描器
 */
export function getAutoScanner(): AutoScanner | undefined {
  return autoScanner;
}

/**
 * 清理资源
 */
export function dispose(): void {
  sourceManager?.dispose();
  autoScanner?.dispose();
  tokenRegistry.clear();
  themeManager.dispose();
  sourceManager = undefined;
  autoScanner = undefined;
  initialized = false;
}

// 监听主题变化
themeManager.onThemeChange((theme) => {
  console.log('Theme changed to:', theme);
});

// 导出所有相关类型和类
export { TokenRegistry } from './tokenRegistry';
export { ThemeManager, ThemeMode, ThemeConfig } from './themeManager';
export { SourceManager } from './sourceManager';
export { AutoScanner } from './autoScanner';
export * from './cssParser';
export * from './sourceTypes';
