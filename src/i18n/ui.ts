import type { Locale } from '../consts';

export const ui = {
  zh: {
    'site.title': '档案馆',
    'nav.blog': '观测日志',
    'nav.archive': '样本档案',
    'home.archive.name': '样本档案',
    'home.archive.desc': 'SPECIMEN-08 // 档案库',
    'home.blog.name': '观测日志',
    'home.blog.desc': 'FIELD NOTES // 观测记录',
    'blog.kicker': 'FIELD NOTES // 观测记录',
    'blog.title': '观测日志',
    'archive.kicker': 'SPECIMEN ARCHIVE',
    'archive.title': '样本档案',
    'archive.empty': '该分区档案尚未解密，请等待权限开放。',
    'archive.backlinks': '◈ 被引用于',
    'footer.note': 'SPECIMEN-08 · 持续观测',
  },
  en: {
    'site.title': 'The Archive',
    'nav.blog': 'Observation Log',
    'nav.archive': 'Specimen Archive',
    'home.archive.name': 'Specimen Archive',
    'home.archive.desc': 'SPECIMEN-08 // ARCHIVE',
    'home.blog.name': 'Observation Log',
    'home.blog.desc': 'FIELD NOTES // OBSERVATION RECORDS',
    'blog.kicker': 'FIELD NOTES // OBSERVATION RECORDS',
    'blog.title': 'Observation Log',
    'archive.kicker': 'SPECIMEN ARCHIVE',
    'archive.title': 'Specimen Archive',
    'archive.empty': 'Documents in this section remain classified. Clearance pending.',
    'archive.backlinks': '◈ Referenced by',
    'footer.note': 'SPECIMEN-08 · UNDER OBSERVATION',
  },
  ja: {
    'site.title': 'アーカイブ',
    'nav.blog': '観測ログ',
    'nav.archive': '標本アーカイブ',
    'home.archive.name': '標本アーカイブ',
    'home.archive.desc': 'SPECIMEN-08 // アーカイブ',
    'home.blog.name': '観測ログ',
    'home.blog.desc': 'FIELD NOTES // 観測記録',
    'blog.kicker': 'FIELD NOTES // 観測記録',
    'blog.title': '観測ログ',
    'archive.kicker': 'SPECIMEN ARCHIVE',
    'archive.title': '標本アーカイブ',
    'archive.empty': 'この区画の資料はまだ機密解除されていません。閲覧権限の付与をお待ちください。',
    'archive.backlinks': '◈ 参照元',
    'footer.note': 'SPECIMEN-08 · 観測継続中',
  },
} as const;

export type UIKey = keyof (typeof ui)['zh'];

export function t(locale: Locale) {
  return ui[locale] ?? ui.zh;
}
