/* =========================================================================
 * data.js  —  DATA PROCESSING / BUSINESS LOGIC LAYER
 * -------------------------------------------------------------------------
 * This module contains ALL of the app's rules and calculations and NOTHING
 * else. It has:
 *   - no knowledge of the DOM (never touches the screen)
 *   - no knowledge of storage (never touches localStorage)
 *
 * Because it is pure logic, it is fully portable: the exact same file can
 * power a native mobile app later. The controller (app.js) feeds it plain
 * data and uses the results to drive the UI and storage layers.
 *
 * Data shapes used throughout the app:
 *
 *   Session = {
 *     id:    string,   // unique id
 *     hours: number,   // hours played in this single session (> 0)
 *     date:  string    // ISO date, e.g. "2026-07-22"
 *   }
 *
 *   Shoe = {
 *     id:        string,     // unique id
 *     name:      string,     // e.g. "Kobe 6 Protro"
 *     brand:     string,     // e.g. "Nike" (may be empty)
 *     createdAt: string,     // ISO timestamp when the shoe was added
 *     sessions:  Session[]   // running history of every logged session
 *   }
 *
 * Exposed on window.SMM.Data.
 * =======================================================================*/

window.SMM = window.SMM || {};

window.SMM.Data = (function () {
  'use strict';

  // --------------------------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------------------------

  // The number of playtime hours after which the foam memory is considered
  // gone and the grip worn out. Change this one value to re-tune the app.
  var WEAR_THRESHOLD_HOURS = 50;

  // Wear "zones" as fractions of the threshold. Used to colour the UI and
  // decide how urgent the on-screen messaging should be. Kept here (not in
  // the UI) because "how worn is this shoe" is a business decision.
  var WEAR_ZONES = {
    FRESH: 'fresh',       //   0%  – 59%  of threshold: plenty of life left
    MODERATE: 'moderate', //  60%  – 84%  : noticeable break-in
    WARNING: 'warning',   //  85%  – 99%  : nearly worn out
    WORN_OUT: 'wornout'   // 100%+        : replace them
  };

  // --------------------------------------------------------------------
  // ID + FACTORY HELPERS
  // --------------------------------------------------------------------

  /**
   * Generate a reasonably unique id without any external dependency.
   * Combines the current time with a random suffix.
   * @returns {string}
   */
  function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Build a brand-new shoe object from raw user input.
   * Trims the text but does NOT validate here — validation lives in its own
   * function so the controller can show friendly errors before creating.
   * @param {string} name  - shoe name.
   * @param {string} brand - brand (optional).
   * @returns {Shoe}
   */
  function createShoe(name, brand) {
    return {
      id: generateId(),
      name: String(name || '').trim(),
      brand: String(brand || '').trim(),
      createdAt: new Date().toISOString(),
      sessions: []
    };
  }

  /**
   * Build a new session object from already-validated values.
   * @param {number} hours - positive number of hours played.
   * @param {string} date  - ISO date string (defaults to today).
   * @returns {Session}
   */
  function createSession(hours, date) {
    return {
      id: generateId(),
      hours: hours,
      date: date || todayISO()
    };
  }

  /** @returns {string} today's date as an ISO "YYYY-MM-DD" string. */
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // --------------------------------------------------------------------
  // VALIDATION  (the "does not break on letters instead of numbers" rule)
  // --------------------------------------------------------------------

  /**
   * Validate and normalise an hours value typed by the user.
   * This is the single guard that stops bad input (letters, blanks, negative
   * numbers, absurdly large numbers) from ever reaching the calculations.
   *
   * @param {*} rawValue - whatever came out of the input box (usually a string).
   * @returns {{ ok: boolean, value?: number, error?: string }}
   *          ok:true with a clean numeric `value`, or ok:false with a
   *          human-readable `error` message.
   */
  function validateHours(rawValue) {
    // Treat undefined/null as an empty string so trim() is always safe.
    var text = String(rawValue == null ? '' : rawValue).trim();

    if (text === '') {
      return { ok: false, error: 'Please enter how many hours you played.' };
    }

    // Number() returns NaN for anything that is not a clean number, which
    // is exactly how we catch letters like "abc" or "2h".
    var num = Number(text);

    if (!isFinite(num) || isNaN(num)) {
      return { ok: false, error: 'Hours must be a number (e.g. 1.5).' };
    }
    if (num <= 0) {
      return { ok: false, error: 'Hours must be greater than zero.' };
    }
    if (num > 24) {
      // A single logged session over 24 hours is almost certainly a typo.
      return { ok: false, error: 'That is more than 24 hours — please check the value.' };
    }

    // Round to two decimals to avoid floating point noise piling up.
    return { ok: true, value: Math.round(num * 100) / 100 };
  }

  /**
   * Validate a shoe name typed by the user.
   * @param {*} rawName
   * @returns {{ ok: boolean, value?: string, error?: string }}
   */
  function validateShoeName(rawName) {
    var text = String(rawName == null ? '' : rawName).trim();

    if (text === '') {
      return { ok: false, error: 'Give your shoes a name so you can tell them apart.' };
    }
    if (text.length > 40) {
      return { ok: false, error: 'That name is a bit long — keep it under 40 characters.' };
    }
    return { ok: true, value: text };
  }

  // --------------------------------------------------------------------
  // CORE CALCULATIONS  (the "running history of foam compression" rules)
  // --------------------------------------------------------------------

  /**
   * Add a session to a shoe and return the UPDATED shoe.
   * Returns a new object (does not mutate the input) so callers control
   * exactly when state changes — a habit that keeps future native/reactive
   * ports predictable.
   * @param {Shoe} shoe
   * @param {Session} session
   * @returns {Shoe}
   */
  function addSessionToShoe(shoe, session) {
    var updatedSessions = shoe.sessions.concat([session]);
    return Object.assign({}, shoe, { sessions: updatedSessions });
  }

  /**
   * Total hours ever played in a shoe — the sum of every session.
   * This running total IS the "foam compression time" the app monitors.
   * @param {Shoe} shoe
   * @returns {number}
   */
  function getTotalHours(shoe) {
    if (!shoe || !Array.isArray(shoe.sessions)) {
      return 0;
    }
    var total = shoe.sessions.reduce(function (sum, session) {
      // Defensive: ignore any session whose hours somehow are not numeric.
      var h = Number(session.hours);
      return sum + (isFinite(h) ? h : 0);
    }, 0);
    return Math.round(total * 100) / 100;
  }

  /**
   * How far through its life a shoe is, as a percentage of the threshold.
   * Not capped, so a heavily-used shoe can read above 100%.
   * @param {Shoe} shoe
   * @returns {number} e.g. 42.5 means 42.5% of the way to worn out.
   */
  function getWearPercent(shoe) {
    var pct = (getTotalHours(shoe) / WEAR_THRESHOLD_HOURS) * 100;
    return Math.round(pct * 10) / 10;
  }

  /**
   * Hours remaining before the shoe crosses the wear threshold.
   * Never negative — a worn-out shoe simply has 0 hours left.
   * @param {Shoe} shoe
   * @returns {number}
   */
  function getHoursRemaining(shoe) {
    var remaining = WEAR_THRESHOLD_HOURS - getTotalHours(shoe);
    return remaining > 0 ? Math.round(remaining * 100) / 100 : 0;
  }

  /**
   * Has this shoe passed the wear threshold?
   * @param {Shoe} shoe
   * @returns {boolean}
   */
  function isWornOut(shoe) {
    return getTotalHours(shoe) >= WEAR_THRESHOLD_HOURS;
  }

  /**
   * Classify a shoe into a wear zone (fresh / moderate / warning / wornout).
   * The UI uses this to pick colours and messages — but the decision itself
   * is business logic and therefore lives here.
   * @param {Shoe} shoe
   * @returns {string} one of WEAR_ZONES.
   */
  function getWearZone(shoe) {
    var pct = getWearPercent(shoe);
    if (pct >= 100) {
      return WEAR_ZONES.WORN_OUT;
    }
    if (pct >= 85) {
      return WEAR_ZONES.WARNING;
    }
    if (pct >= 60) {
      return WEAR_ZONES.MODERATE;
    }
    return WEAR_ZONES.FRESH;
  }

  /**
   * Return only the shoes that are worn out. Handy for building the global
   * warning banner in one line.
   * @param {Shoe[]} shoes
   * @returns {Shoe[]}
   */
  function getWornOutShoes(shoes) {
    return (shoes || []).filter(isWornOut);
  }

  // --------------------------------------------------------------------
  // PUBLIC INTERFACE
  // --------------------------------------------------------------------
  return {
    // config (read-only for callers)
    WEAR_THRESHOLD_HOURS: WEAR_THRESHOLD_HOURS,
    WEAR_ZONES: WEAR_ZONES,

    // factories
    createShoe: createShoe,
    createSession: createSession,
    todayISO: todayISO,

    // validation
    validateHours: validateHours,
    validateShoeName: validateShoeName,

    // calculations
    addSessionToShoe: addSessionToShoe,
    getTotalHours: getTotalHours,
    getWearPercent: getWearPercent,
    getHoursRemaining: getHoursRemaining,
    isWornOut: isWornOut,
    getWearZone: getWearZone,
    getWornOutShoes: getWornOutShoes
  };
})();
