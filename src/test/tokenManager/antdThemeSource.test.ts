import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { AntdThemeTokenSource } from '@/tokenManager/sources/antdThemeSource';
import {
  ResolvedAntdThemeApi,
  AntdResolver
} from '@/tokenManager/resolvers/antdResolver';
import {
  ThemeConfigLoader,
  ThemeConfigLoadResult
} from '@/tokenManager/resolvers/themeConfigLoader';
import {
  SourceErrorCode,
  TokenSourceError
} from '@/tokenManager/sourceDiagnostics';
import { SourceType } from '@/tokenManager/sourceTypes';

suite('AntdThemeTokenSource Test Suite', () => {
  test('loads tokens successfully', async () => {
    class StubThemeConfigLoader extends ThemeConfigLoader {
      override async load(): Promise<ThemeConfigLoadResult> {
        return {
          themeConfig: {
            token: {
              colorPrimary: '#13c2c2'
            }
          },
          inputKind: 'inlineDesignToken',
          entryType: 'designToken',
          warnings: []
        };
      }
    }

    class StubAntdResolver extends AntdResolver {
      override async resolve(): Promise<ResolvedAntdThemeApi> {
        return {
          packagePath: '/tmp/node_modules/antd',
          version: '5.0.0-test',
          resolvedFrom: '/tmp',
          attemptedStartDirs: ['/tmp'],
          allowWorkspaceFallback: false,
          getDesignToken: (themeConfig) => ({
            colorPrimary: String(
              (themeConfig?.token as Record<string, unknown>)?.colorPrimary
            ),
            borderRadius: 6
          }),
          algorithms: {}
        };
      }
    }

    const source = new AntdThemeTokenSource(
      {
        type: SourceType.ANTD_THEME,
        enabled: true,
        priority: 5,
        baseTheme: 'light',
        designToken: {
          colorPrimary: '#13c2c2'
        }
      },
      {
        themeConfigLoader: new StubThemeConfigLoader(),
        antdResolver: new StubAntdResolver()
      }
    );

    const tokens = await source.load();

    assert.strictEqual(tokens.length, 2);
    assert.strictEqual(tokens[0].theme, 'light');
    assert.strictEqual(tokens[0].sourceType, SourceType.ANTD_THEME);
    assert.ok(tokens.some((token) => token.name === '--ant-color-primary'));
    assert.strictEqual(source.getLastError(), undefined);
    assert.strictEqual(source.getWarnings().length, 0);
    assert.strictEqual(source.getRuntimeMetadata()?.antdVersion, '5.0.0-test');
    assert.strictEqual(source.getRuntimeMetadata()?.entryType, 'designToken');
  });

  test('validate fails when no input is provided', async () => {
    const source = new AntdThemeTokenSource({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 5
    });

    assert.strictEqual(await source.validate(), false);
    assert.strictEqual(
      source.getLastError()?.code,
      SourceErrorCode.CONFIG_MISSING_INPUT
    );
  });

  test('keeps warning when watch is enabled without filePath', async () => {
    const source = new AntdThemeTokenSource({
      type: SourceType.ANTD_THEME,
      enabled: true,
      priority: 5,
      watch: true,
      designToken: {
        colorPrimary: '#13c2c2'
      }
    });

    const validation = await source.validateDetailed();

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(source.getWarnings().length, 1);
    assert.strictEqual(
      source.getWarnings()[0].code,
      SourceErrorCode.CONFIG_WATCH_REQUIRES_FILEPATH
    );
  });

  test('exposes structured error after load failure', async () => {
    class FailingThemeConfigLoader extends ThemeConfigLoader {
      override async load(): Promise<ThemeConfigLoadResult> {
        throw new TokenSourceError({
          code: SourceErrorCode.EXPORT_NOT_FOUND,
          message: '主题文件中未找到导出 themeConfig'
        });
      }
    }

    const source = new AntdThemeTokenSource(
      {
        type: SourceType.ANTD_THEME,
        enabled: true,
        priority: 5,
        filePath: '/tmp/theme.ts'
      },
      {
        themeConfigLoader: new FailingThemeConfigLoader()
      }
    );

    await assert.rejects(
      () => source.load(),
      (error: unknown) => {
        assert.ok(error instanceof TokenSourceError);
        assert.strictEqual(error.code, SourceErrorCode.EXPORT_NOT_FOUND);
        return true;
      }
    );

    assert.strictEqual(
      source.getLastError()?.code,
      SourceErrorCode.EXPORT_NOT_FOUND
    );
  });

  test('emits change event when watched file changes', () => {
    class FakeWatcher implements vscode.FileSystemWatcher {
      readonly ignoreCreateEvents = false;
      readonly ignoreChangeEvents = false;
      readonly ignoreDeleteEvents = false;
      private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
      private readonly createEmitter = new vscode.EventEmitter<vscode.Uri>();
      private readonly deleteEmitter = new vscode.EventEmitter<vscode.Uri>();
      readonly onDidChange = this.changeEmitter.event;
      readonly onDidCreate = this.createEmitter.event;
      readonly onDidDelete = this.deleteEmitter.event;

      fireChange(uri: vscode.Uri): void {
        this.changeEmitter.fire(uri);
      }

      dispose(): void {
        this.changeEmitter.dispose();
        this.createEmitter.dispose();
        this.deleteEmitter.dispose();
      }
    }

    const fakeWatcher = new FakeWatcher();
    const source = new AntdThemeTokenSource(
      {
        type: SourceType.ANTD_THEME,
        enabled: true,
        priority: 5,
        filePath: '/tmp/theme.ts',
        watch: true
      },
      {
        createFileSystemWatcher: () => fakeWatcher
      }
    );

    let callCount = 0;
    const disposable = source.onDidChange(() => {
      callCount += 1;
    });

    fakeWatcher.fireChange(vscode.Uri.file('/tmp/theme.ts'));

    assert.strictEqual(callCount, 1);
    disposable.dispose();
    source.dispose();
  });
});
