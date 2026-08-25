export const SITE_TITLE = '涟 · Lian';
export const SITE_DESCRIPTION = '深海海蛞蝓 × 白色犬兽人共生体 OC 设定集与研究员日志';
export const EMAIL = 'HeyuChick@foxmail.com';
export const GITHUB_URL = 'https://github.com/HeyuChick';

export const LOCALES = ['zh', 'en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh';

export const HTML_LANG: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en',
  ja: 'ja',
};

// 情绪色彩系统：mood 驱动每页/每篇文章的强调色
export const MOODS = {
  calm: { color: '#7fb8a4', label: { zh: '平静', en: 'Calm', ja: '穏やか' } },
  joy: { color: '#f2c14e', label: { zh: '雀跃', en: 'Joy', ja: 'ときめき' } },
  gloom: { color: '#5d6d9e', label: { zh: '低气压', en: 'Gloom', ja: '低気圧' } },
  warm: { color: '#e08e79', label: { zh: '温暖', en: 'Warm', ja: 'あたたかい' } },
} as const;
export type Mood = keyof typeof MOODS;
