const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    preload: ['en', 'fr', 'rw'],
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
      loadPath: `${__dirname}/../locales/{{lng}}/{{ns}}.json`,
    },
    detection: {
      order: ['header', 'cookie', 'query'],
      caches: ['cookie'],
      lookupHeader: 'Accept-Language',
      lookupCookie: 'i18next',
      lookupQuery: 'lang',
    },
    interpolation: {
      escapeValue: false, // React already protects against XSS
    }
  });

module.exports = {
  i18next,
  middleware
};