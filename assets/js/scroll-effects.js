/**
 * Bella Vista Studios — Scroll-Effekt für die Projekt-Bilder.
 *
 * Jedes der 4 Projektbilder existiert nur EINMAL im DOM (im Projekte-Raster).
 * Es wird vorübergehend "fixed" positioniert und zwischen seinem unsichtbaren
 * Anker-Platz im Hero (.hero-slot) und seiner tatsächlichen Position im
 * Raster interpoliert. Alle 4 Bilder folgen demselben Fortschritt (0 → 1) —
 * sie setzen sich also gleichzeitig in Bewegung, nicht nacheinander.
 *
 * Solange ein Bild "unterwegs" ist (progress < 1), bleibt das Overlay der
 * jeweiligen Karte unsichtbar (siehe .js-morph/.is-docked in style.css).
 *
 * Desktop und Mobile laufen bewusst über zwei komplett getrennte Mechanismen
 * (siehe unten) statt über dieselbe Formel mit ein paar angepassten Zahlen —
 * mehrere Versuche, das über einen gemeinsamen, rein scrollY/vh-basierten
 * Schwellwert zu lösen, sind auf echten Mobilgeräten zuverlässig
 * fehlgeschlagen (siehe Mobile-Abschnitt unten für den Grund).
 *
 * ---- Desktop (Breite > MOBILE_BREAKPOINT) ----
 * Fortschritt hängt kontinuierlich an der Scroll-Position: bei scrollY = 0
 * steht der Fächer, nach "dockDistance" Pixeln Scrollen ist er angedockt.
 * dockDistance richtet sich nach der tatsächlichen Hero-Höhe (measureHero()),
 * damit die Karten sichtbar bleiben, solange der Hero überhaupt im Bild ist.
 *
 * ---- Mobile (Breite ≤ MOBILE_BREAKPOINT) ----
 * EIN rein scrollY/vh-basierter Schwellwert ist auf echten Handy-Browsern
 * nicht robust genug: iOS Safari ändert window.innerHeight WÄHREND der
 * ersten Scroll-Geste (die Adressleiste blendet aus, sobald man zu scrollen
 * beginnt), und genau das fließt in jede vh-basierte Schwellwert-Formel mit
 * ein. Ergebnis: der berechnete Start-/Andockpunkt springt mitten in der
 * allerersten Berührung nach unten, der Fortschritt schnellt sofort auf 1 —
 * die Kacheln "fliegen" beim ersten Touch weg, bevor überhaupt sichtbar
 * gescrollt wurde. Zwei vorherige Versuche mit engerem/weiterem Puffer sind
 * daran gescheitert, weil das Problem nicht die Zahlen waren, sondern die
 * Abhängigkeit von vh an sich.
 * Deshalb hier zwei von Scroll-Mathematik komplett entkoppelte Bausteine:
 * 1) Ruhephase: progress bleibt exakt 0, das Bild folgt per fixed-Position +
 *    Live-Messung von .hero-slot einfach ganz normal dem Scrollen (keine
 *    Schwellwert-Berechnung nötig, nur "wo ist der Slot gerade").
 * 2) Auslöser: ein IntersectionObserver auf .hero-visual (mit verkleinertem
 *    Root über rootMargin) meldet zuverlässig — unabhängig von vh-Wackeln —,
 *    wann der Fächer kurz davor ist, aus dem Bild zu scrollen.
 * 3) Flug: läuft danach EINMALIG zeitbasiert (requestAnimationFrame +
 *    performance.now(), MOBILE_FLIGHT_MS) zur Rasterposition, komplett
 *    unabhängig von weiterem Scrollen — dadurch immer exakt gleich lang und
 *    tatsächlich wahrnehmbar, egal wie schnell/langsam weitergescrollt wird.
 */
