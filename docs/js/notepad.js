/**
 * WCAI -- Global Notepad Module
 * ==============================
 * Floating action button + slide-in panel with auto-save textarea.
 * Attached to window.WCAI.notepad.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};

  var STORAGE_KEY_NOTES = "wcai_notes";
  var STORAGE_KEY_OPEN = "wcai_notepad_open";

  var panel = null;
  var fab = null;
  var textarea = null;
  var countEl = null;
  var saveTimer = null;

  function init() {
    fab = document.getElementById("notepad-fab");
    panel = document.getElementById("notepad-panel");
    textarea = document.getElementById("notepad-textarea");
    countEl = document.getElementById("notepad-count");

    if (!fab || !panel || !textarea) return;

    // Load saved notes
    try {
      var saved = localStorage.getItem(STORAGE_KEY_NOTES);
      if (saved) textarea.value = saved;
    } catch (e) { /* ignore */ }

    // Auto-save on input
    textarea.addEventListener("input", function () {
      updateCount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNotes, 300);
    });

    updateCount();

    // Restore open state
    try {
      if (localStorage.getItem(STORAGE_KEY_OPEN) === "true") {
        openPanel();
      }
    } catch (e) { /* ignore */ }
  }

  function toggle() {
    if (panel.classList.contains("open")) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    panel.classList.add("open");
    fab.style.display = "none";
    try { localStorage.setItem(STORAGE_KEY_OPEN, "true"); } catch (e) { /* ignore */ }
    textarea.focus();
  }

  function closePanel() {
    panel.classList.remove("open");
    fab.style.display = "";
    try { localStorage.setItem(STORAGE_KEY_OPEN, "false"); } catch (e) { /* ignore */ }
  }

  function saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY_NOTES, textarea.value);
    } catch (e) { /* ignore */ }
  }

  function updateCount() {
    if (countEl && textarea) {
      countEl.textContent = textarea.value.length + " chars";
    }
  }

  function clearNotes() {
    if (textarea) textarea.value = "";
    try {
      localStorage.removeItem(STORAGE_KEY_NOTES);
      localStorage.removeItem(STORAGE_KEY_OPEN);
    } catch (e) { /* ignore */ }
    updateCount();
    closePanel();
  }

  WCAI.notepad = {
    init: init,
    toggle: toggle,
    open: openPanel,
    close: closePanel,
    clearNotes: clearNotes,
  };
})();
