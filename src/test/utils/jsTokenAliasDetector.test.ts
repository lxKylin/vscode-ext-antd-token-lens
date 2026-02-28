import * as assert from 'assert';
import { JsTokenAliasDetector } from '@/utils/jsTokenAliasDetector';

suite('JsTokenAliasDetector Test Suite', () => {
  // ── detect() ─────────────────────────────────────────────────

  test('const { token } = useToken() → ["token"]', () => {
    const text = 'const { token } = useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['token']);
  });

  test('const { token: antdToken } = useToken() → ["antdToken"]', () => {
    const text = 'const { token: antdToken } = useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['antdToken']);
  });

  test('const { token: t } = theme.useToken() → ["t"]', () => {
    const text = 'const { token: t } = theme.useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['t']);
  });

  test('const { token: tk } = antd.theme.useToken() → ["tk"]', () => {
    const text = 'const { token: tk } = antd.theme.useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['tk']);
  });

  test('let { token: myToken } = useToken() → ["myToken"]', () => {
    const text = 'let { token: myToken } = useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['myToken']);
  });

  test('const { token, hashId } = useToken() → ["token"]', () => {
    const text = 'const { token, hashId } = useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['token']);
  });

  test('const { token: antdToken, hashId } = useToken() → ["antdToken"]', () => {
    const text = 'const { token: antdToken, hashId } = useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['antdToken']);
  });

  test('const { hashId, token: tk } = useToken() → ["tk"]', () => {
    const text = 'const { hashId, token: tk } = useToken();';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['tk']);
  });

  test('多行解构 → 正确检测别名', () => {
    const text = `const {
  token: antdToken,
  hashId
} = theme.useToken();`;
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['antdToken']);
  });

  test('文件中有多个 useToken() 调用 → 返回所有别名', () => {
    const text = `
const { token: antdToken } = useToken();
const { token: myToken } = theme.useToken();`;
    const result = JsTokenAliasDetector.detect(text);
    assert.deepStrictEqual(result, ['antdToken', 'myToken']);
  });

  test('文件中有重复别名 → 去重', () => {
    const text = `
const { token: tk } = useToken();
const { token: tk } = useToken();`;
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['tk']);
  });

  test('文件中无 useToken() → 返回默认值 ["token"]', () => {
    const text = 'const x = token.colorPrimary;';
    assert.deepStrictEqual(JsTokenAliasDetector.detect(text), ['token']);
  });

  test('空文本 → 返回默认值 ["token"]', () => {
    assert.deepStrictEqual(JsTokenAliasDetector.detect(''), ['token']);
  });

  // ── buildIdentifierGroup() ───────────────────────────────────

  test('单个标识符 → 直接返回', () => {
    assert.strictEqual(
      JsTokenAliasDetector.buildIdentifierGroup(['token']),
      'token'
    );
  });

  test('多个标识符 → 返回交替组', () => {
    assert.strictEqual(
      JsTokenAliasDetector.buildIdentifierGroup(['token', 'antdToken']),
      '(?:token|antdToken)'
    );
  });

  test('三个标识符 → 返回交替组', () => {
    assert.strictEqual(
      JsTokenAliasDetector.buildIdentifierGroup(['token', 'antdToken', 'tk']),
      '(?:token|antdToken|tk)'
    );
  });
});
