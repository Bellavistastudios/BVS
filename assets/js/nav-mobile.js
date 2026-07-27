/**
 * Bella Vista Studios — Mobiles Menü (Vollbild-Overlay).
 *
 * Ersatz für die auf Mobile ausgeblendeten .nav-links (siehe style.css,
 * @media max-width:860px): der Hamburger-Button (.nav-mobile-toggle) blendet
 * ein Vollbild-Overlay (.nav-mobile-panel) mit denselben Links ein/aus.
 * Gleiches hidden-Muster wie #team-modal (siehe assets/js/team-modal.js).
 *
 * Derselbe Button öffnet UND schließt (kein separater Close-Button mehr) —
 * er bleibt dadurch beim Öffnen/Schließen exakt an derselben Stelle im
 * Header stehen, nur sein Inhalt morpht per .is-open (siehe style.css) von
 * 3 Strichen zu einem X. .site-header bekommt dafür auf Mobile einen
 * höheren z-index als .nav-mobile-panel (siehe style.css), sonst würde der
 * Button hinter dem geöffneten Panel verschwinden.
 */
(function () {
  "use strict";

  var toggle = document.querySelector(".nav-mobile-toggle");
  var panel = document.getElementById("nav-mobile-panel");
  if (!toggle || !panel) return;

  function open() {
    panel.hidden = false;
    toggle.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Menü schließen");
    document.body.style.overflow = "hidden";
  }

  function close() {
    panel.hidden = true;
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Menü öffnen");
    document.body.style.overflow = "";
  }

  toggle.addEventListener("click", function () {
    if (panel.hidden) {
      open();
    } else {
      close();
    }
  });

  // Menü-Links selbst schließen das Panel zusätzlich beim Antippen (bevor
  // der Browser zur Ziel-Sektion navigiert) — der Hamburger/X-Button oben
  // übernimmt jetzt allein das manuelle Öffnen/Schließen.
  panel.querySelectorAll("a").forEach(function (el) {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) close();
  });

  // iOS Safari wendet :active (siehe .nav-mobile-card a:active in style.css)
  // auf Touch-Geräten nur an, wenn irgendwo im Dokument ein touchstart-
  // Listener hängt — ohne diesen Leerlauf-Listener bliebe der Pink-Tap-
  // Effekt auf den Menü-Wörtern auf dem iPhone komplett aus.
  document.addEventListener("touchstart", function () {}, { passive: true });

  // Fenster wird über den Mobile-Breakpoint hinaus vergrößert (z.B. Tablet-
  // Rotation ins Querformat oder Fenster am Desktop breiter gezogen) —
  // Menü hat dort keinen sichtbaren Hamburger mehr, der es schließen könnte,
  // also automatisch schließen statt es unsichtbar offen hängen zu lassen.
  var mobileQuery = window.matchMedia("(max-width: 860px)");
  mobileQuery.addEventListener("change", function (e) {
    if (!e.matches) close();
  });
})();
