import * as assert from 'node:assert';
import * as path from 'node:path';
import { AntdResolver } from '@/tokenManager/resolvers/antdResolver';
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
      /Failed to resolve project local antd/
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
});
