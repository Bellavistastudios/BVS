/**
 * Bella Vista Studios — Scroll-Effekt für die Projekt-Bilder.
 *
 * Jedes der 4 Projektbilder existiert nur EINMAL im DOM (im Projekte-Raster).
 * Es wird vorübergehend aus dem normalen Fluss genommen und zwischen seinem
 * unsichtbaren Anker-Platz im Hero (.hero-slot) und seiner tatsächlichen
 * Position im Raster interpoliert. Alle 4 Bilder folgen demselben
 * Fortschritt (0 → 1) — sie setzen sich also gleichzeitig in Bewegung, nicht
 * nacheinander.
 *
 * Solange ein Bild "unterwegs" ist (progress < 1), bleibt das Overlay der
 * jeweiligen Karte unsichtbar (siehe .js-morph/.is-docked in style.css).
 *
 * Desktop und Mobile laufen über zwei komplett getrennte Funktionen
 * (applyDesktopProgress / applyMobileProgress, jeweils nur im eigenen
 * Zweig unten definiert) statt über eine gemeinsame Funktion mit
 * Fallunterscheidung — eine Änderung am Mobile-Verhalten kann dadurch nie
 * versehentlich das (auf dem Rechner einwandfrei laufende) Desktop-Verhalten
 * berühren, und umgekehrt.
 *
 * ---- Desktop (Breite > MOBILE_BREAKPOINT) ----
 * Fortschritt hängt kontinuierlich an der Scroll-Position: bei scrollY = 0
 * steht der Fächer, nach "dockDistance" Pixeln Scrollen ist er angedockt.
 * dockDistance richtet sich nach der tatsächlichen Hero-Höhe (measureHero()),
 * damit die Karten sichtbar bleiben, solange der Hero überhaupt im Bild ist.
 * Pro Frame wird das Bild "fixed" positioniert, mit live gemessenen Rects.
 *
 * ---- Mobile (Breite ≤ MOBILE_BREAKPOINT) ----
 * Zwei frühere Mobile-Probleme und ihre Ursache:
 *
 * 1) EIN rein scrollY/vh-basierter Schwellwert (wie auf Desktop) ist auf
 *    echten Handy-Browsern nicht robust genug: iOS Safari ändert
 *    window.innerHeight WÄHREND der ersten Scroll-Geste (die Adressleiste
 *    blendet aus, sobald man zu scrollen beginnt), und das fließt in jede
 *    vh-basierte Schwellwert-Formel mit ein — der berechnete Andockpunkt
 *    springt mitten in der ersten Berührung nach unten. Deshalb löst hier
 *    ein IntersectionObserver auf die "Trusted by"-Leiste (.trusted) das
 *    Andocken aus (Ziel 1), unabhängig von vh-Werten. Das Verlassen dieser
 *    Leiste wird bewusst NICHT als Rückflug-Auslöser genutzt — das feuert
 *    nämlich auch beim normalen Weiterscrollen nach unten und würde die
 *    Karten mitten auf der Seite ungewollt zurückschicken. Stattdessen löst
 *    ein einfacher scrollY <= TOP_THRESHOLD-Check den Rückflug aus (Ziel 0):
 *    erst wer wirklich wieder ganz oben beim Hero/BVS-Bereich ankommt, sieht
 *    den Fächer erneut.
 *
 * 2) Die alte Ruhephase hat das Bild dauerhaft "fixed" positioniert und bei
 *    JEDEM Scroll-Event per getBoundingClientRect() neu ausgerechnet, wo der
 *    Hero-Slot gerade steht. Auf Touch-Geräten läuft natives Scrollen auf
 *    einem eigenen Compositor-Thread; JS-Scroll-Events kommen dort erst mit
 *    Verzögerung hinterher. Ergebnis: das JS-positionierte Bild lag beim
 *    Scrollen mit Touch immer einen Frame hinter dem Rest der (nativ
 *    scrollenden) Seite zurück — sichtbar als "Kämpfen gegen das Scrollen".
 *    Die Ruhephase braucht aber gar keine eigene Logik: position: absolute
 *    (statt fixed) lässt den Browser die Bewegung beim Scrollen nativ
 *    übernehmen, exakt wie bei jedem anderen Element der Seite, ganz ohne
 *    JS pro Scroll-Event. Da .project-card selbst position: relative hat,
 *    reicht ein fester Offset (einmalig gemessen: "Hero-Slot minus Karte"),
 *    um das Bild optisch am Hero-Slot erscheinen zu lassen, auch wenn es im
 *    DOM in der (weit entfernten) Karte steckt. Einzige Voraussetzung:
 *    .project-card darf in dieser Phase nicht per overflow:hidden
 *    abschneiden, was außerhalb der Karte liegt — siehe die mobile-only
 *    Regel ".projects-grid.js-morph:not(.is-docked) .project-card" in
 *    style.css. Erst während des kurzen, zeitbasierten Flugs (0 < progress
 *    < 1) wird auf position: fixed umgeschaltet (dort per Konstruktion
 *    ohnehin scroll-unabhängig, siehe Punkt 3), und danach im angedockten
 *    Zustand (progress 1) ganz normal in den Fluss zurückgelegt.
 *
 * 3) Der Flug selbst läuft zeitbasiert (requestAnimationFrame +
 *    performance.now(), MOBILE_FLIGHT_MS) zur jeweiligen Zielposition,
 *    komplett unabhängig von weiterem Scrollen — dadurch immer exakt gleich
 *    lang und tatsächlich wahrnehmbar, egal wie schnell/langsam
 *    weitergescrollt wird, und sauber umkehrbar, falls die Scrollrichtung
 *    mitten im Flug wechselt. Start- und Zielgeometrie (Hero-Slot bzw.
 *    Karte) werden dafür nur EINMAL gemessen (bei Setup/Resize/Font-Load),
 *    nicht pro Frame — pro Frame wird nur noch mit dem aktuellen
 *    window.scrollY umgerechnet (eine reine Zahl, kein Layout-Zwang), statt
 *    bei jedem Frame erneut getBoundingClientRect() aufzurufen.
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

  if (isMobileMode) {
    // ---- Mobile ----
    // Komplett eigenständig, siehe Datei-Kopf-Kommentar — teilt sich mit
    // Desktop nur lerp()/startRotation/stackZIndex oben.
    var MOBILE_FLIGHT_MS = 650;
    // Ab hier gilt man als "wieder oben beim Hero/BVS-Bereich" — bewusst
    // nicht exakt 0, ein paar Pixel Toleranz reichen z.B. für iOS-Bounce.
    var TOP_THRESHOLD = 4;

    // progress ist ein fortlaufender Zustand (nicht mehr nur "0 im
    // Ruhezustand, dann einmalig auf 1"), weil der Rückflug von 1 aus
    // starten können muss, sobald man wieder ganz oben ankommt.
    var progress = 0;
    var animating = false;
    var animStartProgress = 0;
    var animTargetProgress = 0;
    var animStartTime = 0;

    // Einmalig (und bei Resize/Font-Load) gemessene Geometrie je Bild:
    // - restOffset: Versatz vom Hero-Slot zur eigenen Karte, in Pixeln
    //   ("wie weit oben/links liegt der Slot relativ zu MEINER Karte") —
    //   genutzt als position:absolute-Koordinate INNERHALB der Karte
    //   während der Ruhephase (siehe Punkt 2 oben).
    // - slotDoc/cardDoc: Dokument-Koordinaten (unabhängig von der aktuellen
    //   Scroll-Position) von Slot und Karte — genutzt während des Flugs,
    //   dort nur per window.scrollY in Viewport-Koordinaten umgerechnet statt
    //   pro Frame neu gemessen.
    var restOffset = [];
    var slotDoc = [];
    var cardDoc = [];

    function docRect(rect) {
      return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      };
    }

    function measure() {
      slotDoc = Array.prototype.map.call(heroSlots, function (slot) {
        return docRect(slot.getBoundingClientRect());
      });
      cardDoc = Array.prototype.map.call(cards, function (card) {
        return docRect(card.getBoundingClientRect());
      });
      restOffset = cardDoc.map(function (card, i) {
        return {
          top: slotDoc[i].top - card.top,
          left: slotDoc[i].left - card.left,
          width: slotDoc[i].width,
          height: slotDoc[i].height
        };
      });
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }
    function easeInCubic(t) {
      return t * t * t;
    }

    function applyMobileProgress(p) {
      grid.classList.toggle("is-docked", p >= 1);

      if (p >= 1) {
        // Angekommen: Inline-Styling entfernen, Bilder liegen normal im
        // Raster (dort wieder ganz regulär von overflow:hidden umschlossen).
        cards.forEach(function (card) {
          var img = card.querySelector("img");
          if (img) img.style.cssText = "";
        });
        return;
      }

      if (p <= 0) {
        // Ruhephase: echtes position:absolute relativ zur eigenen (position:
        // relative) Karte, mit einem fest gemessenen Offset zum Hero-Slot —
        // der Browser übernimmt das Mitscrollen ab hier komplett selbst,
        // ganz ohne JS pro Scroll-Event (siehe Punkt 2 im Datei-Kopf).
        cards.forEach(function (card, i) {
          var img = card.querySelector("img");
          var offset = restOffset[i];
          if (!img || !offset) return;
          img.style.position = "absolute";
          img.style.margin = "0";
          img.style.top = offset.top + "px";
          img.style.left = offset.left + "px";
          img.style.width = offset.width + "px";
          img.style.height = offset.height + "px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "var(--radius-lg)";
          img.style.transform = "rotate(" + startRotation[i] + "deg)";
          img.style.zIndex = stackZIndex[i];
        });
        return;
      }

      // Flug: position:fixed, Start-/Zielgeometrie kommt aus den bei
      // measure() gecachten Dokument-Rects (keine getBoundingClientRect()-
      // Aufrufe während der Animation) und wird nur per window.scrollY in
      // Viewport-Koordinaten umgerechnet.
      var scrollY = window.scrollY;
      var scrollX = window.scrollX;
      cards.forEach(function (card, i) {
        var img = card.querySelector("img");
        var slot = slotDoc[i];
        var target = cardDoc[i];
        if (!img || !slot || !target) return;

        var top = lerp(slot.top, target.top, p) - scrollY;
        var left = lerp(slot.left, target.left, p) - scrollX;
        var width = lerp(slot.width, target.width, p);
        var height = lerp(slot.height, target.height, p);
        var rotation = lerp(startRotation[i], 0, p);

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
      applyMobileProgress(progress);
      if (t < 1) {
        window.requestAnimationFrame(stepAnim);
      } else {
        progress = animTargetProgress;
        applyMobileProgress(progress);
        animating = false;
      }
    }

    function reapplyIfResting() {
      if (!animating && progress === 0) applyMobileProgress(0);
    }

    function remeasure() {
      measure();
      reapplyIfResting();
    }

    measure();
    applyMobileProgress(0);

    // Einziger Zweck des Scroll-Listeners auf Mobile: erkennen, wann man
    // wieder ganz oben ist, um den Rückflug auszulösen. Während der
    // Ruhephase selbst ist kein Listener-Zutun nötig (siehe Punkt 2 im
    // Datei-Kopf) — deshalb hier bewusst kein rAF-Throttling, der Check
    // selbst ist trivial billig (ein Zahlenvergleich, kein DOM-Zugriff).
    window.addEventListener(
      "scroll",
      function () {
        if (window.scrollY <= TOP_THRESHOLD) goTo(0);
      },
      { passive: true }
    );
    window.addEventListener("resize", remeasure);

    // Fensterbreite/-höhe ändert Hero-Layout und damit Slot-/Karten-
    // Position — ohne Neuberechnung bliebe der Ruhephasen-Offset bzw. die
    // Flugziel-Geometrie an ihrer alten, falschen Stelle hängen.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(remeasure);
    }
    window.addEventListener("load", remeasure);

    if (trustedSection && "IntersectionObserver" in window) {
      // Beobachtet die "Trusted by"-Leiste: Auslöser feuert NUR beim
      // Eintreten in das obere Drittel des Bildschirms (rootMargin
      // verkleinert den Beobachtungsbereich auf [0, 33.3% vh]) und dockt an
      // (goTo(1)). Das Verlassen dieses Bereichs wird bewusst ignoriert —
      // das passiert auch beim normalen Weiterscrollen nach unten, sobald
      // die Leiste oben aus dem Bild läuft, und würde die Karten dann
      // fälschlich mitten auf der Seite zurück in den Fächer schicken. Der
      // Rückflug läuft ausschließlich über den TOP_THRESHOLD-Check oben.
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
    // Komplett eigenständig, siehe Datei-Kopf-Kommentar — teilt sich mit
    // Mobile nur lerp()/startRotation/stackZIndex oben.

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
  }
})();
