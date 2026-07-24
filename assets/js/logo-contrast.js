/**
 * Bella Vista Studios — Logo-Kontrast beim Scrollen.
 *
 * mix-blend-mode: difference wäre die naheliegende CSS-Lösung, um das Logo
 * immer gegen den Hintergrund abzuheben, wurde aber mit vier isolierten
 * Testfällen geprüft und verworfen: WebKit berechnet Blend-Modi auf
 * Nachfahren von position:sticky ODER position:fixed nachweislich nicht
 * (reiner Browser-Bug, kein CSS-Fix möglich).
 *
 * Stattdessen: dieses Skript prüft bei jedem Scroll, welche Video-/Foto-
 * Thumbnails (.media-thumb in den Projektseiten) sich gerade mit der
 * Logo-Fläche überschneiden, misst deren Helligkeit an genau dieser Stelle
 * per Canvas und schaltet bei dunklem Ergebnis die Klasse is-on-dark auf
 * .logo-mark (siehe style.css für den Hell-Filter). Bewusst nur
 * .media-thumb, nicht jedes <img> der Seite: Trusted-by-Logos, Team-Fotos,
 * Hero-Bilder usw. sollen das Logo nicht umschalten, nur die Thumbnails auf
 * den Projektseiten. Ohne überlappendes Thumbnail bleibt das Logo in seiner
 * normalen dunklen Farbe, das passt zum hellen Grundhintergrund der Seite
 * (--bg).
 */
(function () {
  "use strict";

  var logoMark = document.querySelector(".logo-mark");
  if (!logoMark) return;

  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var SAMPLE_SIZE = 12;
  var DARK_THRESHOLD = 130; // 0–255, darunter gilt der Ausschnitt als "dunkel"

  function sampleBrightness(img, sx, sy, sw, sh) {
    if (sw <= 0 || sh <= 0) return null;
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    try {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      var data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    } catch (e) {
      return null; // z.B. Bild noch nicht geladen — dann einfach ignorieren
    }
    var total = 0;
    for (var i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return total / (data.length / 4);
  }

  function updateLogoContrast() {
    var logoRect = logoMark.getBoundingClientRect();
    var images = document.querySelectorAll("img.media-thumb");
    var darkest = 255;

    images.forEach(function (img) {
      if (!img.complete || img.naturalWidth === 0) return;

      var rect = img.getBoundingClientRect();
      var overlapLeft = Math.max(rect.left, logoRect.left);
      var overlapTop = Math.max(rect.top, logoRect.top);
      var overlapRight = Math.min(rect.right, logoRect.right);
      var overlapBottom = Math.min(rect.bottom, logoRect.bottom);
      if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) return;

      var scaleX = img.naturalWidth / rect.width;
      var scaleY = img.naturalHeight / rect.height;
      var sx = (overlapLeft - rect.left) * scaleX;
      var sy = (overlapTop - rect.top) * scaleY;
      var sw = (overlapRight - overlapLeft) * scaleX;
      var sh = (overlapBottom - overlapTop) * scaleY;

      var brightness = sampleBrightness(img, sx, sy, sw, sh);
      if (brightness !== null && brightness < darkest) darkest = brightness;
    });

    logoMark.classList.toggle("is-on-dark", darkest < DARK_THRESHOLD);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateLogoContrast();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("load", updateLogoContrast);
})();
