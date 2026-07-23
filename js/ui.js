/* =========================================================================
 * ui.js  —  RENDERING LAYER
 * -------------------------------------------------------------------------
 * This module is responsible for turning data into pixels and nothing else.
 * It:
 *   - reads/writes the DOM
 *   - asks the Data module for display values (totals, wear %, zones)
 *
 * It deliberately does NOT:
 *   - change any data
 *   - save anything to storage
 *   - decide business rules (those live in data.js)
 *
 * The controller (app.js) calls these functions and passes in callbacks for
 * user actions, so the UI stays a "dumb" view that is easy to swap out for a
 * native mobile UI later.
 *
 * Exposed on window.SMM.UI.
 * =======================================================================*/

window.SMM = window.SMM || {};

window.SMM.UI = (function () {
  'use strict';

  var Data = window.SMM.Data;

  // Cache of DOM references, filled in by init(). Keeping them in one place
  // means the rest of the module never has to re-query the document.
  var el = {};

  /**
   * Grab and cache every element the UI needs. Called once at startup.
   */
  function init() {
    el.alertBanner = document.getElementById('alert-banner');
    el.alertBannerText = document.getElementById('alert-banner-text');
    el.shoeList = document.getElementById('shoe-list');
    el.emptyState = document.getElementById('empty-state');
    el.shoeCount = document.getElementById('shoe-count');
    el.thresholdNote = document.getElementById('threshold-note');

    // Add-shoe form
    el.addForm = document.getElementById('add-shoe-form');
    el.shoeNameInput = document.getElementById('shoe-name');
    el.shoeBrandInput = document.getElementById('shoe-brand');
    el.addError = document.getElementById('add-shoe-error');

    // Log-session modal
    el.logModal = document.getElementById('log-modal');
    el.logForm = document.getElementById('log-session-form');
    el.logShoeId = document.getElementById('log-shoe-id');
    el.logHours = document.getElementById('log-hours');
    el.logDate = document.getElementById('log-date');
    el.logError = document.getElementById('log-session-error');
    el.logModalShoe = document.getElementById('log-modal-shoe');

    // Show the real threshold from the data layer so the copy never drifts
    // out of sync with the actual rule.
    if (el.thresholdNote) {
      el.thresholdNote.textContent = String(Data.WEAR_THRESHOLD_HOURS);
    }
  }

  // --------------------------------------------------------------------
  // SMALL DOM UTILITIES
  // --------------------------------------------------------------------

  /**
   * Escape user-supplied text before putting it into HTML, so a shoe named
   * "<script>" can never inject markup. Safety first, even for a local app.
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = String(text == null ? '' : text);
    return div.innerHTML;
  }

  /** Show an element by removing the shared `is-hidden` class. */
  function show(node) { if (node) { node.classList.remove('is-hidden'); } }

  /** Hide an element by adding the shared `is-hidden` class. */
  function hide(node) { if (node) { node.classList.add('is-hidden'); } }

  // --------------------------------------------------------------------
  // FORM ERROR HELPERS
  // --------------------------------------------------------------------

  /** Display an inline error under the add-shoe form. */
  function showAddError(message) {
    el.addError.textContent = message;
    show(el.addError);
    el.shoeNameInput.classList.add('field__input--error');
  }

  /** Clear the add-shoe form error state. */
  function clearAddError() {
    el.addError.textContent = '';
    hide(el.addError);
    el.shoeNameInput.classList.remove('field__input--error');
  }

  /** Display an inline error inside the log-session modal. */
  function showLogError(message) {
    el.logError.textContent = message;
    show(el.logError);
    el.logHours.classList.add('field__input--error');
  }

  /** Clear the log-session modal error state. */
  function clearLogError() {
    el.logError.textContent = '';
    hide(el.logError);
    el.logHours.classList.remove('field__input--error');
  }

  // --------------------------------------------------------------------
  // GLOBAL WARNING BANNER
  // --------------------------------------------------------------------

  /**
   * Show or hide the big warning banner based on how many shoes are worn out.
   * The wording comes straight from the requirement: memory gone, grip worn.
   * @param {Shoe[]} shoes
   */
  function renderAlertBanner(shoes) {
    var wornOut = Data.getWornOutShoes(shoes);

    if (wornOut.length === 0) {
      hide(el.alertBanner);
      return;
    }

    var message;
    if (wornOut.length === 1) {
      message = 'Heads up: your "' + wornOut[0].name +
        '" have passed ' + Data.WEAR_THRESHOLD_HOURS +
        ' hours. It might be tearing down, time to buy a new pair!';
    } else {
      message = wornOut.length + ' pairs have passed ' + Data.WEAR_THRESHOLD_HOURS +
        ' hours. Their foam memory is gone and the grip is wearing out — time to retire them.';
    }

    el.alertBannerText.textContent = message;
    show(el.alertBanner);
  }

  // --------------------------------------------------------------------
  // SHOE CARDS
  // --------------------------------------------------------------------

  /**
   * Build the inner HTML for a single shoe card. Pure string building — it
   * pulls every number from the Data layer so the card can never disagree
   * with the business rules.
   * @param {Shoe} shoe
   * @returns {string} HTML
   */
  function buildShoeCardHtml(shoe) {
    var total = Data.getTotalHours(shoe);
    var percent = Data.getWearPercent(shoe);
    var remaining = Data.getHoursRemaining(shoe);
    var zone = Data.getWearZone(shoe);            // fresh | moderate | warning | wornout
    var wornOut = Data.isWornOut(shoe);
    var sessionCount = shoe.sessions.length;

    // The progress bar is visually capped at 100% even when the true wear
    // is higher, so the fill never overflows the track.
    var barWidth = Math.min(percent, 100);

    // Short human label for the wear zone, shown as a pill on the card.
    var zoneLabel = {
      fresh: 'Fresh',
      moderate: 'Breaking in',
      warning: 'Almost done',
      wornout: 'Worn out'
    }[zone];

    var brandLine = shoe.brand
      ? '<p class="shoe-card__brand">' + escapeHtml(shoe.brand) + '</p>'
      : '';

    // A per-card warning strip, shown only when this specific shoe is worn out.
    var cardWarning = wornOut
      ? '<div class="shoe-card__warning" role="alert">' +
          '<span aria-hidden="true">⚠️</span> Memory gone &amp; grip worn — replace these.' +
        '</div>'
      : '';

    return '' +
      '<div class="shoe-card__top">' +
        '<div class="shoe-card__id">' +
          '<h3 class="shoe-card__name">' + escapeHtml(shoe.name) + '</h3>' +
          brandLine +
        '</div>' +
        '<span class="pill pill--' + zone + '">' + zoneLabel + '</span>' +
      '</div>' +

      '<div class="shoe-card__stats">' +
        '<div class="stat">' +
          '<span class="stat__value">' + formatHours(total) + '</span>' +
          '<span class="stat__label">hours played</span>' +
        '</div>' +
        '<div class="stat">' +
          '<span class="stat__value">' + (wornOut ? '0' : formatHours(remaining)) + '</span>' +
          '<span class="stat__label">hours left</span>' +
        '</div>' +
        '<div class="stat">' +
          '<span class="stat__value">' + sessionCount + '</span>' +
          '<span class="stat__label">' + (sessionCount === 1 ? 'session' : 'sessions') + '</span>' +
        '</div>' +
      '</div>' +

      // Progress bar toward the wear threshold.
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" ' +
           'aria-valuenow="' + Math.round(barWidth) + '">' +
        '<div class="progress__fill progress__fill--' + zone + '" style="width:' + barWidth + '%"></div>' +
      '</div>' +
      '<p class="shoe-card__percent">' + percent + '% of ' + Data.WEAR_THRESHOLD_HOURS + '-hour life</p>' +

      cardWarning +

      // Action buttons. data-* attributes let the controller know which shoe
      // and which action was tapped, using a single delegated listener.
      '<div class="shoe-card__actions">' +
        '<button class="btn btn--primary btn--small" data-action="log" data-id="' + shoe.id + '">' +
          '+ Log session' +
        '</button>' +
        '<button class="btn btn--danger-ghost btn--small" data-action="delete" data-id="' + shoe.id + '">' +
          'Delete' +
        '</button>' +
      '</div>';
  }

  /**
   * Format an hours number for display: drop the trailing ".0" on whole
   * numbers but keep decimals when they matter (e.g. 2 -> "2", 2.5 -> "2.5").
   * @param {number} hours
   * @returns {string}
   */
  function formatHours(hours) {
    var n = Number(hours) || 0;
    return (n % 1 === 0) ? String(n) : n.toFixed(2).replace(/0$/, '');
  }

  /**
   * Render the full list of shoe cards, plus the count and empty state.
   * @param {Shoe[]} shoes
   */
  function renderShoeList(shoes) {
    shoes = shoes || [];

    // Keep the header count in sync.
    el.shoeCount.textContent = String(shoes.length);

    // Toggle the friendly empty state.
    if (shoes.length === 0) {
      show(el.emptyState);
      el.shoeList.innerHTML = '';
      return;
    }
    hide(el.emptyState);

    // Build every card, wrapping each in a <li> with the wear zone as a class
    // hook so the card border can echo the shoe's condition.
    var html = shoes.map(function (shoe) {
      var zone = Data.getWearZone(shoe);
      return '<li class="shoe-card shoe-card--' + zone + '" data-id="' + shoe.id + '">' +
               buildShoeCardHtml(shoe) +
             '</li>';
    }).join('');

    el.shoeList.innerHTML = html;
  }

  /**
   * Master render: paint everything that depends on the data in one call.
   * The controller calls this after any change so the screen always reflects
   * the single source of truth.
   * @param {Shoe[]} shoes
   */
  function render(shoes) {
    renderAlertBanner(shoes);
    renderShoeList(shoes);
  }

  // --------------------------------------------------------------------
  // LOG-SESSION MODAL
  // --------------------------------------------------------------------

  /**
   * Open the modal ready to log a session for a specific shoe.
   * @param {Shoe} shoe
   */
  function openLogModal(shoe) {
    clearLogError();
    el.logForm.reset();
    el.logShoeId.value = shoe.id;
    el.logModalShoe.textContent = shoe.brand
      ? shoe.brand + ' · ' + shoe.name
      : shoe.name;
    el.logDate.value = Data.todayISO();      // default the date to today
    show(el.logModal);

    // Focus the hours field so the user can type immediately. A tiny delay
    // lets the show transition settle before we move focus on mobile.
    window.setTimeout(function () { el.logHours.focus(); }, 50);
  }

  /** Close and reset the log-session modal. */
  function closeLogModal() {
    hide(el.logModal);
    el.logForm.reset();
    clearLogError();
  }

  /** @returns {boolean} whether the log modal is currently open. */
  function isLogModalOpen() {
    return !el.logModal.classList.contains('is-hidden');
  }

  // --------------------------------------------------------------------
  // PUBLIC INTERFACE
  // --------------------------------------------------------------------
  return {
    init: init,
    el: el,                       // exposed so the controller can bind events

    render: render,
    renderShoeList: renderShoeList,
    renderAlertBanner: renderAlertBanner,

    showAddError: showAddError,
    clearAddError: clearAddError,
    showLogError: showLogError,
    clearLogError: clearLogError,

    openLogModal: openLogModal,
    closeLogModal: closeLogModal,
    isLogModalOpen: isLogModalOpen
  };
})();
