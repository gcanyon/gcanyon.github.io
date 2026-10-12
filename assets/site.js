// Topic filter chips (archive page). Hides rows and any year heading left empty.
(function () {
  var bar = document.querySelector('[data-chips]');
  if (!bar) return;
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var f = b.getAttribute('data-f');
    bar.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
    document.querySelectorAll('#list .row').forEach(function (r) {
      r.hidden = !(f === 'all' || r.getAttribute('data-topic') === f);
    });
    document.querySelectorAll('#list .group').forEach(function (g) {
      g.hidden = !g.querySelector('.row:not([hidden])');
    });
  });
})();
