/**
 * 性能监控工具
 */
export class PerformanceMonitor {
  /**
   * 测量同步函数执行时间
   * @param label 标签
   * @param fn 要执行的函数
   * @returns 函数执行结果
   */
  static measure<T>(label: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;

    if (duration > 100) {
      console.warn(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
    }

    return result;
  }

  /**
   * 测量异步函数执行时间
   * @param label 标签
   * @param fn 要执行的异步函数
   * @returns 函数执行结果的 Promise
   */
  static async measureAsync<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;

    if (duration > 100) {
      console.warn(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
    }

    return result;
  }
}

/**
 * 防抖工具函数
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * 节流工具函数
 * @param func 要节流的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}
