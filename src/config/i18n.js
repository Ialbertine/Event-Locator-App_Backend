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
                updated: "Event {{event}} has been updated: {{changes}} changed",
                creatorUpdate: "You updated your event '{{title}}'. Changes: {{changes}}",
                creatorDelete: "You deleted your event '{{title}}'"
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
            },
            email: {
                eventUpdate: {
                    subject: "Event Update: {{event}}"
                },
                eventReminder: {
                    subject: "Event Reminder: {{event}}"
                },
                event_update: {
                    subject: "Update to Your Event: {{event}}"
                },
                event_delete: {
                    subject: "Event Deleted: {{event}}"
                }
            }
        }
    },
    ki: {
        translation: {
            welcome: "Murakaza neza kuri Event Locator",
            login: {
                success: "Winjiye neza",
                error: "Ibyanditswe ntabwo ari byo"
            },
            events: {
                created: "Ikintu cyagenze neza",
                notFound: "Ntamikorere yabonetse",
                updated: "Ikintu cyahinduwe neza",
                reminder: "Iburira: {{event}} bizatangira saa {{time}}",
                cancelled: "Ikintu cyahagaritswe",
                updated: "Ikintu {{event}} cyahinduwe: {{changes}} byahinduwe",
                creatorUpdate: "Wahinduye ikintu wa '{{title}}'. Impinduka: {{changes}}",
                creatorDelete: "Wasibye ikintu wa '{{title}}'"
            },
            notifications: {
                notFound: "Iburira ntibonetse",
                allMarkedAsRead: "Amaburira yose yanditswe ko yasomwe",
                deleted: "Iburira risibwe",
                created: "Iburira ryakozwe"
            },
            validation: {
                missingFields: "Ibisabwa ntibibonetse"
            },
            auth: {
                forbidden: "Birabujijwe - Ntugomba uburenganzira bwo gukora iki gikorwa"
            },
            email: {
                eventUpdate: {
                    subject: "Impinduka ku kintu: {{event}}"
                },
                eventReminder: {
                    subject: "Iburira ku kintu: {{event}}"
                },
                event_update: {
                    subject: "Impinduka ku kintu wawe: {{event}}"
                },
                event_delete: {
                    subject: "Ikintu gisibwe: {{event}}"
                }
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
                updated: "L'événement {{event}} a été mis à jour: {{changes}} modifiés",
                creatorUpdate: "Vous avez mis à jour votre événement '{{title}}'. Changements: {{changes}}",
                creatorDelete: "Vous avez supprimé votre événement '{{title}}'"
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
            },
            email: {
                eventUpdate: {
                    subject: "Mise à jour d'événement: {{event}}"
                },
                eventReminder: {
                    subject: "Rappel d'événement: {{event}}"
                },
                event_update: {
                    subject: "Mise à jour de votre événement: {{event}}"
                },
                event_delete: {
                    subject: "Événement supprimé: {{event}}"
                }
            }
        }
    }
};

// Internationalization Configuration
const i18nConfig = {
    fallbackLng: 'en',
    supportedLngs: ['en', 'ki', 'fr'],
    detection: {
        order: ['header', 'cookie'],
        caches: ['cookie']
    },
    interpolation: {
        escapeValue: false
    },
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
    getSupportedLanguages() {
        return i18nConfig.supportedLngs;
    },
    
    translate(key, options = {}, config = {}) {
        return i18next.t(key, {...options, ...config});
    },
    
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