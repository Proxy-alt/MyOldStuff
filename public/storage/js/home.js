function startGaming() {
  window.location.href = 'g.html';
}
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 1e3);
});
let currentCarouselIndex = 0,
  itemsPerView = 6,
  touchStartX = 0,
  touchEndX = 0,
  isDragging = !1;
function initCarousel() {
  const e = document.querySelector('.carousel-container'),
    t = document.querySelector('.carousel-item');
  if (!e || !t) return;
  const n = e.clientWidth,
    o = t.clientWidth;
  ((itemsPerView = Math.floor(n / (o + 8))), itemsPerView < 1 && (itemsPerView = 1), updateCarouselDots());
}
function moveCarousel(e) {
  const t = document.querySelector('.carousel-track'),
    n = t.querySelectorAll('.carousel-item'),
    o = n[0].offsetWidth + 8,
    a = Math.max(0, n.length - itemsPerView);
  ((currentCarouselIndex += e),
    currentCarouselIndex < 0 && (currentCarouselIndex = 0),
    currentCarouselIndex > a && (currentCarouselIndex = a),
    (t.style.transform = `translateX(-${currentCarouselIndex * o}px)`),
    updateCarouselDots());
}
function updateCarouselDots() {
  const e = document.getElementById('carouselDots'),
    t = document.querySelectorAll('.carousel-item'),
    n = Math.max(0, t.length - itemsPerView) + 1;
  e.innerHTML = Array.from(
    { length: n },
    (e, t) => `<div class="carousel-dot ${t === currentCarouselIndex ? 'active' : ''}" onclick="goToCarouselSlide(${t})"></div>`
  ).join('');
}
function goToCarouselSlide(e) {
  ((currentCarouselIndex = e), moveCarousel(0));
}
function handleTouchStart(e) {
  ((touchStartX = e.touches[0].clientX), (isDragging = !0));
}
function handleTouchMove(e) {
  isDragging && (e.preventDefault(), (touchEndX = e.touches[0].clientX));
}
function handleTouchEnd() {
  isDragging && ((isDragging = !1), handleSwipe());
}
function handleMouseDown(e) {
  ((touchStartX = e.clientX), (isDragging = !0), e.preventDefault());
}
function handleMouseMove(e) {
  isDragging && (touchEndX = e.clientX);
}
function handleMouseUp() {
  isDragging && ((isDragging = !1), handleSwipe());
}
function handleSwipe() {
  const e = touchStartX - touchEndX;
  Math.abs(e) > 50 && moveCarousel(e > 0 ? 1 : -1);
}
(document.addEventListener('DOMContentLoaded', function () {
  const e = document.querySelector('.carousel-track');
  (e.addEventListener('touchstart', handleTouchStart, { passive: !0 }),
    e.addEventListener('touchmove', handleTouchMove, { passive: !1 }),
    e.addEventListener('touchend', handleTouchEnd, { passive: !0 }),
    e.addEventListener('mousedown', handleMouseDown),
    e.addEventListener('mousemove', handleMouseMove),
    e.addEventListener('mouseup', handleMouseUp),
    e.addEventListener('mouseleave', handleMouseUp),
    initCarousel());
}),
  window.addEventListener('resize', function () {
    (clearTimeout(window.resizeTimer), (window.resizeTimer = setTimeout(initCarousel, 200)));
  }));
const images = [
  { src: '/storage/images/main/highway-racer.jpeg', caption: 'Highway Racer' },
  { src: '/storage/images/main/buildnow.jpeg', caption: 'Buildnow.gg' },
  { src: '/storage/ag/g/slope/IMG_5256.jpeg', caption: 'Slope' },
  { src: '/storage/images/main/clash.jpeg', caption: 'Clash Royale' },
  { src: '/storage/images/main/superstarcar.jpeg', caption: 'Superstar Car' },
  { src: '/storage/ag/g/yohoho/IMG_5302.jpeg', caption: 'YoHoHo!' }
];
let currentIndex = 0;
const imageElement = document.getElementById('large-image'),
  captionElement = document.getElementById('large-image-caption');
