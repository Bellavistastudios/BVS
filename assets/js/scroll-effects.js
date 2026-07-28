/**
 * Bella Vista Studios — Scroll-Effekt für die Projekt-Bilder (Desktop-only).
 *
 * Jedes der 4 Projektbilder existiert nur EINMAL im DOM (im Projekte-Raster).
 * Es wird vorübergehend "fixed" positioniert und zwischen seinem unsichtbaren
 * Anker-Platz im Hero (.hero-slot) und seiner tatsächlichen Position im
 * Raster interpoliert. Alle 4 Bilder folgen demselben Fortschritt (0 → 1) —
 * sie setzen sich also gleichzeitig in Bewegung, nicht nacheinander.
 * Fortschritt hängt kontinuierlich an der Scroll-Position: bei scrollY = 0
 * steht der Fächer, nach "dockDistance" Pixeln Scrollen ist er angedockt.
 * dockDistance richtet sich nach der tatsächlichen Hero-Höhe (measureHero()),
 * damit die Karten sichtbar bleiben, solange der Hero überhaupt im Bild ist.
 *
 * Solange ein Bild "unterwegs" ist (progress < 1), bleibt das Overlay der
 * jeweiligen Karte unsichtbar (siehe .js-morph/.is-docked in style.css).
 *
 * NUR Desktop (Breite > MOBILE_BREAKPOINT). Auf Mobile lief hier früher eine
 * eigene, zum Scrollen gekoppelte Variante desselben Effekts — mehrere
 * Anläufe (Layout-Thrashing beheben, auf reines transform umstellen, an
 * scrollY statt an einen Timer koppeln, Seitenverhältnisse angleichen)
 * haben die Bildqualität/Sauberkeit spürbar verbessert, aber auf schwächeren
 * Handys nie zu einer wirklich flüssigen Bewegung geführt: ein Flug zwischen
 * zwei weit auseinanderliegenden DOM-Positionen mit Größenänderung ist für
 * Mobile-Browser grundsätzlich einer der teureren Effekte, unabhängig von
 * Detail-Optimierungen. Mobile bekommt die 4 Karten deshalb bewusst NICHT
 * mehr von hier, sondern von assets/js/scroll-reveal.js — dort laufen sie
 * einfach im normalen Fluss des Rasters mit und blenden beim Scrollen sanft
 * ein wie jede andere Karte/Sektion auch (siehe dortiger Kommentar zu
 * "hasHeroFanOnDesktop"). .hero-visual (der Fächer-Platzhalter im Hero)
 * ist auf Mobile deshalb per CSS ausgeblendet, siehe Responsive-Bereich in
 * style.css.
 */