(function () {
  "use strict";

  // Browser stellen beim Reload gerne die vorherige Scroll-Position wieder
  // her (history.scrollRestoration = "auto" per Default). "manual" erzwingt,
  // dass ein frischer Aufruf immer oben startet — beide Modi unten gehen
  // davon aus, bei scrollY = 0 zu beginnen.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var grid = document.querySelector(".projects-grid");
  var hero = document.querySelector(".hero");
  var heroVisual = document.querySelector(".hero-visual");
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

  var MOBILE_BREAKPOINT = 860;
  // Einmalig beim Laden entschieden, gilt für den Rest der Seiten-Lebenszeit
  // — kein Umschalten mitten in der Session bei Fenstergrößenänderung über
  // die Grenze hinweg (unnötiger Aufwand für einen praktisch nie
  // auftretenden Fall auf echten Geräten).
  var isMobileMode = window.innerWidth <= MOBILE_BREAKPOINT;

  grid.classList.add("js-morph");

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Gemeinsam von Desktop- und Mobile-Pfad genutzt: positioniert die 4 Bilder
  // für einen gegebenen Fortschritt (0 = Hero-Fächer, 1 = angedockt im Raster).
  function applyProgress(progress) {
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

  if (isMobileMode) {
    // ---- Mobile ----
    var MOBILE_FLIGHT_MS = 650;
    var mobileTriggered = false;
    var mobileAnimStart = 0;
    var restTicking = false;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    // Ruhephase: progress bleibt konstant 0, folgt aber bei jedem Scroll-
    // Event neu berechnet der Live-Position von .hero-slot — dadurch scrollt
    // das (fixed positionierte) Bild optisch ganz normal mit der Seite mit,
    // ohne dass irgendein Schwellwert erreicht werden müsste.
    function requestRestUpdate() {
      if (mobileTriggered || restTicking) return;
      restTicking = true;
      window.requestAnimationFrame(function () {
        restTicking = false;
        if (!mobileTriggered) applyProgress(0);
      });
    }

    // Flug: einmalig ausgelöst, läuft rein zeitbasiert über
    // MOBILE_FLIGHT_MS zur Rasterposition — unabhängig davon, ob/wie schnell
    // danach weitergescrollt wird.
    function stepFlight() {
      var t = Math.min(1, (performance.now() - mobileAnimStart) / MOBILE_FLIGHT_MS);
      applyProgress(easeOutCubic(t));
      if (t < 1) window.requestAnimationFrame(stepFlight);
    }

    function triggerFlight() {
      if (mobileTriggered) return;
      mobileTriggered = true;
      mobileAnimStart = performance.now();
      window.requestAnimationFrame(stepFlight);
    }

    applyProgress(0);
    window.addEventListener("scroll", requestRestUpdate, { passive: true });
    window.addEventListener("resize", requestRestUpdate);

    if (heroVisual && "IntersectionObserver" in window) {
      // rootMargin mit negativem unteren Wert verkleinert den effektiven
      // Beobachtungsbereich von unten her — der Auslöser feuert dadurch
      // schon, wenn .hero-visual noch zu einem Teil sichtbar ist (kurz
      // BEVOR es komplett aus dem Bild gescrollt wäre), nicht erst im
      // exakten Moment des vollständigen Verschwindens. Rein geometrie-
      // basiert (Position von .hero-visual relativ zum Viewport) — hängt
      // an keiner Stelle von window.innerHeight zum Zeitpunkt der ersten
      // Scroll-Geste ab, ist also unempfindlich gegen die iOS-Adressleiste.
      var flightObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
              flightObserver.disconnect();
              triggerFlight();
            }
          });
        },
        { rootMargin: "0px 0px -30% 0px", threshold: 0 }
      );
      flightObserver.observe(heroVisual);
    } else {
      // Kein IntersectionObserver verfügbar (sehr alter Browser) — Karten
      // bleiben dann einfach ruhig im Raster stehen, ohne Fächer-Effekt,
      // statt mit einer unsicheren Ersatzformel zu raten.
      triggerFlight();
    }
  } else {
    // ---- Desktop ----
    // Puffer, der vom Andock-Zeitpunkt abgezogen wird, damit die Karten
    // nicht erst im exakten Moment des Verschwindens andocken, sondern
    // schon kurz (20% einer Viewport-Höhe) davor — "kurz bevor" statt
    // "genau wenn".
    var EXIT_BUFFER_RATIO = 0.2;
    var heroBottomAbs = 0;
    var ticking = false;

    function measureHero() {
      heroBottomAbs = hero.getBoundingClientRect().bottom + window.scrollY;
    }

    function updateCards() {
      ticking = false;
      var vh = window.innerHeight;
      var dockDistance = Math.max(heroBottomAbs - vh * EXIT_BUFFER_RATIO, 200);
      var progress = Math.min(1, Math.max(0, window.scrollY / dockDistance));
      applyProgress(progress);
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
  }
})();
