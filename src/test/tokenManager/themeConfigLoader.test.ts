import * as assert from 'node:assert';
import * as path from 'node:path';
import { ThemeConfigLoader } from '@/tokenManager/resolvers/themeConfigLoader';
import { SourceType } from '@/tokenManager/sourceTypes';
import {
  createTempWorkspace,
  removeTempWorkspace,
  writeWorkspaceFiles
} from '../helpers/tempWorkspace';

suite('ThemeConfigLoader Test Suite', () => {
  let tempDir: string;
  let loader: ThemeConfigLoader;

  setup(async () => {
    tempDir = await createTempWorkspace('theme-config-loader-');
    loader = new ThemeConfigLoader();
  });

  teardown(async () => {
    await removeTempWorkspace(tempDir);
  });

  test('wraps inline designToken into themeConfig.token', async () => {
    const result = await loader.load({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      designToken: {
        colorPrimary: '#13c2c2'
      }
    });

    assert.deepStrictEqual(result.themeConfig, {
      token: {
        colorPrimary: '#13c2c2'
      }
    });
  });

  test('passes inline themeConfig through', async () => {
    const result = await loader.load({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      themeConfig: {
        token: {
          colorPrimary: '#177ddc'
        },
        algorithm: ['dark']
      }
    });

    assert.deepStrictEqual(result.themeConfig, {
      token: {
        colorPrimary: '#177ddc'
      },
      algorithm: ['dark']
    });
  });

  test('loads theme config from JSON file', async () => {
    const filePath = path.join(tempDir, 'theme.json');
    await writeWorkspaceFiles(tempDir, {
      'theme.json': JSON.stringify({
        token: {
          colorPrimary: '#36cfc9'
        }
      })
    });

    const result = await loader.load({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      filePath
    });

    assert.deepStrictEqual(result.themeConfig, {
      token: {
        colorPrimary: '#36cfc9'
      }
    });
    assert.strictEqual(result.sourceFile, filePath);
  });

  test('loads named export from JS file', async () => {
    const filePath = path.join(tempDir, 'theme.js');
    await writeWorkspaceFiles(tempDir, {
      'theme.js': `export const themeConfig = { token: { colorPrimary: '#2f54eb' } };`
    });

    const result = await loader.load({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      filePath,
      exportName: 'themeConfig'
    });

    assert.deepStrictEqual(result.themeConfig, {
      token: {
        colorPrimary: '#2f54eb'
      }
    });
  });

  test('loads default export from TS file', async () => {
    const filePath = path.join(tempDir, 'theme.ts');
    await writeWorkspaceFiles(tempDir, {
      'theme.ts': `export default { token: { colorPrimary: '#722ed1' }, algorithm: ['compact'] };`
    });

    const result = await loader.load({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      filePath
    });

    assert.deepStrictEqual(result.themeConfig, {
      token: {
        colorPrimary: '#722ed1'
      },
      algorithm: ['compact']
    });
  });

  test('rejects function exports', async () => {
    const filePath = path.join(tempDir, 'invalid.ts');
    await writeWorkspaceFiles(tempDir, {
      'invalid.ts': `export default () => ({ token: { colorPrimary: '#000' } });`
    });

    await assert.rejects(
      () =>
        loader.load({
          type: SourceType.ANTD_THEME,
          enabled: true,
          priority: 1,
          filePath
        }),
      /Function exports are not supported/
    );
  });
});