(function () {
  "use strict";

  // Browser stellen beim Reload gerne die vorherige Scroll-Position wieder
  // her (history.scrollRestoration = "auto" per Default). "manual" erzwingt,
  // dass ein frischer Aufruf immer oben startet.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  // Steht noch ein #kontakt/#leistungen/#team-Hash von einer früheren
  // Navigation in der URL (z.B. weil man vorher auf "Contact" getippt
  // hatte), springt der BROWSER SELBST beim Neuladen zu diesem Anker —
  // unabhängig von jedem eigenen scrollTo() hier, und oft sogar erst nach
  // dem ersten Layout-Durchlauf (Web-Font/Bilder laden nach), sodass ein
  // einzelnes scrollTo(0,0) ganz am Anfang das nicht zuverlässig
  // überstimmt. Nur bei einem ECHTEN Reload (nicht bei einem frischen Klick
  // von einer anderen Seite auf z.B. "index.html#kontakt", der soll
  // weiterhin normal zur Sektion springen) wird der Hash deshalb per
  // replaceState aus der URL entfernt, bevor der Browser ihn anfassen kann.
  function isReload() {
    if (window.performance && typeof window.performance.getEntriesByType === "function") {
      var entries = window.performance.getEntriesByType("navigation");
      if (entries.length) return entries[0].type === "reload";
    }
    if (window.performance && window.performance.navigation) {
      return window.performance.navigation.type === 1;
    }
    return false;
  }

  if (window.location.hash && isReload()) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  window.scrollTo(0, 0);
  // Zusätzliche, spätere Bestätigung: falls der Browser trotz entferntem
  // Hash durch nachträgliche Layout-Verschiebungen (Web-Font/Bilder) doch
  // noch einmal scrollt, hier nach vollständigem Laden hart zurück auf 0.
  window.addEventListener("load", function () {
    window.scrollTo(0, 0);
  });

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var MOBILE_BREAKPOINT = 860;
  if (window.innerWidth <= MOBILE_BREAKPOINT) return;

  var grid = document.querySelector(".projects-grid");
  var hero = document.querySelector(".hero");
  // Nur die ursprünglichen 4 Karten animieren — die per Klick nachgeladenen
  // (.project-card--extra) haben kein passendes .hero-slot und bleiben außen vor.
  var cards = document.querySelectorAll(".projects-grid .project-card:not(.project-card--extra)");
  var heroSlots = document.querySelectorAll(".hero-slot");
  if (!grid || !hero || !cards.length || cards.length !== heroSlots.length) return;

  // Rotation, mit der jedes Bild im Hero-Fächer startet — blendet beim
  // Andocken sanft auf 0 Grad (normale Rasterposition) aus.
  var startRotation = [-12, -4, 6, 14];

  // Stapel-Reihenfolge im Fächer: Karten-Index (0=Agrar Tirol, 1=Autopark,
  // 2=Lightweight, 3=Corthea) → z-index. Autopark (Index 1) soll zuoberst
  // liegen, die übrige Reihenfolge bleibt wie vorher.
  var stackZIndex = [60, 63, 61, 62];

  grid.classList.add("js-morph");

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Puffer, der vom Andock-Zeitpunkt abgezogen wird, damit die Karten
  // nicht erst im exakten Moment des Verschwindens andocken, sondern
  // schon kurz (20% einer Viewport-Höhe) davor — "kurz bevor" statt
  // "genau wenn".
  var EXIT_BUFFER_RATIO = 0.2;
  var heroBottomAbs = 0;
  var ticking = false;

  // Erst ALLE getBoundingClientRect()-Werte einsammeln, danach erst die
  // Styles schreiben — statt pro Karte lesen/schreiben/lesen/schreiben zu
  // verschränken. Jeder Schreibzugriff auf ein fixed-positioniertes Bild
  // invalidiert das Layout; folgt direkt danach ein Lesezugriff für die
  // nächste Karte, erzwingt der Browser eine synchrone Neuberechnung
  // (Layout-Thrashing).
  function applyDesktopProgress(progress) {
    grid.classList.toggle("is-docked", progress >= 1);

    if (progress >= 1) {
      // Angekommen: Inline-Styling entfernen, Bilder liegen normal im Raster.
      cards.forEach(function (card) {
        var img = card.querySelector("img");
        if (img) img.style.cssText = "";
      });
      return;
    }

    var rects = Array.prototype.map.call(cards, function (card, i) {
      return { slot: heroSlots[i].getBoundingClientRect(), card: card.getBoundingClientRect() };
    });

    cards.forEach(function (card, i) {
      var img = card.querySelector("img");
      if (!img) return;

      var slotRect = rects[i].slot;
      var cardRect = rects[i].card;
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
      img.style.zIndex = stackZIndex[i];
    });
  }

  function measureHero() {
    heroBottomAbs = hero.getBoundingClientRect().bottom + window.scrollY;
  }

  function updateCards() {
    ticking = false;
    var vh = window.innerHeight;
    var dockDistance = Math.max(heroBottomAbs - vh * EXIT_BUFFER_RATIO, 200);
    var progress = Math.min(1, Math.max(0, window.scrollY / dockDistance));
    applyDesktopProgress(progress);
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateCards);
    }
  }

  function remeasureAndUpdate() {
    measureHero();
    requestUpdate();
  }

  measureHero();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  // Fensterbreite ändert Zeilenumbrüche im Hero-Text und damit dessen Höhe
  // (siehe heroBottomAbs) — bei reinem requestUpdate() bliebe der alte,
  // inzwischen falsche Andock-Punkt stehen.
  window.addEventListener("resize", remeasureAndUpdate);
  requestUpdate();

  // Die erste Berechnung läuft, bevor die selbst gehostete Schrift (Inter)
  // fertig geladen ist. Sobald sie nachlädt, kann sich der Text im Hero
  // verschieben (anderer Zeilenumbruch etc.) und damit auch die Position
  // des Hero-Fächers UND dessen Höhe — ohne Neuberechnung bliebe der
  // Andock-Punkt an seiner alten, falschen Stelle hängen.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasureAndUpdate);
  }

  // Zusätzliches Sicherheitsnetz: nach vollständigem Laden der Seite
  // (inkl. Bilder) einmal neu berechnen, falls sich durch Bild-Ladezeiten
  // noch irgendwo Layout verschoben hat.
  window.addEventListener("load", remeasureAndUpdate);
})();
