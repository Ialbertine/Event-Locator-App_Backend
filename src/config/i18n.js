const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');
const Backend = require('i18next-fs-backend');
const path = require('path');

// Language Resources Configuration
const resources = {
    en: {
        translation: {
            welcome: "Welcome to Event Locator",
            login: {
                success: "Login successful",
                error: "Invalid credentials"
            },
            events: {
                created: "Event created successfully",
                notFound: "No events found"
            }
        }
    },
    es: {
        translation: {
            welcome: "Bienvenido a Event Locator",
            login: {
                success: "Inicio de sesión exitoso",
                error: "Credenciales inválidas"
            },
            events: {
                created: "Evento creado exitosamente",
                notFound: "No se encontraron eventos"
            }
        }
    },
    fr: {
        translation: {
            welcome: "Bienvenue sur Event Locator",
            login: {
                success: "Connexion réussie",
                error: "Identifiants invalides"
            },
            events: {
                created: "Événement créé avec succès",
                notFound: "Aucun événement trouvé"
            }
        }
    }
};

// Internationalization Configuration
const i18nConfig = {
    // Fallback language
    fallbackLng: 'en',
    
    // Supported languages
    supportedLngs: ['en', 'es', 'fr'],
    
    // Language detection options
    detection: {
        order: ['header', 'cookie'],
        caches: ['cookie']
    },
    
    // Interpolation settings
    interpolation: {
        escapeValue: false  // React already escapes
    },
    
    // Backend configuration for loading translations
    backend: {
        loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json')
    }
};

// Initialize i18next
async function initializeI18n() {
  try {
    await i18next
      .use(Backend)
      .use(i18nextMiddleware.LanguageDetector)
      .init(i18nConfig);
    console.log('i18n initialized successfully');
  } catch (err) {
    console.error('i18n initialization failed:', err);
    throw err; // Crash the app if i18n fails
  }
}

// Middleware for Express
function i18nMiddleware() {
    return i18nextMiddleware.handle(i18next);
}

// Language Utility Functions
const LanguageUtils = {
    // Get available languages
    getSupportedLanguages() {
        return i18nConfig.supportedLngs;
    },
    
    // Translate a key with optional interpolation
    translate(key, options = {}) {
        return i18next.t(key, options);
    },
    
    // Change language dynamically
    changeLanguage(lng) {
        return i18next.changeLanguage(lng);
    }
};

module.exports = {
    initializeI18n,
    i18nMiddleware,
    LanguageUtils,
    resources
};