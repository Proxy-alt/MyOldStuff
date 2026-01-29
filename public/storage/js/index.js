const sidebar = document.querySelector('.sidebar'),
  sidebarToggler = document.querySelector('.sidebar-toggler'),
  menuToggler = document.querySelector('.menu-toggler'),
  mainContent = document.querySelector('.main-content'),
  navLinks = document.querySelectorAll('.sidebar-nav .nav-link'),
  mainFrame = document.getElementById('mainFrame'),
  widgetButton = document.querySelector('.widget-button'),
  widgetPopup = document.querySelector('.widget-popup'),
  widgetOptions = document.querySelectorAll('.widget-option');

function isMobile() {
  return window.innerWidth <= 1024;
}

if ((location.pathname.endsWith('index.html') && '#blank' === location.hash) || location.href.endsWith('#blank')) {
  const e = window.open(),
    t = e.document.createElement('iframe');
  ((t.src = location.origin + location.pathname.replace('index.html', '') + '/'),
    (t.style = 'border:none; width:100%; height:100vh; position:fixed; top:0; left:0;'),
    (t.allow = 'fullscreen'),
    (t.referrerpolicy = 'no-referrer'),
    (e.document.body.style.margin = '0'),
    e.document.body.appendChild(t),
    (window.location = 'about:blank'));
}

if (!isMobile()) {
  sidebar.classList.add('collapsed');
  mainContent.classList.remove('sidebar-expanded');
} else {
  sidebar.classList.add('mobile-hidden');
}

function handleToggle() {
  if (isMobile()) {
    sidebar.classList.toggle('mobile-hidden');
    sidebar.classList.toggle('mobile-visible');
  } else {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('sidebar-expanded');
  }
}

sidebarToggler.addEventListener('click', handleToggle);
if (menuToggler) {
  menuToggler.addEventListener('click', handleToggle);
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isMobile()) {
      sidebar.classList.remove('collapsed');
      mainContent.classList.remove('sidebar-expanded');
      if (!sidebar.classList.contains('mobile-visible')) {
        sidebar.classList.add('mobile-hidden');
      }
    } else {
      sidebar.classList.remove('mobile-hidden', 'mobile-visible');
      if (!sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
      }
    }
  }, 250);
});

function updateActiveNavLink(src) {
  let found = false;
  navLinks.forEach((link) => {
    const linkSrc = link.getAttribute('data-src');
    if (src.includes(linkSrc) || linkSrc === src) {
      link.classList.add('active');
      found = true;
    } else {
      link.classList.remove('active');
    }
  });
}

if (mainFrame) {
  mainFrame.addEventListener('load', () => {
    const currentSrc = mainFrame.getAttribute('src');
    if (currentSrc) {
      updateActiveNavLink(currentSrc);
    }
  });
}

class TxtType {
  constructor(e, t, i) {
    ((this.toRotate = t),
      (this.el = e),
      (this.loopNum = 0),
      (this.period = Number.parseInt(i, 10) || 2e3),
      (this.txt = ''),
      this.tick(),
      (this.isDeleting = !1));
  }
  tick() {
    const e = this.loopNum % this.toRotate.length,
      t = this.toRotate[e];
    (this.isDeleting ? (this.txt = t.substring(0, this.txt.length - 1)) : (this.txt = t.substring(0, this.txt.length + 1)),
      (this.el.innerHTML = '<span class="wrap">' + this.txt + '</span>'));
    let i = 200 - 100 * Math.random();
    (this.isDeleting && (i /= 2),
      this.isDeleting || this.txt !== t
        ? this.isDeleting && '' === this.txt && ((this.isDeleting = !1), this.loopNum++, (i = 500))
        : ((i = this.period), (this.isDeleting = !0)),
      setTimeout(() => this.tick(), i));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const e = document.getElementsByClassName('typewrite');
  for (let t = 0; t < e.length; t++) {
    const i = e[t].getAttribute('data-type'),
      s = e[t].getAttribute('data-period');
    i && new TxtType(e[t], JSON.parse(i), s);
  }
  const t = document.createElement('style');
  t.innerHTML = '.typewrite > .wrap { border-right: 0.06em solid #a04cff}';
  document.body.appendChild(t);
  
  if (navLinks.length > 0) {
    const initialSrc = mainFrame.getAttribute('src');
    if (initialSrc) {
      updateActiveNavLink(initialSrc);
    } else {
      navLinks[0].classList.add('active');
    }
  }
});

navLinks.forEach((e) => {
  e.addEventListener('click', (t) => {
    t.preventDefault();
    const i = e.getAttribute('data-src');
    if (i) {
      mainFrame.src = i;
      navLinks.forEach((link) => link.classList.remove('active'));
      e.classList.add('active');
    }
  });
});

widgetButton.addEventListener('click', () => {
  widgetPopup.classList.toggle('show');
});

widgetOptions.forEach((e) => {
  e.addEventListener('click', () => {
    const t = e.getAttribute('data-src');
    if (t) {
      mainFrame.src = t;
    }
    widgetPopup.classList.remove('show');
  });
});

document.addEventListener('click', (e) => {
  widgetButton.contains(e.target) || widgetPopup.contains(e.target) || widgetPopup.classList.remove('show');
});

window.addEventListener('message', (e) => {
  e.origin === window.location.origin &&
    (('login_success' !== e.data.type && 'signup_success' !== e.data.type) || (mainFrame.src = 'pages/settings/p2.html'),
    'logout' === e.data.type && (mainFrame.src = 'pages/settings/p.html'));
});