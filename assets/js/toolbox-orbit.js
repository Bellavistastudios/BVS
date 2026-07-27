/**
 * Bella Vista Studios — Rotierendes "Creative Toolbox"-Karussell.
 *
 * Ein einziger requestAnimationFrame-Loop ist die alleinige Quelle für den
 * Rotationswinkel: er berechnet pro Frame sowohl die Position jedes Icons
 * als auch, auf welcher Kreisseite (links/rechts) dessen Beschriftung
 * sitzen muss. Vorher liefen dafür zwei getrennte CSS-Keyframe-Animationen
 * (Ring dreht sich, Badge dreht exakt gegenläufig zurück, damit es aufrecht
 * bleibt) — die beim unabhängigen Pausieren/Fortsetzen pro Icon leicht
 * auseinanderlaufen konnten. Das war das sichtbare Ruckeln. Mit einem
 * einzigen Winkel-Wert pro Frame ist das ausgeschlossen.
 *
 * Hover-Verhalten: die Zielgeschwindigkeit sinkt nur, wenn die Maus genau
 * über einem der Icons (.toolbox-badge) steht, nicht schon irgendwo im
 * Kreis oder in den Lücken dazwischen. Der Übergang läuft weich per
 * Easing, damit kein Sprung in der Rotation entsteht, und die Rotation
 * wird dabei nie ganz angehalten, nur deutlich langsamer.
 *
 * Die Zeit zwischen zwei Frames (dt) schwankt naturgemäß leicht (rAF ist
 * kein perfekter Timer). Bei sehr langsamer Rotation macht sich dieses
 * Zittern proportional viel stärker bemerkbar, weil der Winkel-Zuwachs pro
 * Frame ohnehin winzig ist — deshalb wird dt hier zusätzlich per gleitendem
 * Mittelwert geglättet, bevor er in die Winkel-Berechnung einfließt.
 */
(function () {
  "use strict";

  var wrap = document.getElementById("toolbox-orbit-wrap");
  if (!wrap) return;

  var orbit = wrap.querySelector(".toolbox-orbit");
  var itemEls = orbit.querySelectorAll(".toolbox-orbit-item");
  if (!itemEls.length) return;

  var RADIUS = 84;
  var NORMAL_SPEED = 360 / 34; // Grad/Sekunde — eine Umdrehung in 34s
  var SLOW_SPEED = NORMAL_SPEED / 8; // deutlich langsamer, aber nie stehend
  var EASE_PER_SEC = 3; // wie schnell die Geschwindigkeit dem Zielwert folgt
  var DT_SMOOTHING = 0.15; // Anteil, mit dem jedes neue dt den geglätteten Wert nachzieht

  var items = Array.prototype.map.call(itemEls, function (el) {
    return {
      el: el,
      baseAngle: parseFloat(getComputedStyle(el).getPropertyValue("--angle")) || 0,
      badge: el.querySelector(".toolbox-badge"),
      label: el.querySelector(".toolbox-label")
    };
  });

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Zähler statt einfachem Bool: pointerenter/-leave feuern pro Badge, ein
  // Zähler verhält sich beim schnellen Wechsel zwischen zwei Icons robuster
  // als ein einzelnes true/false auf einem gemeinsamen Elternelement.
  var hoverCount = 0;
  items.forEach(function (item) {
    item.badge.addEventListener("pointerenter", function () { hoverCount++; });
    item.badge.addEventListener("pointerleave", function () { hoverCount = Math.max(0, hoverCount - 1); });
  });
  var angle = 0;
  var speed = NORMAL_SPEED;
  var lastTime = null;
  var smoothedDt = null;

  function layout() {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var actual = ((item.baseAngle + angle) % 360 + 360) % 360;
      var rad = (actual * Math.PI) / 180;
      var x = Math.cos(rad) * RADIUS;
      var y = Math.sin(rad) * RADIUS;
      item.el.style.transform = "translate(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px)";

      var onRightHalf = x >= 0;
      item.label.classList.toggle("toolbox-label--right", onRightHalf);
      item.label.classList.toggle("toolbox-label--left", !onRightHalf);
    }
  }

  // Ab hier übernimmt translate() die Positionierung (siehe layout()) statt
  // rotate()+translateX() aus dem CSS-Fallback — die Badges brauchen dann
  // keine Gegenrotation mehr.
  wrap.classList.add("is-active");

  if (reduceMotion) {
    layout();
    return;
  }

  function frame(time) {
    if (lastTime === null) lastTime = time;
    var rawDt = Math.min(0.1, (time - lastTime) / 1000); // Cap gegen Sprünge nach Tab-Wechsel
    lastTime = time;

    smoothedDt = smoothedDt === null ? rawDt : smoothedDt + (rawDt - smoothedDt) * DT_SMOOTHING;

    var target = hoverCount > 0 ? SLOW_SPEED : NORMAL_SPEED;
    speed += (target - speed) * Math.min(1, EASE_PER_SEC * smoothedDt);
    angle = (angle + speed * smoothedDt) % 360;

    layout();
    rafId = window.requestAnimationFrame(frame);
  }

  // Läuft sonst dauerhaft weiter, auch lange nachdem der Nutzer (v.a. auf
  // Mobile beim Scrollen durch den Rest der Seite) über den Kreis
  // hinausgescrollt ist — unnötiger Akkuverbrauch für eine unsichtbare
  // Animation. IntersectionObserver pausiert die rAF-Loop außerhalb des
  // Viewports und setzt lastTime beim Wiedereintritt zurück, damit kein
  // riesiger dt-Sprung (siehe Cap oben) die Rotation springen lässt.
  var rafId = null;

  function start() {
    if (rafId !== null) return;
    lastTime = null;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId === null) return;
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start(); else stop();
        });
      },
      { threshold: 0 }
    );
    observer.observe(wrap);
  } else {
    start();
  }
})();
