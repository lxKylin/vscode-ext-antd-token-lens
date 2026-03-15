import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { SourceManager } from '@/tokenManager/sourceManager';
import { SourceType } from '@/tokenManager/sourceTypes';
import { ThemeManager } from '@/tokenManager/themeManager';
import {
  createFakeAntdPackage,
  createTempWorkspace,
  removeTempWorkspace,
  writeWorkspaceFiles
} from '../helpers/tempWorkspace';

suite('AntdThemeSource Integration Test', () => {
  let tempDir: string;
  let registry: TokenRegistry;
  let sourceManager: SourceManager;
  let themeManager: ThemeManager;

  setup(async () => {
    tempDir = await createTempWorkspace('antd-theme-source-integration-');
    registry = new TokenRegistry();
    themeManager = new ThemeManager();
    registry.setActiveThemeResolver(() =>
      themeManager.getCurrentThemeDescriptor()
    );
    sourceManager = new SourceManager(
      registry,
      path.resolve(__dirname, '../../assets/css'),
      themeManager
    );
    await createFakeAntdPackage(tempDir);
  });

  teardown(async () => {
    sourceManager.dispose();
    themeManager.dispose();
    await removeTempWorkspace(tempDir);
  });

  test('registers generated tokens alongside builtin source', async () => {
    const themeFilePath = path.join(tempDir, 'src/theme/brand.json');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/brand.json': JSON.stringify({
        token: {
          colorPrimary: '#13c2c2'
        }
      })
    });

    await sourceManager.addSource({
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100,
      watch: false
    });
    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      id: 'brand-light',
      enabled: true,
      priority: 5,
      filePath: themeFilePath,
      baseTheme: 'light',
      watch: false,
      resolveFromWorkspace: false
    });

    await sourceManager.loadAllSources();

    assert.strictEqual(
      registry.get('--ant-color-primary', 'light')?.value,
      '#13c2c2'
    );
    assert.ok(
      registry.get('--ant-color-success', 'light'),
      'builtin tokens should still be available'
    );
  });

  test('reload updates registry after theme file changes', async () => {
    const themeFilePath = path.join(tempDir, 'src/theme/brand.json');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/brand.json': JSON.stringify({
        token: {
          colorPrimary: '#1677ff'
        }
      })
    });

    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      id: 'brand-light',
      enabled: true,
      priority: 5,
      filePath: themeFilePath,
      baseTheme: 'light',
      watch: false,
      resolveFromWorkspace: false
    });
    await sourceManager.loadAllSources();

    assert.strictEqual(
      registry.get('--ant-color-primary', 'light')?.value,
      '#1677ff'
    );

    await fs.writeFile(
      themeFilePath,
      JSON.stringify({
        token: {
          colorPrimary: '#36cfc9'
        }
      }),
      'utf-8'
    );

    await sourceManager.reload();

    assert.strictEqual(
      registry.get('--ant-color-primary', 'light')?.value,
      '#36cfc9'
    );
  });

  test('multiple named themes can coexist and preview selection changes effective value', async () => {
    const brandAPath = path.join(tempDir, 'src/theme/brand-a.json');
    const brandBPath = path.join(tempDir, 'src/theme/brand-b.json');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/brand-a.json': JSON.stringify({
        token: {
          colorPrimary: '#13c2c2'
        }
      }),
      'src/theme/brand-b.json': JSON.stringify({
        token: {
          colorPrimary: '#722ed1'
        }
      })
    });

    await sourceManager.addSource({
      type: SourceType.BUILTIN,
      enabled: true,
      priority: 100,
      watch: false
    });
    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      id: 'brand-a',
      enabled: true,
      priority: 5,
      filePath: brandAPath,
      baseTheme: 'light',
      watch: false,
      resolveFromWorkspace: false
    });
    await sourceManager.addSource({
      type: SourceType.ANTD_THEME,
      id: 'brand-b',
      enabled: true,
      priority: 6,
      filePath: brandBPath,
      baseTheme: 'light',
      watch: false,
      resolveFromWorkspace: false
    });

    await sourceManager.loadAllSources();

    assert.ok(
      sourceManager
        .getThemeDescriptors()
        .some((theme) => theme.id === 'brand-a')
    );
    assert.ok(
      sourceManager
        .getThemeDescriptors()
        .some((theme) => theme.id === 'brand-b')
    );
    assert.strictEqual(
      registry.getTokenVariants('--ant-color-primary').length >= 3,
      true
    );

    themeManager.setPreviewTheme('brand-b');
    assert.strictEqual(
      registry.getToken(
        '--ant-color-primary',
        themeManager.getCurrentTokenQuery()
      )?.value,
      '#722ed1'
    );

    themeManager.setPreviewTheme('brand-a');
    assert.strictEqual(
      registry.getToken(
        '--ant-color-primary',
        themeManager.getCurrentTokenQuery()
      )?.value,
      '#13c2c2'
    );
  });
});
