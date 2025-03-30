// Update to your config/i18n.js file

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
                notFound: "No events found",
                updated: "Event updated successfully",
                reminder: "Reminder: {{event}} is starting at {{time}}",
                cancelled: "Event cancelled",
                updated: "Event {{event}} has been updated: {{changes}} changed"
            },
            notifications: {
                notFound: "Notification not found",
                allMarkedAsRead: "All notifications marked as read",
                deleted: "Notification deleted",
                created: "Notification created"
            },
            validation: {
                missingFields: "Required fields missing"
            },
            auth: {
                forbidden: "Forbidden - You do not have permission to perform this action"
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
                notFound: "No se encontraron eventos",
                updated: "Evento actualizado con éxito",
                reminder: "Recordatorio: {{event}} comienza a las {{time}}",
                cancelled: "Evento cancelado",
                updated: "El evento {{event}} ha sido actualizado: {{changes}} cambiados"
            },
            notifications: {
                notFound: "Notificación no encontrada",
                allMarkedAsRead: "Todas las notificaciones marcadas como leídas",
                deleted: "Notificación eliminada",
                created: "Notificación creada"
            },
            validation: {
                missingFields: "Faltan campos requeridos"
            },
            auth: {
                forbidden: "Prohibido - No tienes permiso para realizar esta acción"
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
                notFound: "Aucun événement trouvé",
                updated: "Événement mis à jour avec succès",
                reminder: "Rappel: {{event}} commence à {{time}}",
                cancelled: "Événement annulé",
                updated: "L'événement {{event}} a été mis à jour: {{changes}} modifiés"
            },
            notifications: {
                notFound: "Notification introuvable",
                allMarkedAsRead: "Toutes les notifications marquées comme lues",
                deleted: "Notification supprimée",
                created: "Notification créée"
            },
            validation: {
                missingFields: "Champs obligatoires manquants"
            },
            auth: {
                forbidden: "Interdit - Vous n'avez pas la permission d'effectuer cette action"
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
    throw err;
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