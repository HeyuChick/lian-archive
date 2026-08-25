import type { Locale } from '../consts';

export const ui = {
  zh: {
    'nav.blog': '研究员日志',
    'nav.archive': '涟的档案',
    'archive.empty': '档案整理中，敬请期待。',
  },
  en: {
    'nav.blog': "Researcher's Log",
    'nav.archive': "Lian's Archive",
    'archive.empty': 'Archives in progress. Stay tuned.',
  },
  ja: {
    'nav.blog': '研究員ログ',
    'nav.archive': '涟のアーカイブ',
    'archive.empty': 'アーカイブ整理中。',
  },
} as const;

export type UIKey = keyof (typeof ui)['zh'];

export function t(locale: Locale) {
  return ui[locale] ?? ui.zh;
}
