/**
 * Bella Vista Studios — Team-Modal (Lightbox).
 *
 * Jedes Profilfoto im Team-Bereich (.team-avatar--photo) startet klein und
 * rund. Per Klick wird ein einziges, wiederverwendetes Modal (#team-modal)
 * mit den data-Attributen des jeweiligen Buttons befüllt (Foto, Name, Rolle,
 * Bio) und eingeblendet — großes Bild, Text als Scrim darüber.
 */
(function () {
  "use strict";

  var modal = document.getElementById("team-modal");
  if (!modal) return;

  var triggers = document.querySelectorAll("[data-team-trigger]");
  if (!triggers.length) return;

  var photo = modal.querySelector(".team-modal-photo");
  var name = modal.querySelector(".team-modal-caption h3");
  var role = modal.querySelector(".team-modal-role");
  var bio = modal.querySelector(".team-modal-bio");
  var lastTrigger = null;

  function open(trigger) {
    photo.src = trigger.getAttribute("data-photo") || "";
    photo.alt = trigger.getAttribute("data-name") || "";
    name.textContent = trigger.getAttribute("data-name") || "";
    role.textContent = trigger.getAttribute("data-role") || "";
    bio.textContent = trigger.getAttribute("data-bio") || "";

    lastTrigger = trigger;
    // Pop-out-Zoom bleibt erzwungen, solange das Modal offen ist — unabhängig
    // davon, ob die Maus noch über der Kachel steht (siehe .team-cutout.is-active
    // in style.css). Sonst verschwindet der Zoom sofort, sobald der Mauszeiger
    // beim Öffnen auf das Modal statt auf die Kachel darunter trifft.
    trigger.classList.add("is-active");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    photo.src = "";
    if (lastTrigger) {
      lastTrigger.classList.remove("is-active");
      lastTrigger.focus();
    }
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      open(trigger);
    });
  });

  modal.querySelectorAll("[data-team-close]").forEach(function (el) {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) close();
  });
})();
