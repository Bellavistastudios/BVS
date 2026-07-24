// "View All Projects" auf der Startseite: klappt die restlichen Projekte
// direkt unterhalb der ersten 4 auf (statt auf projekte.html weiterzuleiten)
// und über denselben Button per "View Less" auch wieder ein.
(function () {
  var grid = document.querySelector(".projects-grid");
  var button = document.getElementById("load-more-projects");
  if (!grid || !button) return;

  var LABEL_MORE = button.textContent;
  var LABEL_LESS = "View Less";

  button.addEventListener("click", function () {
    var expanded = grid.classList.toggle("show-all");
    button.textContent = expanded ? LABEL_LESS : LABEL_MORE;
  });
})();
