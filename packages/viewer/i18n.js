const SUPPORTED = ['uz', 'ru', 'en'];
const _raw = new URLSearchParams(location.search).get('lang') ?? 'ru';

export const lang = SUPPORTED.includes(_raw) ? _raw : 'ru';

const i18n = {
  uz: {
    'btn.exit':      'Chiqish',
    'panel.close':   'Yopish',
    'error.load':    'Turni yuklashda xatolik yuz berdi',
    'video.offline': 'Video oflayn rejimda mavjud emas',
  },
  ru: {
    'btn.exit':      'Выход',
    'panel.close':   'Закрыть',
    'error.load':    'Ошибка загрузки тура',
    'video.offline': 'Видео недоступно в офлайн-режиме',
  },
  en: {
    'btn.exit':      'Exit',
    'panel.close':   'Close',
    'error.load':    'Failed to load tour',
    'video.offline': 'Video unavailable offline',
  },
};

export function t(key) {
  return i18n[lang]?.[key] ?? i18n['ru'][key] ?? key;
}
