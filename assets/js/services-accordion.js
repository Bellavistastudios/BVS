// Klick-Toggle für die Service-Kacheln (Hover deckt Desktop bereits über CSS ab,
// hier nur die Touch-/Klick-Bedienung + ARIA-State).
(function () {
  var items = document.querySelectorAll(".service-item");

  function closeAll() {
    items.forEach(function (item) {
      item.classList.remove("is-open");
      item.querySelector(".service-trigger").setAttribute("aria-expanded", "false");
    });
  }

  items.forEach(function (item) {
    var trigger = item.querySelector(".service-trigger");

    trigger.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");
      closeAll();
      if (!isOpen) {
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".service-item")) closeAll();
  });
})();
