import type { Locale } from '../consts';

export const ui = {
  zh: {
    'nav.blog': '研究员日志',
    'nav.archive': '涟的档案',
    'home.archive.name': '涟的档案',
    'home.archive.desc': 'SPECIMEN-08 // 档案库',
    'home.blog.name': '研究员日志',
    'home.blog.desc': 'FIELD NOTES // 研究记录',
    'blog.kicker': 'FIELD NOTES // 研究记录',
    'blog.title': '研究员日志',
    'archive.kicker': 'ARCHIVE // SPECIMEN-08',
    'archive.title': '涟的档案',
    'archive.empty': '该分区档案尚未解密，请等待权限开放。',
    'footer.note': 'SPECIMEN-08 · 保持湿润',
  },
  en: {
    'nav.blog': "Researcher's Log",
    'nav.archive': "Lian's Archive",
    'home.archive.name': "Lian's Archive",
    'home.archive.desc': 'SPECIMEN-08 // ARCHIVE',
    'home.blog.name': "Researcher's Log",
    'home.blog.desc': 'FIELD NOTES // RESEARCH RECORDS',
    'blog.kicker': 'FIELD NOTES // RESEARCH RECORDS',
    'blog.title': "Researcher's Log",
    'archive.kicker': 'ARCHIVE // SPECIMEN-08',
    'archive.title': "Lian's Archive",
    'archive.empty': 'Documents in this section remain classified. Clearance pending.',
    'footer.note': 'SPECIMEN-08 · STAY HYDRATED',
  },
  ja: {
    'nav.blog': '研究員ログ',
    'nav.archive': '涟のアーカイブ',
    'home.archive.name': '涟のアーカイブ',
    'home.archive.desc': 'SPECIMEN-08 // アーカイブ',
    'home.blog.name': '研究員ログ',
    'home.blog.desc': 'FIELD NOTES // 研究記録',
    'blog.kicker': 'FIELD NOTES // 研究記録',
    'blog.title': '研究員ログ',
    'archive.kicker': 'アーカイブ // SPECIMEN-08',
    'archive.title': '涟のアーカイブ',
    'archive.empty': 'この区画の档案は未解封です。権限の开放をお待ちください。',
    'footer.note': 'SPECIMEN-08 · 潤いを忘れずに',
  },
} as const;

export type UIKey = keyof (typeof ui)['zh'];

export function t(locale: Locale) {
  return ui[locale] ?? ui.zh;
}
