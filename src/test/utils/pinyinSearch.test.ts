import * as assert from 'assert';
import { PinyinSearch } from '../../utils/pinyinSearch';

suite('PinyinSearch Test Suite', () => {
  test('should get pinyin initials', () => {
    const result = PinyinSearch.getInitials('品牌主色');
    assert.strictEqual(result, 'ppzs');
  });

  test('should match by initials', () => {
    assert.strictEqual(PinyinSearch.matchInitials('品牌主色', 'pp'), true);
    assert.strictEqual(PinyinSearch.matchInitials('品牌主色', 'ppz'), true);
    assert.strictEqual(PinyinSearch.matchInitials('品牌主色', 'xyz'), false);
  });

  test('should get full pinyin', () => {
    const result = PinyinSearch.getFullPinyin('主色');
    assert.ok(result.includes('zhu'));
    assert.ok(result.includes('se'));
  });

  test('should match by full pinyin', () => {
    assert.strictEqual(PinyinSearch.matchFull('主色', 'zhu'), true);
    assert.strictEqual(PinyinSearch.matchFull('主色', 'se'), true);
    assert.strictEqual(PinyinSearch.matchFull('主色', 'xyz'), false);
  });

  test('should cache results', () => {
    // 清空缓存
    PinyinSearch.clearCache();

    // 第一次调用
    const result1 = PinyinSearch.getInitials('测试');

    // 第二次调用应该从缓存获取（相同结果）
    const result2 = PinyinSearch.getInitials('测试');

    assert.strictEqual(result1, result2);
  });

  test('should clear cache', () => {
    PinyinSearch.getInitials('测试');
    PinyinSearch.clearCache();

    // 缓存应该被清空
    const result = PinyinSearch.getInitials('测试');
    assert.ok(result);
  });
});
