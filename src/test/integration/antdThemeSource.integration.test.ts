import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { TokenRegistry } from '@/tokenManager/tokenRegistry';
import { SourceManager } from '@/tokenManager/sourceManager';
import { SourceType } from '@/tokenManager/sourceTypes';
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

  setup(async () => {
    tempDir = await createTempWorkspace('antd-theme-source-integration-');
    registry = new TokenRegistry();
    sourceManager = new SourceManager(
      registry,
      path.resolve(__dirname, '../../assets/css')
    );
    await createFakeAntdPackage(tempDir);
  });

  teardown(async () => {
    sourceManager.dispose();
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
});
