// Centralized helpers for loading/saving user preferences and org settings via API.
// Replaces all direct localStorage usage for preferences, visible columns,
// selected layouts, tab configuration, home layout, filter presets, etc.

import { apiClient } from './api-client';

// ---- In-memory cache to avoid repeated API calls within a session ----
let prefsCache: Record<string, any> | null = null;
let prefsCachePromise: Promise<Record<string, any>> | null = null;

let settingsCache: Record<string, any> | null = null;
let settingsCachePromise: Promise<Record<string, any>> | null = null;

// Load all user preferences (cached per session)
async function loadAllPreferences(): Promise<Record<string, any>> {
  if (prefsCache) return prefsCache;
  if (prefsCachePromise) return prefsCachePromise;
  prefsCachePromise = apiClient.getPreferences().then(prefs => {
    prefsCache = prefs;
    prefsCachePromise = null;
    return prefs;
  }).catch(err => {
    console.warn('[Preferences] Failed to load:', err);
    prefsCachePromise = null;
    return {};
  });
  return prefsCachePromise;
}

// Load all settings (cached per session)  
async function loadAllSettings(): Promise<Record<string, any>> {
  if (settingsCache) return settingsCache;
  if (settingsCachePromise) return settingsCachePromise;
  settingsCachePromise = apiClient.getSettings().then(s => {
    settingsCache = s;
    settingsCachePromise = null;
    return s;
  }).catch(err => {
    console.warn('[Settings] Failed to load:', err);
    settingsCachePromise = null;
    return {};
  });
  return settingsCachePromise;
}

// ---- User Preferences (per-user) ----

export async function getPreference<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  const prefs = await loadAllPreferences();
  const val = prefs[key];
  return val !== undefined ? val : defaultValue;
}

export async function setPreference(key: string, value: any): Promise<void> {
  // Update cache immediately
  if (prefsCache) prefsCache[key] = value;
  // Fire and forget API save
  apiClient.setPreference(key, value).catch(err => {
    console.warn(`[Preferences] Failed to save "${key}":`, err);
  });
}

export async function deletePreference(key: string): Promise<void> {
  if (prefsCache) delete prefsCache[key];
  apiClient.deletePreference(key).catch(err => {
    console.warn(`[Preferences] Failed to delete "${key}":`, err);
  });
}

// ---- Org Settings (shared across all users) ----

export async function getSetting<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  const settings = await loadAllSettings();
  const val = settings[key];
  return val !== undefined ? val : defaultValue;
}

export async function setSetting(key: string, value: any): Promise<void> {
  if (settingsCache) settingsCache[key] = value;
  apiClient.setSetting(key, value).catch(err => {
    console.warn(`[Settings] Failed to save "${key}":`, err);
  });
}

// ---- Cache management ----

export function invalidatePrefsCache() {
  prefsCache = null;
  prefsCachePromise = null;
}

export function invalidateSettingsCache() {
  settingsCache = null;
  settingsCachePromise = null;
}

export function invalidateAllCaches() {
  invalidatePrefsCache();
  invalidateSettingsCache();
}
