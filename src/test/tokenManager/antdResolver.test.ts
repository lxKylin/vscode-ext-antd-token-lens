import * as assert from 'node:assert';
import * as path from 'node:path';
import { AntdResolver } from '@/tokenManager/resolvers/antdResolver';
import {
  SourceErrorCode,
  TokenSourceError
} from '@/tokenManager/sourceDiagnostics';
import { SourceType } from '@/tokenManager/sourceTypes';
import {
  createFakeAntdPackage,
  createTempWorkspace,
  removeTempWorkspace,
  writeWorkspaceFiles
} from '../helpers/tempWorkspace';

suite('AntdResolver Test Suite', () => {
  let tempDir: string;
  let resolver: AntdResolver;

  setup(async () => {
    tempDir = await createTempWorkspace('antd-resolver-');
    resolver = new AntdResolver();
  });

  teardown(async () => {
    await removeTempWorkspace(tempDir);
  });

  test('resolves project local antd successfully', async () => {
    await createFakeAntdPackage(tempDir);
    await writeWorkspaceFiles(tempDir, {
      'src/theme/theme.ts': `export const themeConfig = { token: { colorPrimary: '#13c2c2' } };`
    });

    const api = await resolver.resolve({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      filePath: path.join(tempDir, 'src/theme/theme.ts'),
      resolveFromWorkspace: false
    });

    assert.ok(api.packagePath.endsWith(path.join('node_modules', 'antd')));
    assert.strictEqual(api.version, '5.99.0-test');
    assert.strictEqual(api.resolvedFrom, path.join(tempDir, 'src/theme'));
    assert.deepStrictEqual(api.attemptedStartDirs, [
      path.join(tempDir, 'src/theme')
    ]);
    assert.strictEqual(
      api.getDesignToken({ token: { colorPrimary: '#13c2c2' } }).colorPrimary,
      '#13c2c2'
    );
  });

  test('fails clearly when local antd is missing', async () => {
    const missingThemeFile = path.join(tempDir, 'src/theme/theme.ts');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/theme.ts': `export default { token: { colorPrimary: '#000' } };`
    });

    await assert.rejects(
      () =>
        resolver.resolve({
          type: SourceType.ANTD_THEME,
          enabled: true,
          priority: 1,
          filePath: missingThemeFile,
          resolveFromWorkspace: false
        }),
      (error: unknown) => {
        assert.ok(error instanceof TokenSourceError);
        assert.strictEqual(error.code, SourceErrorCode.ANTD_PACKAGE_NOT_FOUND);
        assert.match(error.details ?? '', /尝试起点/);
        assert.match(error.details ?? '', /src\/theme/);
        return true;
      }
    );
  });

  test('maps algorithm aliases to resolved antd algorithms', async () => {
    await createFakeAntdPackage(tempDir);
    const filePath = path.join(tempDir, 'src/theme/theme.ts');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/theme.ts': `export default { token: { colorPrimary: '#1677ff' } };`
    });

    const api = await resolver.resolve({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      filePath,
      resolveFromWorkspace: false
    });

    const resolvedThemeConfig = resolver.resolveAlgorithms(
      {
        token: {
          colorPrimary: '#1677ff'
        },
        algorithm: ['dark', 'compact']
      },
      api.algorithms
    );

    const designTokens = api.getDesignToken(resolvedThemeConfig);
    assert.strictEqual(designTokens.colorBgBase, '#000000');
    assert.strictEqual(designTokens.borderRadius, 4);
  });

  test('reports unknown algorithm aliases separately', async () => {
    await createFakeAntdPackage(tempDir);
    const filePath = path.join(tempDir, 'src/theme/theme.ts');
    await writeWorkspaceFiles(tempDir, {
      'src/theme/theme.ts': `export default { token: { colorPrimary: '#1677ff' } };`
    });

    const api = await resolver.resolve({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 1,
      filePath,
      resolveFromWorkspace: false
    });

    assert.throws(
      () =>
        resolver.resolveAlgorithmsDetailed(
          {
            algorithm: ['dark', 'customAlias']
          },
          api.algorithms
        ),
      (error: unknown) => {
        assert.ok(error instanceof TokenSourceError);
        assert.strictEqual(error.code, SourceErrorCode.ANTD_ALGORITHM_UNKNOWN);
        return true;
      }
    );
  });
});
