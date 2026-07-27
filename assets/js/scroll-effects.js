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
 * Der Andock-Zeitpunkt richtet sich nach der tatsächlichen Höhe des
 * Hero-Bereichs (siehe measureHero()): die Karten sollen im Fächer sichtbar
 * bleiben, solange der Hero überhaupt noch im Bild ist, und erst kurz bevor
 * er komplett aus dem Viewport gescrollt wird andocken — nicht schon nach
 * einer kurzen festen Strecke ganz oben auf der Seite (frühere Version, war
 * auf hohen Fensterbreiten/kurzen Hero-Texten deutlich zu schnell vorbei).
 * Dadurch steht bei scrollY = 0 (ganz oben) weiterhin immer exakt der
 * Hero-Fächer, unabhängig von der Höhe des Inhalts darüber.
 *
 * Läuft auf jeder Fensterbreite/-höhe (auch schmal/quer/hochformat) — nur
 * bei reduzierter Bewegungspräferenz bleiben Bild und Overlay direkt
 * sichtbar, ohne Animation. Frühere Version hat den Effekt unterhalb von
 * 860px Breite bzw. 560px Höhe komplett abgeschaltet; das griff aber auch
 * schon bei einem schmal gezogenen Browserfenster (nicht nur auf einem
 * echten Handy) — die Karten blieben dort dann einfach unbewegt in ihrer
 * Rasterposition stehen, statt (wie gewünscht) zu animieren.
 */
(function () {
  "use strict";

  // Browser stellen beim Reload gerne die vorherige Scroll-Position wieder
  // her (history.scrollRestoration = "auto" per Default). War man vorher
  // z.B. schon an den Projekten vorbeigescrollt, startet die Seite dann
  // NICHT bei scrollY = 0 — der Fächer-Effekt unten rechnet aber genau
  // damit und zeigt die Bilder je nach Rest-Scrollposition nur teilweise
  // oder gar nicht im Hero an. "manual" erzwingt, dass ein frischer Aufruf
  // immer oben startet.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var grid = document.querySelector(".projects-grid");
  var hero = document.querySelector(".hero");
  // Nur die ursprünglichen 4 Karten animieren — die per Klick nachgeladenen
  // (.project-card--extra) haben kein passendes .hero-slot und bleiben außen vor.
  var cards = document.querySelectorAll(".projects-grid .project-card:not(.project-card--extra)");
  var heroSlots = document.querySelectorAll(".hero-slot");
  if (!grid || !hero || !cards.length || cards.length !== heroSlots.length) return;

  // Rotation, mit der jedes Bild im Hero-Fächer startet — blendet beim
  // Scrollen sanft auf 0 Grad (normale Rasterposition) aus.
  var startRotation = [-12, -4, 6, 14];

  // Stapel-Reihenfolge im Fächer: Karten-Index (0=Agrar Tirol, 1=Autopark,
  // 2=Lightweight, 3=Corthea) → z-index. Autopark (Index 1) soll zuoberst
  // liegen, die übrige Reihenfolge bleibt wie vorher.
  var stackZIndex = [60, 63, 61, 62];

  // Puffer, der vom Andock-Zeitpunkt abgezogen wird, damit die Karten nicht
  // erst im exakten Moment des Verschwindens andocken, sondern schon kurz
  // (20% einer Viewport-Höhe) davor — "kurz bevor" statt "genau wenn".
  var EXIT_BUFFER_RATIO = 0.2;

  // Auf Mobile folgt die "Trusted by"-Sektion direkt auf den Hero. Das
  // fliegende Bild (position:fixed, hoher z-index, siehe updateCards) muss
  // dort schon angedockt sein, BEVOR die Hero-Unterkante (= Oberkante von
  // "Trusted by") überhaupt am unteren Bildschirmrand auftaucht — sonst
  // liegt es beim Scrollen noch über den Trusted-Logos und verdeckt sie.
  // Ein ganzer Viewport (statt nur 20%) als Puffer garantiert das: bei
  // scrollY = heroBottomAbs - vh ist die Hero-Unterkante gerade erst am
  // unteren Bildschirmrand angekommen, +5% zusätzlich als Sicherheitsabstand.
  var MOBILE_BREAKPOINT = 860;
  var MOBILE_EXIT_BUFFER_RATIO = 1.05;

  // Absolute Seiten-Position (px von ganz oben), an der die Unterkante des
  // Hero-Bereichs den oberen Bildschirmrand erreicht — also der Punkt, an
  // dem der Hero (und mit ihm der Fächer) komplett aus dem Bild gescrollt
  // wäre. Wird per measureHero() aktuell gehalten, weil sich die Hero-Höhe
  // durch Zeilenumbrüche (Fensterbreite, Font-Nachladen) ändern kann.
  var heroBottomAbs = 0;

  function measureHero() {
    heroBottomAbs = hero.getBoundingClientRect().bottom + window.scrollY;
  }

  measureHero();

  grid.classList.add("js-morph");

  var ticking = false;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function updateCards() {
    ticking = false;

    var vh = window.innerHeight;
    var isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    var exitBufferRatio = isMobile ? MOBILE_EXIT_BUFFER_RATIO : EXIT_BUFFER_RATIO;
    var dockDistance = Math.max(heroBottomAbs - vh * exitBufferRatio, 200);

    // Fortschritt 0 → 1 rein anhand der Scroll-Position: bei scrollY = 0
    // (oberster Punkt der Seite) immer 0, nach "dockDistance" Pixeln
    // Scrollen vollständig angedockt (siehe heroBottomAbs oben).
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
      img.style.zIndex = stackZIndex[i];
    });
  }

  function requestUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(updateCards);
      ticking = true;
    }
  }

  function remeasureAndUpdate() {
    measureHero();
    requestUpdate();
  }

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
  // Andock-Punkt an seiner alten, falschen Stelle hängen. Deshalb hier
  // gezielt einmal nachrechnen, sobald alle Fonts wirklich bereitstehen.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasureAndUpdate);
  }

  // Zusätzliches Sicherheitsnetz: nach vollständigem Laden der Seite
  // (inkl. Bilder) einmal neu berechnen, falls sich durch Bild-Ladezeiten
  // noch irgendwo Layout verschoben hat.
  window.addEventListener("load", remeasureAndUpdate);
})();
