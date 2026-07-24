/**
 * Bella Vista Studios — Scroll-Effekt für die Projekt-Bilder.
 *
 * Jedes der 4 Projektbilder existiert nur EINMAL im DOM (im Projekte-Raster).
 * Beim Scrollen wird genau dieses eine Bild-Element vorübergehend "fixed"
 * positioniert und live zwischen seinem unsichtbaren Anker-Platz im Hero
 * (.hero-slot) und seiner tatsächlichen Position im Raster interpoliert.
 * Alle 4 Bilder folgen dabei demselben, gemeinsamen Scroll-Fortschritt — sie
 * setzen sich also gleichzeitig in Bewegung, nicht nacheinander.
 *
 * Solange ein Bild unterwegs ist, bleibt das Overlay der jeweiligen Karte
 * unsichtbar (siehe .js-morph/.is-docked in style.css) — es ist also wirklich
 * nichts zu sehen, bis das Bild an seiner finalen Position angekommen ist.
 *
 * Der Fortschritt hängt bewusst nur von der reinen Scroll-Distanz ab
 * (window.scrollY), nicht von der Position des Rasters relativ zum Viewport.
 * Dadurch steht bei scrollY = 0 (ganz oben) immer exakt der Hero-Fächer,
 * unabhängig von Viewport-Höhe oder der Höhe des Inhalts darüber (Hero,
 * Trusted-by, etc.) — eine vh-basierte Rechnung würde auf sehr hohen
 * Viewports (z.B. ein hochkant montierter externer Monitor) riesige
 * Pixelwerte für den Trigger ergeben und die Karten so schon beim Laden
 * (teilweise) andocken lassen, obwohl noch gar nicht gescrollt wurde.
 *
 * Läuft bewusst nicht auf kleinen oder sehr flachen Screens (z.B. Smartphone
 * im Vollbild-Querformat) oder bei reduzierter Bewegungspräferenz — dort
 * bleiben Bild und Overlay einfach direkt sichtbar.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isSmallScreen = window.matchMedia("(max-width: 860px)").matches;
  var isShortScreen = window.matchMedia("(max-height: 560px)").matches;
  if (reduceMotion || isSmallScreen || isShortScreen) return;

  var grid = document.querySelector(".projects-grid");
  // Nur die ursprünglichen 4 Karten animieren — die per Klick nachgeladenen
  // (.project-card--extra) haben kein passendes .hero-slot und bleiben außen vor.
  var cards = document.querySelectorAll(".projects-grid .project-card:not(.project-card--extra)");
  var heroSlots = document.querySelectorAll(".hero-slot");
  if (!grid || !cards.length || cards.length !== heroSlots.length) return;

  // Rotation, mit der jedes Bild im Hero-Fächer startet — blendet beim
  // Scrollen sanft auf 0 Grad (normale Rasterposition) aus.
  var startRotation = [-12, -4, 6, 14];

  // Max. Scroll-Strecke (px), über die vollständig angedockt wird — gedeckelt,
  // damit der Effekt auf sehr hohen Viewports nicht unnötig träge wird.
  var MAX_DOCK_DISTANCE = 450;

  grid.classList.add("js-morph");

  var ticking = false;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function updateCards() {
    ticking = false;
    var vh = window.innerHeight;
    var dockDistance = Math.min(vh * 0.5, MAX_DOCK_DISTANCE);

    // Fortschritt 0 → 1 rein anhand der Scroll-Position: bei scrollY = 0
    // (oberster Punkt der Seite) immer 0, nach "dockDistance" Pixeln
    // Scrollen vollständig angedockt.
    var progress = window.scrollY / dockDistance;
    progress = Math.min(1, Math.max(0, progress));

    grid.classList.toggle("is-docked", progress >= 1);

    cards.forEach(function (card, i) {
      var img = card.querySelector("img");
      if (!img) return;

      if (progress >= 1) {
        // Angekommen: Inline-Styling entfernen, Bild liegt normal im Raster.
        img.style.cssText = "";
        return;
      }

      var slotRect = heroSlots[i].getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      var top = lerp(slotRect.top, cardRect.top, progress);
      var left = lerp(slotRect.left, cardRect.left, progress);
      var width = lerp(slotRect.width, cardRect.width, progress);
      var height = lerp(slotRect.height, cardRect.height, progress);
      var rotation = lerp(startRotation[i], 0, progress);

      img.style.position = "fixed";
      img.style.margin = "0";
      img.style.top = top + "px";
      img.style.left = left + "px";
      img.style.width = width + "px";
      img.style.height = height + "px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "var(--radius-lg)";
      img.style.transform = "rotate(" + rotation.toFixed(2) + "deg)";
      img.style.zIndex = "60";
    });
  }

  function requestUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(updateCards);
      ticking = true;
    }
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  requestUpdate();
})();
