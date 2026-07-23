/* =========================================================================
 * storage.js  —  PERSISTENCE LAYER
 * -------------------------------------------------------------------------
 * This module is the ONLY place in the app that talks to the browser's
 * localStorage API. Everything else asks this module to read or write.
 *
 * Why isolate it?
 *   When this web app is later wrapped into a native mobile app, only this
 *   one file needs to change (e.g. swap localStorage for a native store
 *   such as Capacitor Preferences, SQLite, or AsyncStorage). The business
 *   logic and UI never touch the storage engine directly, so they can be
 *   reused untouched.
 *
 * It exposes a tiny, storage-agnostic interface on window.SMM.Storage:
 *   - read()        -> returns the saved array of shoes (or [] if none)
 *   - write(shoes)  -> saves the array of shoes, returns true/false
 *   - isAvailable() -> true if the storage engine can actually be used
 * =======================================================================*/

// Create the shared namespace once, then attach this module to it.
window.SMM = window.SMM || {};

window.SMM.Storage = (function () {
  'use strict';

  // The single key under which the whole dataset is stored. Versioned so a
  // future data-shape change can migrate cleanly instead of clobbering data.
  var STORAGE_KEY = 'smm.shoes.v1';

  /**
   * Feature-detect localStorage. Private browsing modes and locked-down
   * browsers can throw the moment you touch it, so we probe safely.
   * @returns {boolean} true when reads/writes are expected to succeed.
   */
  function isAvailable() {
    try {
      var testKey = '__smm_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (err) {
      // localStorage missing, disabled, or full.
      return false;
    }
  }

  /**
   * Load the saved list of shoes.
   * Always returns an array so callers never have to null-check. If the
   * stored data is missing or corrupt, we fail safe with an empty list
   * rather than letting a parse error crash the app.
   * @returns {Array} the saved shoes, or [] when nothing valid is stored.
   */
  function read() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      var parsed = JSON.parse(raw);

      // Guard against corrupted / unexpected data shapes.
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed;
    } catch (err) {
      // Corrupt JSON or a blocked storage engine — log and recover gracefully.
      console.error('[SMM.Storage] Could not read data, starting fresh:', err);
      return [];
    }
  }

  /**
   * Persist the full list of shoes.
   * @param {Array} shoes - the complete dataset to save.
   * @returns {boolean} true on success, false if the write failed.
   */
  function write(shoes) {
    try {
      var serialized = JSON.stringify(shoes || []);
      window.localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (err) {
      // Quota exceeded, storage disabled, or serialization error.
      console.error('[SMM.Storage] Could not save data:', err);
      return false;
    }
  }

  // Public interface — deliberately small so it is easy to re-implement
  // against a different storage engine on native platforms.
  return {
    isAvailable: isAvailable,
    read: read,
    write: write
  };
})();
