/* =========================================================================
 * app.js  —  CONTROLLER
 * -------------------------------------------------------------------------
 * The "glue" that connects the three independent layers:
 *
 *     Storage (persistence)  <-->  App (this file)  <-->  UI (rendering)
 *                                     |
 *                                     v
 *                              Data (business logic)
 *
 * The controller is the only place that knows about all layers at once. It:
 *   1. holds the in-memory list of shoes (the single source of truth),
 *   2. listens for user actions from the UI,
 *   3. asks the Data layer to compute / validate,
 *   4. saves through the Storage layer,
 *   5. tells the UI to re-render.
 *
 * Keeping this orchestration separate from both the calculations and the
 * DOM is what makes the app easy to re-target to a native shell later.
 * =======================================================================*/

(function () {
  'use strict';

  var Storage = window.SMM.Storage;
  var Data = window.SMM.Data;
  var UI = window.SMM.UI;

  // The one and only copy of the app state held in memory. Every change
  // flows: mutate this array -> persist() -> UI.render(). Nothing reads
  // straight from storage or the DOM.
  var shoes = [];

  // ------------------------------------------------------------------
  // STATE HELPERS
  // ------------------------------------------------------------------

  /**
   * Persist the current state and repaint the screen. Called after every
   * change so storage and UI always match the in-memory truth.
   */
  function commit() {
    var saved = Storage.write(shoes);
    if (!saved) {
      // Non-fatal: the app keeps working for this session even if the write
      // fails (e.g. storage full or blocked). We just let the user know.
      console.warn('[SMM] Changes could not be saved to this device.');
    }
    UI.render(shoes);
  }

  /**
   * Find a shoe by id.
   * @param {string} id
   * @returns {Shoe|undefined}
   */
  function findShoe(id) {
    return shoes.filter(function (s) { return s.id === id; })[0];
  }

  // ------------------------------------------------------------------
  // ACTIONS  (user intentions expressed as small, testable functions)
  // ------------------------------------------------------------------

  /**
   * Handle submission of the "add a pair" form.
   * @param {Event} event
   */
  function handleAddShoe(event) {
    event.preventDefault();
    UI.clearAddError();

    // Validate the name through the Data layer so the rule lives in one place.
    var nameCheck = Data.validateShoeName(UI.el.shoeNameInput.value);
    if (!nameCheck.ok) {
      UI.showAddError(nameCheck.error);
      return;
    }

    var brand = UI.el.shoeBrandInput.value;

    // Create and store.
    var shoe = Data.createShoe(nameCheck.value, brand);
    shoes.unshift(shoe);   // newest first
    commit();

    // Reset the form for the next entry and return focus to the name field.
    UI.el.addForm.reset();
    UI.el.shoeNameInput.focus();
  }

  /**
   * Handle submission of the "log a session" modal form.
   * @param {Event} event
   */
  function handleLogSession(event) {
    event.preventDefault();
    UI.clearLogError();

    var shoe = findShoe(UI.el.logShoeId.value);
    if (!shoe) {
      // The shoe vanished (e.g. deleted in another tab) — fail gracefully.
      UI.showLogError('That shoe could not be found. Please close and try again.');
      return;
    }

    // Validate hours. THIS is the guard that keeps letters / bad numbers out.
    var hoursCheck = Data.validateHours(UI.el.logHours.value);
    if (!hoursCheck.ok) {
      UI.showLogError(hoursCheck.error);
      return;
    }

    // Use the picked date, defaulting to today if the field was cleared.
    var date = UI.el.logDate.value || Data.todayISO();

    // Build the session and fold it into the shoe (immutably), then swap the
    // updated shoe back into the list in place.
    var session = Data.createSession(hoursCheck.value, date);
    var updatedShoe = Data.addSessionToShoe(shoe, session);

    shoes = shoes.map(function (s) {
      return s.id === updatedShoe.id ? updatedShoe : s;
    });

    commit();
    UI.closeLogModal();
  }

  /**
   * Delete a shoe after a confirmation prompt.
   * @param {string} id
   */
  function handleDeleteShoe(id) {
    var shoe = findShoe(id);
    if (!shoe) {
      return;
    }

    // Simple, dependency-free confirmation. A native app would swap this for
    // a platform dialog — but the surrounding logic would stay identical.
    var ok = window.confirm('Delete "' + shoe.name + '" and its session history?');
    if (!ok) {
      return;
    }

    shoes = shoes.filter(function (s) { return s.id !== id; });
    commit();
  }

  /**
   * A single delegated click handler for every shoe card button. Reading the
   * action + id from data-* attributes means we bind ONE listener instead of
   * re-wiring buttons on every render.
   * @param {Event} event
   */
  function handleShoeListClick(event) {
    var button = event.target.closest('[data-action]');
    if (!button) {
      return;
    }

    var action = button.getAttribute('data-action');
    var id = button.getAttribute('data-id');

    if (action === 'log') {
      var shoe = findShoe(id);
      if (shoe) {
        UI.openLogModal(shoe);
      }
    } else if (action === 'delete') {
      handleDeleteShoe(id);
    }
  }

  // ------------------------------------------------------------------
  // EVENT WIRING
  // ------------------------------------------------------------------

  /**
   * Attach every event listener the app needs. Done once at startup.
   */
  function bindEvents() {
    // Add-shoe form submit.
    UI.el.addForm.addEventListener('submit', handleAddShoe);

    // Clear the inline error as soon as the user starts fixing the name.
    UI.el.shoeNameInput.addEventListener('input', UI.clearAddError);

    // Log-session form submit.
    UI.el.logForm.addEventListener('submit', handleLogSession);
    UI.el.logHours.addEventListener('input', UI.clearLogError);

    // Delegated clicks for the whole shoe list (log / delete buttons).
    UI.el.shoeList.addEventListener('click', handleShoeListClick);

    // Any element marked data-close-modal closes the log modal (backdrop +
    // cancel button both use it).
    UI.el.logModal.addEventListener('click', function (event) {
      if (event.target.hasAttribute('data-close-modal')) {
        UI.closeLogModal();
      }
    });

    // Escape key closes the modal, matching native "back to dismiss" feel.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && UI.isLogModalOpen()) {
        UI.closeLogModal();
      }
    });
  }

  // ------------------------------------------------------------------
  // STARTUP
  // ------------------------------------------------------------------

  /**
   * Boot the app: cache DOM refs, warn if storage is unavailable, load any
   * saved data, wire events, and paint the first frame.
   */
  function start() {
    UI.init();

    // If localStorage is blocked (e.g. private mode), the app still runs but
    // nothing will persist between reloads — tell the developer via console.
    if (!Storage.isAvailable()) {
      console.warn('[SMM] Local storage is unavailable — data will not be saved between sessions.');
    }

    // Load previously saved shoes (returns [] if none / corrupt).
    shoes = Storage.read();

    bindEvents();
    UI.render(shoes);
  }

  // Wait for the DOM to be parsed before touching it.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
