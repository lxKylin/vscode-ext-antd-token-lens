/**
 * Ant Design Token 元数据
 * 为常用 Token 提供语义说明
 */

export const TOKEN_DESCRIPTIONS: Record<string, string> = {
  // 品牌色
  '--ant-color-primary': '品牌主色',
  '--ant-color-success': '成功状态色',
  '--ant-color-warning': '警告状态色',
  '--ant-color-error': '错误状态色',
  '--ant-color-info': '信息提示色',
  '--ant-color-link': '链接颜色',

  // 文本和背景
  '--ant-color-text-base': '基础文本颜色',
  '--ant-color-bg-base': '基础背景色',
  '--ant-color-text': '默认文本色',
  '--ant-color-text-secondary': '次要文本色',
  '--ant-color-text-tertiary': '三级文本色',
  '--ant-color-text-quaternary': '四级文本色',
  '--ant-color-bg-container': '容器背景色',
  '--ant-color-bg-elevated': '浮层背景色',
  '--ant-color-bg-layout': '布局背景色',
  '--ant-color-bg-spotlight': '聚光灯背景色',

  // 边框
  '--ant-color-border': '默认边框色',
  '--ant-color-border-secondary': '次要边框色',
  '--ant-color-split': '分割线颜色',

  // 填充色
  '--ant-color-fill': '默认填充色',
  '--ant-color-fill-secondary': '次要填充色',
  '--ant-color-fill-tertiary': '三级填充色',
  '--ant-color-fill-quaternary': '四级填充色',

  // 基础色板
  '--ant-blue': '拂晓蓝（品牌色）',
  '--ant-purple': '酱紫',
  '--ant-cyan': '明青',
  '--ant-green': '极光绿',
  '--ant-magenta': '法式洋红',
  '--ant-pink': '浪漫粉',
  '--ant-red': '薄暮红',
  '--ant-orange': '日暮橙',
  '--ant-yellow': '金盏黄',
  '--ant-volcano': '火山红',
  '--ant-geekblue': '极客蓝',
  '--ant-gold': '金色',
  '--ant-lime': '青柠绿',

  // 字体
  '--ant-font-family': '默认字体族',
  '--ant-font-family-code': '代码字体族',
  '--ant-font-size': '基础字体大小',
  '--ant-font-size-sm': '小号字体',
  '--ant-font-size-lg': '大号字体',
  '--ant-font-size-xl': '特大号字体',
  '--ant-font-size-heading-1': '一级标题字体大小',
  '--ant-font-size-heading-2': '二级标题字体大小',
  '--ant-font-size-heading-3': '三级标题字体大小',
  '--ant-font-size-heading-4': '四级标题字体大小',
  '--ant-font-size-heading-5': '五级标题字体大小',

  // 行高
  '--ant-line-height': '基础行高',
  '--ant-line-height-sm': '小号行高',
  '--ant-line-height-lg': '大号行高',

  // 尺寸
  '--ant-size-unit': '基础尺寸单位',
  '--ant-size-step': '尺寸步长',
  '--ant-size-popup-arrow': '浮层箭头尺寸',
  '--ant-control-height': '控件高度',
  '--ant-control-height-sm': '小号控件高度',
  '--ant-control-height-lg': '大号控件高度',
  '--ant-control-height-xs': '超小号控件高度',

  // 边框
  '--ant-line-width': '线条宽度',
  '--ant-line-type': '线条类型',
  '--ant-border-radius': '圆角大小',
  '--ant-border-radius-sm': '小圆角',
  '--ant-border-radius-lg': '大圆角',
  '--ant-border-radius-xs': '超小圆角',

  // 动画
  '--ant-motion-ease-out-circ': '圆形缓出动画',
  '--ant-motion-ease-in-out-circ': '圆形缓入缓出动画',
  '--ant-motion-ease-out': '标准缓出动画',
  '--ant-motion-ease-in-out': '标准缓入缓出动画',
  '--ant-motion-ease-out-back': '回弹缓出动画',
  '--ant-motion-ease-in-back': '回弹缓入动画',
  '--ant-motion-ease-in-quint': '五次方缓入动画',
  '--ant-motion-ease-out-quint': '五次方缓出动画',
  '--ant-motion-duration-slow': '慢速动画时长',
  '--ant-motion-duration-mid': '中速动画时长',
  '--ant-motion-duration-fast': '快速动画时长',

  // 阴影
  '--ant-box-shadow': '基础阴影',
  '--ant-box-shadow-secondary': '次要阴影',
  '--ant-box-shadow-tertiary': '三级阴影',

  // 层级
  '--ant-z-index-base': '基础层级',
  '--ant-z-index-popup-base': '浮层基础层级',
  '--ant-z-index-popup': '浮层层级',

  // 透明度
  '--ant-opacity-image': '图片不透明度',
  '--ant-opacity-loading': '加载状态不透明度'
};

/**
 * 获取 Token 的描述信息
 */
export function getTokenDescription(tokenName: string): string | undefined {
  return TOKEN_DESCRIPTIONS[tokenName];
}