function changeImage() {
  currentIndex = (currentIndex + 1) % images.length;
  const e = images[currentIndex];
  ((imageElement.src = e.src), (captionElement.textContent = e.caption));
}
setInterval(changeImage, 3e3);
class TxtType {
  constructor(e, t, n) {
    ((this.toRotate = t),
      (this.el = e),
      (this.loopNum = 0),
      (this.period = parseInt(n, 10) || 2e3),
      (this.txt = ''),
      this.tick(),
      (this.isDeleting = !1));
  }
  tick() {
    const e = this.loopNum % this.toRotate.length,
      t = this.toRotate[e];
    (this.isDeleting ? (this.txt = t.substring(0, this.txt.length - 1)) : (this.txt = t.substring(0, this.txt.length + 1)),
      (this.el.innerHTML = '<span class="wrap">' + this.txt + '</span>'));
    let n = 200 - 100 * Math.random();
    (this.isDeleting && (n /= 2),
      this.isDeleting || this.txt !== t
        ? this.isDeleting && '' === this.txt && ((this.isDeleting = !1), this.loopNum++, (n = 500))
        : ((n = this.period), (this.isDeleting = !0)),
      setTimeout(() => this.tick(), n));
  }
}
(document.addEventListener('DOMContentLoaded', function () {
  const e = document.getElementsByClassName('typewrite');
  for (let t = 0; t < e.length; t++) {
    const n = e[t].getAttribute('data-type'),
      o = e[t].getAttribute('data-period');
    n && new TxtType(e[t], JSON.parse(n), o);
  }
  const t = document.createElement('style');
  ((t.type = 'text/css'), (t.innerHTML = '.typewrite > .wrap { border-right: 0.06em solid #0096FF}'), document.body.appendChild(t));
}),
  document.addEventListener('DOMContentLoaded', function () {
    const e = document.getElementById('discord-popup');
    (document.getElementById('close-popup').addEventListener('click', function () {
      ((e.style.display = 'none'), localStorage.setItem('lastPopupClose', new Date().getTime()));
    }),
      (function () {
        const t = localStorage.getItem('lastPopupClose'),
          n = new Date().getTime();
        (!t || n - t > 36e5) && (e.style.display = 'flex');
      })());
  }),
  document.addEventListener('DOMContentLoaded', function () {
    const e = document.getElementById('time-display'),
      t = document.getElementById('battery-icon'),
      n = document.getElementById('battery-percentage'),
      o = document.getElementById('fps');
    let a = 0,
      s = performance.now();
    function i() {
      const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      e.textContent = ` ${t}`;
    }
    function r() {
      'getBattery' in navigator
        ? navigator.getBattery().then(function (e) {
            const o = 100 * e.level,
              a = Math.round(o);
            ((n.textContent = `${a}%`),
              (t.className = 'fas battery-icon'),
              a >= 90
                ? t.classList.add('fa-battery-full', 'battery-full')
                : a >= 70
                  ? t.classList.add('fa-battery-three-quarters', 'battery-good')
                  : a >= 50
                    ? t.classList.add('fa-battery-half', 'battery-good')
                    : a >= 30
                      ? t.classList.add('fa-battery-quarter', 'battery-medium')
                      : t.classList.add('fa-battery-empty', 'battery-low'));
          })
        : ((n.textContent = 'n/a'), (t.className = 'fas fa-battery-slash battery-icon'));
    }
    (i(),
      r(),
      requestAnimationFrame(function e() {
        a++;
        const t = performance.now();
        if (t - s >= 1e3) {
          const e = a;
          ((o.textContent = `FPS: ${e}`), (a = 0), (s = t));
        }
        requestAnimationFrame(e);
      }),
      setInterval(i, 6e4),
      setInterval(r, 3e4));
  }));
