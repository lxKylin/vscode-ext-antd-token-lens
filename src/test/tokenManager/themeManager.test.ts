/**
 * ThemeManager 单元测试
 */

import * as assert from 'assert';
import { ThemeManager, ThemeMode } from '@/tokenManager/themeManager';

suite('ThemeManager Test Suite', () => {
  let themeManager: ThemeManager;

  setup(() => {
    themeManager = new ThemeManager();
  });

  teardown(() => {
    themeManager.dispose();
  });

  test('get current theme', () => {
    const theme = themeManager.getCurrentTheme();
    assert.ok(theme === 'light' || theme === 'dark');
  });

  test('set theme manually', () => {
    themeManager.setTheme('dark');
    assert.strictEqual(themeManager.getCurrentTheme(), 'dark');

    themeManager.setTheme('light');
    assert.strictEqual(themeManager.getCurrentTheme(), 'light');
  });

  test('theme change listener', () => {
    let callCount = 0;
    let receivedTheme: ThemeMode | null = null;

    const disposable = themeManager.onThemeChange((theme) => {
      callCount++;
      receivedTheme = theme;
    });

    // 获取当前主题，然后切换到另一个主题
    const currentTheme = themeManager.getCurrentTheme();
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';

    // 设置为目标主题
    themeManager.setTheme(targetTheme);

    // 监听器应该已经被同步调用
    assert.strictEqual(callCount, 1);
    assert.strictEqual(receivedTheme, targetTheme);

    // 再次设置为相同主题，不应该触发监听器
    themeManager.setTheme(targetTheme);
    assert.strictEqual(callCount, 1); // 应该还是 1

    disposable.dispose();
  });

  test('listener dispose', () => {
    let callCount = 0;

    const disposable = themeManager.onThemeChange(() => {
      callCount++;
    });

    // 切换到不同的主题
    const currentTheme = themeManager.getCurrentTheme();
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';

    themeManager.setTheme(targetTheme);
    assert.strictEqual(callCount, 1);

    // 销毁监听器
    disposable.dispose();

    // 再次切换，不应该触发监听器
    const anotherTheme = targetTheme === 'light' ? 'dark' : 'light';
    themeManager.setTheme(anotherTheme);
    assert.strictEqual(callCount, 1); // 应该还是 1
  });

  test('multiple listeners', () => {
    let callCount1 = 0;
    let callCount2 = 0;

    const disposable1 = themeManager.onThemeChange(() => {
      callCount1++;
    });

    const disposable2 = themeManager.onThemeChange(() => {
      callCount2++;
    });

    // 切换主题
    const currentTheme = themeManager.getCurrentTheme();
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    themeManager.setTheme(targetTheme);

    assert.strictEqual(callCount1, 1);
    assert.strictEqual(callCount2, 1);

    disposable1.dispose();
    disposable2.dispose();
  });

  test('listener error handling', () => {
    let normalListenerCalled = false;

    // 添加一个会抛出错误的监听器
    themeManager.onThemeChange(() => {
      throw new Error('Test error');
    });

    // 添加一个正常的监听器
    themeManager.onThemeChange(() => {
      normalListenerCalled = true;
    });

    // 切换主题
    const currentTheme = themeManager.getCurrentTheme();
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    themeManager.setTheme(targetTheme);

    // 即使第一个监听器抛出错误，第二个监听器仍应该被调用
    assert.strictEqual(normalListenerCalled, true);
  });

  test('dispose cleans up listeners', () => {
    let callCount = 0;

    themeManager.onThemeChange(() => {
      callCount++;
    });

    // 切换主题
    const currentTheme = themeManager.getCurrentTheme();
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    themeManager.setTheme(targetTheme);
    const initialCallCount = callCount;

    // 销毁 ThemeManager
    themeManager.dispose();

    // 再次设置主题，监听器不应该被调用
    const anotherTheme = targetTheme === 'light' ? 'dark' : 'light';
    themeManager.setTheme(anotherTheme);
    assert.strictEqual(callCount, initialCallCount);
  });
});
