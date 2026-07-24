/**
 * Bella Vista Studios — Kompakte Header-Pille beim Scrollen.
 *
 * Sobald über THRESHOLD Pixel gescrollt wurde, bekommt die Pille die Klasse
 * "is-compact" (siehe .nav-pill / .nav-links in style.css) — Work/Services/
 * Team klappen ein, übrig bleiben nur noch B-Monogramm und Contact-Button.
 * Das Wiederaufklappen bei Hover passiert rein per CSS (:hover-Selektor),
 * hier wird nur der Scroll-Zustand nachgeführt.
 */
(function () {
  "use strict";

  var pill = document.querySelector(".nav-pill");
  if (!pill) return;

  var THRESHOLD = 40;
  var ticking = false;

  function update() {
    ticking = false;
    pill.classList.toggle("is-compact", window.scrollY > THRESHOLD);
  }

  function requestUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  requestUpdate();
})();
