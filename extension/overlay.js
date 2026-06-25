(function () {
  var params = new URLSearchParams(location.search);
  var target = params.get('target') || 'https://faceshion.app/tryon?embed=1&src=extension';
  document.getElementById('faceshion-frame').src = target;

  function close() {
    try { parent.postMessage({ type: 'faceshion:close-overlay' }, '*'); } catch {}
  }

  document.getElementById('close').addEventListener('click', close);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') close();
  });
}());