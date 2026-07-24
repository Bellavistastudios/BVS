/**
 * Bella Vista Studios — Scroll-Reveal für Text und Elemente.
 *
 * Überschriften, Hero-Inhalt, Karten/Kacheln und Listen-Einträge stehen
 * nicht sofort fertig da, sondern blenden per IntersectionObserver einmalig
 * ein (fade + leichtes Hochschieben, siehe .reveal in style.css), sobald sie
 * zum ersten Mal ins Blickfeld scrollen. Elemente innerhalb derselben Gruppe
 * (z.B. die 4 Projekt-Karten oder die 6 Service-Einträge) bekommen dabei
 * eine kleine, ansteigende Verzögerung, damit sie nacheinander statt alle
 * gleichzeitig erscheinen.
 *
 * Läuft bewusst nicht bei reduzierter Bewegungspräferenz — dort bleibt
 * .reveal ungenutzt und alles ist von Anfang an normal sichtbar (siehe
 * Media-Query in style.css als zusätzliches Sicherheitsnetz).
 */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  var STAGGER_MS = 70;
  var STAGGER_MAX_MS = 350;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );

  function reveal(elements, stagger) {
    elements.forEach(function (el, i) {
      el.classList.add("reveal");
      if (stagger) {
        el.style.transitionDelay = Math.min(i * STAGGER_MS, STAGGER_MAX_MS) + "ms";
      }
      observer.observe(el);
    });
  }

  // Gruppen mit Staffelung: Geschwister-Elemente derselben Liste/desselben
  // Rasters erscheinen nacheinander.
  reveal(document.querySelectorAll(".projects-grid > .project-card:not(.project-card--extra)"), true);
  reveal(document.querySelectorAll(".services-list > .service-item"), true);
  reveal(document.querySelectorAll(".team-grid > .team-col"), true);
  reveal(document.querySelectorAll(".video-grid > .media-placeholder, .image-grid > .media-placeholder"), true);

  // Einzelelemente ohne Staffelung: Überschriften, Hero-Inhalt, Projekt-
  // Detailseiten-Text, Footer.
  reveal(
    document.querySelectorAll(
      [
        ".section-heading",
        ".section-lede",
        ".hero-headline",
        ".hero-text",
        ".hero-cta",
        ".badge",
        ".project-title",
        ".project-facts",
        ".project-description",
        ".project-scope",
        ".media-heading",
        ".footer-big",
        ".footer-grid",
        ".footer-bottom"
      ].join(", ")
    ),
    false
  );
})();
