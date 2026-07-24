/**
 * Bella Vista Studios — Lazy-Load für eingebettete Vimeo-/YouTube-Videos.
 *
 * Video-Kacheln (.media-placeholder mit data-vimeo-id oder data-youtube-id)
 * zeigen beim Laden der Seite nur ein Vorschaubild/Play-Icon — es wird kein
 * iframe und kein Player-Skript geladen, solange niemand klickt. Das hält
 * die Ladezeit der Seite unabhängig von der Anzahl der Videos; erst ein
 * Klick lädt den eigentlichen Player nach (siehe Konzept in den
 * Projekt-Anweisungen).
 */
(function () {
  "use strict";

  var SOURCES = {
    vimeo: {
      attr: "data-vimeo-id",
      // title/byline/portrait=0 blendet Vimeos eigene Beschriftung aus,
      // controls=0 die Fortschrittsleiste/Steuerung — es bleibt nur das
      // reine Video (Play/Pause etc. dann nicht mehr über die Vimeo-UI
      // steuerbar, siehe Hinweis im Chat).
      embedUrl: function (id) {
        return "https://player.vimeo.com/video/" + id + "?autoplay=1&title=0&byline=0&portrait=0&controls=0";
      }
    },
    youtube: {
      attr: "data-youtube-id",
      // controls=0 blendet Titel + Zeitleiste + restliche YouTube-Steuerung
      // aus, modestbranding=1 reduziert das YouTube-Logo, disablekb=1
      // verhindert die Tastatur-Overlay-Hinweise.
      embedUrl: function (id) {
        return "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0&controls=0&modestbranding=1&disablekb=1";
      }
    }
  };

  Object.keys(SOURCES).forEach(function (key) {
    var source = SOURCES[key];
    document.querySelectorAll(".media-placeholder[" + source.attr + "]").forEach(function (tile) {
      tile.addEventListener("click", function loadVideo() {
        var id = tile.getAttribute(source.attr);
        var iframe = document.createElement("iframe");
        iframe.className = "video-embed";
        iframe.src = source.embedUrl(id);
        iframe.allow = "autoplay; fullscreen; picture-in-picture";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";

        tile.replaceChildren(iframe);
        tile.classList.add("is-loaded");
        tile.removeEventListener("click", loadVideo);
      });
    });
  });
})();
