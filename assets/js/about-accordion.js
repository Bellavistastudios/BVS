// Klick-Toggle für den "About us"-Block unterhalb der Team-Fotos (Hover deckt
// Desktop bereits über CSS ab, siehe .about-item:hover in style.css — hier nur
// die Touch-/Klick-Bedienung + ARIA-State, analog zu services-accordion.js).
(function () {
  var item = document.querySelector(".about-item");
  if (!item) return;

  var trigger = item.querySelector(".about-trigger");

  trigger.addEventListener("click", function () {
    var isOpen = item.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
})();
