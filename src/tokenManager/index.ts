/**
 * Token 管理模块统一入口
 * 提供全局单例和初始化函数
 */

import { TokenRegistry } from './tokenRegistry';
import { ThemeManager } from './themeManager';
import { loadBuiltinTokens } from '@/data/antdTokens';

/** 全局 Token 注册表单例 */
export const tokenRegistry = new TokenRegistry();

/** 全局主题管理器单例 */
export const themeManager = new ThemeManager();

/** 是否已初始化 */
let initialized = false;

/**
 * 初始化 Token 管理模块
 * 加载内置 Token 并注册到 TokenRegistry
 */
export function initializeTokenRegistry(assetsPath: string): void {
  if (initialized) {
    console.warn('TokenRegistry already initialized');
    return;
  }

  try {
    // 加载内置 Token
    const tokens = loadBuiltinTokens(assetsPath);

    // 注册所有 Token
    tokenRegistry.registerBatch([...tokens.light, ...tokens.dark]);

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
 * 清理资源
 */
export function dispose(): void {
  tokenRegistry.clear();
  themeManager.dispose();
  initialized = false;
}

// 监听主题变化
themeManager.onThemeChange((theme) => {
  console.log('Theme changed to:', theme);
  // 后续阶段可以在这里触发装饰器刷新等操作
});

// 导出所有相关类型和类
export { TokenRegistry } from './tokenRegistry';
export { ThemeManager, ThemeMode, ThemeConfig } from './themeManager';
export * from './cssParser';
