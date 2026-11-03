// App-level identity and contact settings used by foundation UI (footer, legal pages, auth page).
// Shared/isomorphic — safe for client and server. Other Isaly apps keep a file with this same
// shape; only the values differ.

export const APP_NAME = "Studieplan";

// TODO: confirm support address with Isaly before relying on it in production.
export const SUPPORT_EMAIL = "support@isaly.se";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
