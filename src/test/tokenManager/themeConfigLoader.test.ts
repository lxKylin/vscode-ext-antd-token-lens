import * as assert from 'node:assert';
import * as path from 'node:path';
import { ThemeConfigLoader } from '@/tokenManager/resolvers/themeConfigLoader';
import {
  SourceErrorCode,
  TokenSourceError
} from '@/tokenManager/sourceDiagnostics';
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
    assert.strictEqual(result.entryType, 'designToken');
    assert.strictEqual(result.inputKind, 'inlineDesignToken');
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
    assert.strictEqual(result.entryType, 'themeConfig');
    assert.strictEqual(result.inputKind, 'inlineThemeConfig');
  });

  test('uses higher priority input and reports ignored lower priority fields', async () => {
    const result = await loader.load({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      themeConfig: {
        token: {
          colorPrimary: '#177ddc'
        }
      },
      designToken: {
        colorPrimary: '#13c2c2'
      },
      filePath: path.join(tempDir, 'theme.ts')
    });

    assert.strictEqual(result.entryType, 'themeConfig');
    assert.strictEqual(result.warnings.length, 1);
    assert.match(result.warnings[0].message, /实际采用 themeConfig/);
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
    assert.strictEqual(result.usedExportKind, 'default');
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
    assert.strictEqual(result.usedExportName, 'themeConfig');
    assert.strictEqual(result.usedExportKind, 'named');
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
    assert.strictEqual(result.usedExportName, 'default');
  });

  test('rejects invalid inline designToken values', async () => {
    await assert.rejects(
      () =>
        loader.load({
          type: SourceType.ANTD_THEME,
          enabled: true,
          priority: 1,
          designToken: [] as unknown as Record<string, unknown>
        }),
      (error: unknown) => {
        assert.ok(error instanceof TokenSourceError);
        assert.strictEqual(
          error.code,
          SourceErrorCode.CONFIG_INVALID_DESIGN_TOKEN
        );
        return true;
      }
    );
  });

  test('rejects missing export name clearly', async () => {
    const filePath = path.join(tempDir, 'theme.js');
    await writeWorkspaceFiles(tempDir, {
      'theme.js': `export const otherTheme = { token: { colorPrimary: '#2f54eb' } };`
    });

    await assert.rejects(
      () =>
        loader.load({
          type: SourceType.ANTD_THEME,
          enabled: true,
          priority: 1,
          filePath,
          exportName: 'themeConfig'
        }),
      (error: unknown) => {
        assert.ok(error instanceof TokenSourceError);
        assert.strictEqual(error.code, SourceErrorCode.EXPORT_NOT_FOUND);
        return true;
      }
    );
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
      (error: unknown) => {
        assert.ok(error instanceof TokenSourceError);
        assert.strictEqual(error.code, SourceErrorCode.EXPORT_IS_FUNCTION);
        assert.match(error.message, /Function exports are not supported/);
        return true;
      }
    );
  });
});
