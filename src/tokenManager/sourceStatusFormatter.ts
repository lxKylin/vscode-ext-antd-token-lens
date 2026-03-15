import type { QuickPickItem } from 'vscode';
import { SourceRuntimeStatus } from './sourceTypes';

export type SourceStatusQuickPickItem = QuickPickItem & {
  sourceId: string;
};

export function formatSourceQuickPickItem(
  status: SourceRuntimeStatus
): SourceStatusQuickPickItem {
  const metadata = status.metadata ?? {};
  const themeName = asString(metadata.themeName);
  const baseTheme = asString(metadata.baseTheme);
  const entryType = asString(metadata.entryType);
  const antdVersion = asString(metadata.antdVersion);
  const tokenCount = status.tokenCount ?? 0;
  const loadTime = status.loadTime ? `${status.loadTime}ms` : '-';
  const summary =
    status.errorMessage ?? status.warnings?.[0]?.message ?? '最近一次加载成功';

  return {
    sourceId: status.sourceId,
    label: `${getHealthLabel(status.health)} ${themeName ?? status.description}`,
    description: status.sourceId,
    detail: [
      `类型: ${status.sourceType}`,
      baseTheme ? `主题: ${baseTheme}` : undefined,
      entryType ? `入口: ${entryType}` : undefined,
      `Token: ${tokenCount}`,
      `耗时: ${loadTime}`,
      antdVersion ? `antd: ${antdVersion}` : undefined,
      summary
    ]
      .filter(Boolean)
      .join(' | ')
  };
}

export function formatSourceStatusDetail(status: SourceRuntimeStatus): string {
  const metadata = status.metadata ?? {};
  const warnings = status.warnings ?? [];
  const loadTimeText = status.loadTime ? `${status.loadTime}ms` : '-';
  const lines = [
    '# Token 数据源状态',
    '',
    `- Source ID: ${status.sourceId}`,
    `- Source Type: ${status.sourceType}`,
    `- 状态: ${getHealthText(status.health)}`,
    `- 描述: ${status.description}`,
    `- Theme Name: ${asString(metadata.themeName) ?? '-'}`,
    `- Base Theme: ${asString(metadata.baseTheme) ?? '-'}`,
    `- 配置入口: ${asString(metadata.entryType) ?? '-'}`,
    `- 主题文件/来源: ${asString(metadata.sourceLocation) ?? asString(metadata.filePath) ?? 'inline'}`,
    `- Export Name: ${asString(metadata.usedExportName) ?? asString(metadata.exportName) ?? '-'}`,
    `- antd Version: ${asString(metadata.antdVersion) ?? '-'}`,
    `- antd Package Path: ${asString(metadata.antdPackagePath) ?? '-'}`,
    `- 解析起点: ${asString(metadata.antdResolvedFrom) ?? '-'}`,
    `- 回退到工作区根目录: ${metadata.allowWorkspaceFallback === true ? '是' : '否'}`,
    `- 最近一次加载时间: ${formatTimestamp(status.lastLoadedAt)}`,
    `- 最近一次 Token 数量: ${status.tokenCount ?? '-'}`,
    `- 最近一次耗时: ${loadTimeText}`,
    `- 最近一次错误码: ${status.errorCode ?? '-'}`,
    `- 最近一次错误说明: ${status.errorMessage ?? '-'}`,
    `- 算法摘要: ${formatStringArray(metadata.algorithmSummary)}`,
    `- 警告: ${warnings.length > 0 ? warnings.map((warning) => warning.message).join('；') : '-'}`
  ];

  const attemptedDirs = formatStringArray(metadata.antdAttemptedStartDirs);
  if (attemptedDirs !== '-') {
    lines.push(`- antd 尝试路径: ${attemptedDirs}`);
  }

  return lines.join('\n');
}

export function formatReloadSummary(statuses: SourceRuntimeStatus[]): string {
  const okCount = statuses.filter((status) => status.health === 'ok').length;
  const warningCount = statuses.filter(
    (status) => status.health === 'warning'
  ).length;
  const errorCount = statuses.filter(
    (status) => status.health === 'error'
  ).length;
  const parts = [`成功 ${okCount}`];

  if (warningCount > 0) {
    parts.push(`警告 ${warningCount}`);
  }

  if (errorCount > 0) {
    parts.push(`失败 ${errorCount}`);
  }

  return `Token 数据源重新加载完成：${parts.join('，')}`;
}

function getHealthLabel(health: SourceRuntimeStatus['health']): string {
  switch (health) {
    case 'ok':
      return '[成功]';
    case 'warning':
      return '[警告]';
    case 'error':
      return '[失败]';
    default:
      return '[空闲]';
  }
}

function getHealthText(health: SourceRuntimeStatus['health']): string {
  switch (health) {
    case 'ok':
      return '已成功加载';
    case 'warning':
      return '已加载，但存在警告';
    case 'error':
      return '加载失败';
    default:
      return '未加载';
  }
}

function formatTimestamp(value: number | undefined): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('zh-CN');
}

function formatStringArray(value: unknown): string {
  return Array.isArray(value) && value.length > 0
    ? value.map(String).join(', ')
    : '-';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}
