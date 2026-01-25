(document.querySelector('.url-input').addEventListener('keyup', function (e) {
  if (13 === e.keyCode) {
    e.preventDefault();
    var t = this.value;
    if (t.includes('.'))
      (t.startsWith('http://') || t.startsWith('https://') || (t = 'http://' + t),
        window.navigator.serviceWorker.register('/petezah/sw.js', { scope: __uv$config.prefix }).then(() => {
          window.location.href = __uv$config.prefix + __uv$config.encodeUrl(t);
        }));
    else {
      var i = 'https://duckduckgo.com/?q=' + encodeURIComponent(t);
      window.navigator.serviceWorker.register('/petezah/sw.js', { scope: __uv$config.prefix }).then(() => {
        window.location.href = __uv$config.prefix + __uv$config.encodeUrl(i);
      });
    }
  }
}),
  document.querySelector('.url-input').addEventListener('focus', function () {
    this.value && -1 !== this.value.indexOf('.') && (this.value = 'https://' + this.value);
  }),
  document.querySelector('.url-input').addEventListener('blur', function () {
    this.value = this.value.replace(/^https?:\/\//, '');
  }));
