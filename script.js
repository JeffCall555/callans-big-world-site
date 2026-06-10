/* Shared: mobile nav toggle */
(function () {
  var t = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (t && links) {
    t.addEventListener('click', function () { links.classList.toggle('open'); });
  }
})();
