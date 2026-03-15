import * as assert from 'node:assert';
import * as path from 'node:path';
import { SourceManager } from '@/tokenManager/sourceManager';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { SourceType } from '@/tokenManager/sourceTypes';
import { ThemeManager } from '@/tokenManager/themeManager';
import {
  createFakeAntdPackage,
  createTempWorkspace,
  removeTempWorkspace,
  writeWorkspaceFiles
} from '../helpers/tempWorkspace';

suite('SourceManager Test Suite', () => {
  let tempDir: string;
  let assetsDir: string;
  let sourceManager: SourceManager;
  let tokenRegistry: TokenRegistry;
  let themeManager: ThemeManager;

  setup(async () => {
    tempDir = await createTempWorkspace('source-manager-');
    assetsDir = path.join(tempDir, 'assets/css');
    tokenRegistry = new TokenRegistry();
    themeManager = new ThemeManager();
    tokenRegistry.setActiveThemeResolver(() =>
      themeManager.getCurrentThemeDescriptor()
    );
    sourceManager = new SourceManager(tokenRegistry, assetsDir, themeManager);

    await writeWorkspaceFiles(tempDir, {
      'assets/css/antd-light-theme.css': `:root { --ant-color-primary: #1677ff; }`,
      'assets/css/antd-dark-theme.css': `:root { --ant-color-primary: #177ddc; }`
    });
  });

  teardown(async () => {
    sourceManager.dispose();
    themeManager.dispose();
    await removeTempWorkspace(tempDir);
  });

  test('returns source statuses after loading', async () => {
    await createFakeAntdPackage(tempDir);
    const themeFilePath = path.join(tempDir, 'src/theme/theme.ts');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/theme.ts': `export default { token: { colorPrimary: '#13c2c2' } };`
    });

    await sourceManager.addSource({
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100
    });
    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 10,
      id: 'custom-theme',
      filePath: themeFilePath,
      resolveFromWorkspace: false
    });

    await sourceManager.loadAllSources();
    const statuses = sourceManager.getSourceStatuses();
    const builtinStatus = statuses.find(
      (status) => status.sourceId === 'builtin'
    );
    const antdStatus = statuses.find(
      (status) => status.sourceId === 'antdTheme:custom-theme'
    );

    assert.ok(builtinStatus);
    assert.strictEqual(builtinStatus?.health, 'ok');
    assert.ok(antdStatus);
    assert.strictEqual(antdStatus?.health, 'ok');
    assert.strictEqual(antdStatus?.metadata?.entryType, 'filePath');
    assert.strictEqual(antdStatus?.metadata?.antdVersion, '5.99.0-test');
    assert.ok((antdStatus?.tokenCount ?? 0) > 0);
  });

  test('single source failure does not block builtin source', async () => {
    await sourceManager.addSource({
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100
    });
    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 10,
      id: 'broken-theme',
      filePath: path.join(tempDir, 'missing-theme.ts'),
      resolveFromWorkspace: false
    });

    const results = await sourceManager.loadAllSources();
    const statuses = sourceManager.getSourceStatuses();
    const builtinStatus = statuses.find(
      (status) => status.sourceId === 'builtin'
    );
    const brokenStatus = statuses.find(
      (status) => status.sourceId === 'antdTheme:broken-theme'
    );

    assert.strictEqual(
      results.some((result) => result.success),
      true
    );
    assert.strictEqual(builtinStatus?.health, 'ok');
    assert.strictEqual(brokenStatus?.health, 'error');
    assert.match(brokenStatus?.errorMessage ?? '', /不存在|不可访问/);
  });

  test('reload refreshes source statuses', async () => {
    await sourceManager.addSource({
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100
    });

    await sourceManager.loadAllSources();
    const firstStatus = sourceManager.getSourceStatuses()[0];
    const firstLoadedAt = firstStatus.lastLoadedAt ?? 0;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await sourceManager.reload();

    const secondStatus = sourceManager.getSourceStatuses()[0];
    assert.ok((secondStatus.lastLoadedAt ?? 0) >= firstLoadedAt);
    assert.strictEqual(secondStatus.health, 'ok');
  });

  test('aggregates available named themes and refreshes after reload', async () => {
    await createFakeAntdPackage(tempDir);
    const brandAPath = path.join(tempDir, 'src/theme/brand-a.ts');
    const brandBPath = path.join(tempDir, 'src/theme/brand-b.ts');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/brand-a.ts': `export default { token: { colorPrimary: '#13c2c2' } };`,
      'src/theme/brand-b.ts': `export default { token: { colorPrimary: '#722ed1' } };`
    });

    await sourceManager.addSource({
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100
    });
    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 5,
      id: 'brand-a',
      baseTheme: 'light',
      filePath: brandAPath,
      resolveFromWorkspace: false
    });
    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 6,
      id: 'brand-b',
      baseTheme: 'light',
      filePath: brandBPath,
      resolveFromWorkspace: false
    });

    await sourceManager.loadAllSources();

    const themes = sourceManager.getThemeDescriptors();
    assert.ok(themes.some((theme) => theme.id === 'brand-a'));
    assert.ok(themes.some((theme) => theme.id === 'brand-b'));
    assert.ok(
      themeManager.getAvailableThemes().some((theme) => theme.id === 'brand-a')
    );
  });
});
