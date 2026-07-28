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
 * 2) Andock-Auslöser: ein dauerhaft aktiver IntersectionObserver auf
 *    .trusted (die "Trusted by"-Leiste, verkleinerter Root über rootMargin)
 *    meldet zuverlässig — unabhängig von vh-Wackeln —, sobald die Leiste
 *    beim Scrollen in das obere Drittel des Bildschirms eintritt
 *    (Fortschritts-Ziel 1).
 * 3) Rückflug-Auslöser: bewusst NICHT das Verlassen der Trusted-Leiste —
 *    das feuert nämlich auch beim normalen Weiterscrollen nach unten,
 *    sobald die Leiste oben aus dem Bild läuft, und würde die Karten dann
 *    ungewollt mitten auf der Seite zurück in den Fächer schicken.
 *    Stattdessen ein einfacher scrollY-Schwellwert: erst wenn man wirklich
 *    wieder ganz oben beim Hero/BVS-Bereich ankommt, geht es zurück auf
 *    Ziel 0.
 * 4) Flug: läuft danach zeitbasiert (requestAnimationFrame +
 *    performance.now(), MOBILE_FLIGHT_MS) zur jeweiligen Zielposition,
 *    komplett unabhängig von weiterem Scrollen — dadurch immer exakt gleich
 *    lang und tatsächlich wahrnehmbar, egal wie schnell/langsam
 *    weitergescrollt wird, und sauber umkehrbar, falls die Scrollrichtung
 *    mitten im Flug wechselt.
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

  var grid = document.querySelector(".projects-grid");
  var hero = document.querySelector(".hero");
  var trustedSection = document.querySelector(".trusted");
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
  // Erst ALLE getBoundingClientRect()-Werte einsammeln, danach erst die
  // Styles schreiben — statt pro Karte lesen/schreiben/lesen/schreiben zu
  // verschränken. Jeder Schreibzugriff auf ein fixed-positioniertes Bild
  // invalidiert das Layout; folgt direkt danach ein Lesezugriff für die
  // nächste Karte, erzwingt der Browser eine synchrone Neuberechnung
  // (Layout-Thrashing). Bei 4 Karten und bis zu 60 Aufrufen/Sekunde während
  // des Flugs war genau das der Grund, warum die Animation auf
  // Mobilgeräten komplett hängenblieb.
  function applyProgress(progress) {
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

  if (isMobileMode) {
    // ---- Mobile ----
    var MOBILE_FLIGHT_MS = 650;
    // Ab hier gilt man als "wieder oben beim Hero/BVS-Bereich" — bewusst
    // nicht exakt 0, ein paar Pixel Toleranz reichen z.B. für iOS-Bounce.
    var TOP_THRESHOLD = 4;
    var scrollTicking = false;

    // progress ist ein fortlaufender Zustand (nicht mehr nur "0 im
    // Ruhezustand, dann einmalig auf 1"), weil der Rückflug von 1 aus
    // starten können muss, sobald man wieder ganz oben ankommt.
    var progress = 0;
    var animating = false;
    var animStartProgress = 0;
    var animTargetProgress = 0;
    var animStartTime = 0;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }
    function easeInCubic(t) {
      return t * t * t;
    }

    // Zielwert ansteuern (0 = zurück in den Fächer, 1 = angedockt im
    // Raster) — läuft immer zeitbasiert über MOBILE_FLIGHT_MS, ausgehend
    // vom AKTUELLEN Fortschritt (nicht zwingend 0 oder 1), damit ein
    // Richtungswechsel mitten im Flug sauber umkehrt statt zu springen.
    // easeOut beim Hinflug (Ankunft wird sanft abgebremst), easeIn beim
    // Rückflug (Start aus der Ruhe wird sanft beschleunigt) — symmetrisches
    // Bewegungsgefühl in beide Richtungen.
    function goTo(target) {
      if (!animating && progress === target) return;
      animStartProgress = progress;
      animTargetProgress = target;
      animStartTime = performance.now();
      if (!animating) {
        animating = true;
        window.requestAnimationFrame(stepAnim);
      }
    }

    function stepAnim() {
      var t = Math.min(1, (performance.now() - animStartTime) / MOBILE_FLIGHT_MS);
      var goingForward = animTargetProgress > animStartProgress;
      var eased = goingForward ? easeOutCubic(t) : easeInCubic(t);
      progress = lerp(animStartProgress, animTargetProgress, eased);
      applyProgress(progress);
      if (t < 1) {
        window.requestAnimationFrame(stepAnim);
      } else {
        progress = animTargetProgress;
        applyProgress(progress);
        animating = false;
      }
    }

    // Ein einziger, rAF-throttled Scroll-Handler statt separater Ruhephasen-
    // Logik: solange man ruht (progress 0, nichts animiert), folgt das Bild
    // per Live-Messung von .hero-slot ganz normal dem Scrollen. Zusätzlich
    // und unabhängig davon: ist man wieder oberhalb von TOP_THRESHOLD, wird
    // goTo(0) angestoßen — das ist die einzige Quelle für den Rückflug
    // (siehe Datei-Kopf-Kommentar, Punkt 3).
    function handleScroll() {
      scrollTicking = false;
      if (window.scrollY <= TOP_THRESHOLD) goTo(0);
      if (!animating && progress === 0) applyProgress(0);
    }

    function requestScrollUpdate() {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(handleScroll);
    }

    applyProgress(0);
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);

    if (trustedSection && "IntersectionObserver" in window) {
      // Beobachtet die "Trusted by"-Leiste: Auslöser feuert NUR beim
      // Eintreten in das obere Drittel des Bildschirms (rootMargin
      // verkleinert den Beobachtungsbereich auf [0, 33.3% vh]) und dockt an
      // (goTo(1)). Das Verlassen dieses Bereichs wird bewusst ignoriert —
      // das passiert auch beim normalen Weiterscrollen nach unten, sobald
      // die Leiste oben aus dem Bild läuft, und würde die Karten dann
      // fälschlich mitten auf der Seite zurück in den Fächer schicken. Der
      // Rückflug läuft ausschließlich über den TOP_THRESHOLD-Check in
      // handleScroll() oben.
      var flightObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) goTo(1);
          });
        },
        { rootMargin: "0px 0px -66.6% 0px", threshold: 0 }
      );
      flightObserver.observe(trustedSection);
    } else {
      // Kein IntersectionObserver verfügbar (sehr alter Browser) — Karten
      // bleiben dann einfach ruhig im Raster stehen, ohne Fächer-Effekt,
      // statt mit einer unsicheren Ersatzformel zu raten.
      goTo(1);
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
