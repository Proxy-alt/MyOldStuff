document.addEventListener('DOMContentLoaded', () => {
  const e = {
      tabs: document.querySelectorAll('.tab') || [],
      sections: document.querySelectorAll('.section') || [],
      legalTabs: document.querySelectorAll('.legal-tab') || [],
      legalSections: document.querySelectorAll('.legal-section') || [],
      beforeUnloadToggle: document.getElementById('beforeUnloadToggle'),
      autocloakToggle: document.getElementById('autocloakToggle'),
      blockHeadersToggle: document.getElementById('blockHeadersToggle'),
      disableRightClickToggle: document.getElementById('disableRightClickToggle'),
      sitePreset: document.getElementById('sitePreset'),
      siteTitle: document.getElementById('siteTitle'),
      siteLogo: document.getElementById('siteLogo'),
      themeSelect: document.getElementById('themeSelect'),
      backgroundColor: document.getElementById('backgroundColor'),
      backgroundImage: document.getElementById('backgroundImage'),
      removeBackgroundImage: document.getElementById('removeBackgroundImage'),
      panicKey: document.getElementById('panicKey'),
      panicUrl: document.getElementById('panicUrl'),
      saveSettings: document.getElementById('saveSettings'),
      saveAppearance: document.getElementById('saveAppearance'),
      savePanicSettings: document.getElementById('savePanicSettings'),
      resetSettings: document.getElementById('resetSettings'),
      openAboutBlank: document.getElementById('openAboutBlank'),
      exportData: document.getElementById('exportData'),
      importData: document.getElementById('importData'),
      resetAllData: document.getElementById('resetAllData'),
      disableParticles: document.getElementById('disableParticles')
    },
    t = {
      classroom: { title: 'Google Classroom', favicon: 'https://ssl.gstatic.com/classroom/favicon.ico' },
      schoology: { title: 'Schoology', favicon: 'https://asset-cdn.schoology.com/sites/all/themes/schoology_theme/favicon.ico' },
      google: { title: 'Google', favicon: 'https://www.google.com/favicon.ico' },
      petezah: { title: 'PeteZah', favicon: '/storage/images/logo-png-removebg-preview.png' }
    },
    o = {
      'default': { bgColor: '#0A1D37', textColor: '#FFFFFF' },
      'swampy-green': { bgColor: '#1A3C34', textColor: '#D4E4D9' },
      'royal-purple': { bgColor: '#2A1A3C', textColor: '#E2D4E9' },
      'blood-red': { bgColor: '#3C0A1A', textColor: '#E9D4D4' },
      'midnight-forest': { bgColor: '#1F2A2F', textColor: '#CDE4D9' },
      'cyber-neon': { bgColor: '#1A1A2E', textColor: '#E0E0FF' },
      'desert-oasis': { bgColor: '#3C2F1A', textColor: '#E9E4D4' },
      'glacial-frost': { bgColor: '#2A3C4F', textColor: '#D4E9E9' }
    },
    a = () => {
      const e = localStorage.getItem('siteTitle');
      e && (document.title = e);
      const t = localStorage.getItem('siteLogo');
      t && d(t);
      const a = localStorage.getItem('theme') || 'default';
      ((document.body.className = document.body.className.replace(/theme-\w+/g, '')), document.body.classList.add(`theme-${a}`));
      const n = localStorage.getItem('backgroundImage'),
        r = localStorage.getItem('backgroundColor') || o[a].bgColor;
      (n
        ? ((document.body.style.backgroundImage = `url(${n})`),
          (document.body.style.backgroundSize = 'cover'),
          (document.body.style.backgroundRepeat = 'no-repeat'),
          (document.body.style.backgroundPosition = 'center'),
          (document.body.style.backgroundColor = ''))
        : ((document.body.style.backgroundImage = 'none'), (document.body.style.backgroundColor = r)),
        (document.body.style.color = o[a].textColor),
        l(),
        c(),
        'true' === localStorage.getItem('beforeUnload') ? window.addEventListener('beforeunload', m) : window.removeEventListener('beforeunload', m));
    },
    l = () => {
      (document.removeEventListener('contextmenu', u),
        'true' === localStorage.getItem('disableRightClick') && document.addEventListener('contextmenu', u));
    },
    c = () => {
      const e = document.querySelectorAll('.particles'),
        t = document.querySelectorAll('.particle');
      'true' === localStorage.getItem('disableParticles') &&
        (e.forEach((e) => {
          e.parentNode && e.parentNode.removeChild(e);
        }),
        t.forEach((e) => {
          e.parentNode && e.parentNode.removeChild(e);
        }));
    },
    n = () => {
      (localStorage.setItem('settingsUpdated', Date.now().toString()), a());
    },
    r = () => {
      if (
        (e.beforeUnloadToggle && (e.beforeUnloadToggle.checked = 'true' === localStorage.getItem('beforeUnload')),
        e.autocloakToggle && (e.autocloakToggle.checked = 'true' === localStorage.getItem('autocloak')),
        e.blockHeadersToggle && (e.blockHeadersToggle.checked = 'true' === localStorage.getItem('blockHeaders')),
        e.disableRightClickToggle && (e.disableRightClickToggle.checked = 'true' === localStorage.getItem('disableRightClick')),
        e.siteTitle && (e.siteTitle.value = localStorage.getItem('siteTitle') || ''),
        e.panicKey && (e.panicKey.value = localStorage.getItem('panicKey') || ''),
        e.panicUrl && (e.panicUrl.value = localStorage.getItem('panicUrl') || 'https://classroom.google.com'),
        e.backgroundColor && (e.backgroundColor.value = localStorage.getItem('backgroundColor') || o.default.bgColor),
        e.themeSelect)
      ) {
        const t = localStorage.getItem('theme') || 'default';
        ((e.themeSelect.value = t),
          document.body.classList.add(`theme-${t}`),
          localStorage.getItem('backgroundImage') || (document.body.style.backgroundColor = o[t].bgColor),
          (document.body.style.color = o[t].textColor));
      }
      (e.disableParticles && (e.disableParticles.checked = 'true' === localStorage.getItem('disableParticles')), a());
    },
    d = (e) => {
      let t = document.querySelector('link[rel="icon"]');
      (t || ((t = document.createElement('link')), (t.rel = 'icon'), document.head.appendChild(t)), (t.href = e));
    },
    g = (e, t, o) => {
      e.forEach((a) => {
        a.addEventListener('click', () => {
          const l = a.getAttribute(o);
          (t.forEach((e) => e.classList.remove('active')),
            document.getElementById(l).classList.add('active'),
            e.forEach((e) => e.classList.remove('active')),
            a.classList.add('active'));
        });
      });
    },
    s = () => {
      const e = window.open('about:blank', '_blank');
      if (!e || e.closed) return void alert('Please allow popups for about:blank to work.');
      e.document.title = localStorage.getItem('siteTitle') || 'Home';
      const t = e.document.createElement('link');
      ((t.rel = 'icon'),
        (t.href = localStorage.getItem('siteLogo') || '/storage/images/logo-png-removebg-preview.png'),
        e.document.head.appendChild(t));
      const o = e.document.createElement('iframe');
      ((o.src = '/index.html'),
        (o.style.cssText = 'width: 100vw; height: 100vh; border: none;'),
        (e.document.body.style.margin = '0'),
        e.document.body.appendChild(o));
    },
    i = () => {
      (s(), (window.location.href = localStorage.getItem('panicUrl') || 'https://classroom.google.com'));
    },
    m = (e) => {
      (e.preventDefault(), (e.returnValue = ''));
    },
    u = (e) => e.preventDefault();
  (e.beforeUnloadToggle &&
    e.beforeUnloadToggle.addEventListener('change', () => {
      (localStorage.setItem('beforeUnload', e.beforeUnloadToggle.checked), a(), n());
    }),
    e.autocloakToggle &&
      e.autocloakToggle.addEventListener('change', () => {
        (localStorage.setItem('autocloak', e.autocloakToggle.checked), e.autocloakToggle.checked && i(), n());
      }),
    e.blockHeadersToggle &&
      e.blockHeadersToggle.addEventListener('change', () => {
        (localStorage.setItem('blockHeaders', e.blockHeadersToggle.checked), n());
      }),
    e.disableRightClickToggle &&
      e.disableRightClickToggle.addEventListener('change', () => {
        (localStorage.setItem('disableRightClick', e.disableRightClickToggle.checked), a(), n());
      }),
    e.sitePreset &&
      e.sitePreset.addEventListener('change', () => {
        const o = e.sitePreset.value;
        'custom' !== o &&
          ((e.siteTitle.value = t[o].title), localStorage.setItem('siteTitle', t[o].title), localStorage.setItem('siteLogo', t[o].favicon), a(), n());
      }),
    e.saveSettings &&
      e.saveSettings.addEventListener('click', () => {
        if ((e.siteTitle.value && localStorage.setItem('siteTitle', e.siteTitle.value), e.siteLogo.files[0])) {
          const t = new FileReader();
          ((t.onload = (e) => {
            (localStorage.setItem('siteLogo', e.target.result), a(), n());
          }),
            t.readAsDataURL(e.siteLogo.files[0]));
        } else (a(), n());
      }),
    e.themeSelect &&
      e.themeSelect.addEventListener('change', () => {
        const t = e.themeSelect.value;
        (localStorage.setItem('theme', t),
          (document.body.className = document.body.className.replace(/theme-\w+/g, '')),
          document.body.classList.add(`theme-${t}`),
          localStorage.getItem('backgroundImage') ||
            ((document.body.style.backgroundColor = o[t].bgColor),
            (e.backgroundColor.value = o[t].bgColor),
            localStorage.setItem('backgroundColor', o[t].bgColor)),
          (document.body.style.color = o[t].textColor),
          n());
      }),
    e.saveAppearance &&
      e.saveAppearance.addEventListener('click', () => {
        if ((localStorage.setItem('backgroundColor', e.backgroundColor.value), e.backgroundImage && e.backgroundImage.files[0])) {
          const t = new FileReader();
          ((t.onload = (e) => {
            (localStorage.setItem('backgroundImage', e.target.result), a(), n());
          }),
            t.readAsDataURL(e.backgroundImage.files[0]));
        } else (a(), n());
        e.disableParticles && (localStorage.setItem('disableParticles', e.disableParticles.checked), c());
      }),
    e.backgroundColor &&
      e.backgroundColor.addEventListener('input', () => {
        (localStorage.getItem('backgroundImage') || (document.body.style.backgroundColor = e.backgroundColor.value),
          localStorage.setItem('theme', 'custom'),
          e.themeSelect && (e.themeSelect.value = 'default'));
      }),
    e.backgroundImage &&
      e.backgroundImage.addEventListener('change', () => {
        if (e.backgroundImage.files[0]) {
          const t = new FileReader();
          ((t.onload = (e) => {
            ((document.body.style.backgroundImage = `url(${e.target.result})`),
              (document.body.style.backgroundSize = 'cover'),
              (document.body.style.backgroundRepeat = 'no-repeat'),
              (document.body.style.backgroundPosition = 'center'),
              (document.body.style.backgroundColor = ''));
          }),
            t.readAsDataURL(e.backgroundImage.files[0]));
        }
      }),
    e.removeBackgroundImage &&
      e.removeBackgroundImage.addEventListener('click', () => {
        (localStorage.removeItem('backgroundImage'),
          (document.body.style.backgroundImage = 'none'),
          (document.body.style.backgroundColor = e.backgroundColor.value || o.default.bgColor),
          n());
      }),
    e.disableParticles &&
      e.disableParticles.addEventListener('change', () => {
        (localStorage.setItem('disableParticles', e.disableParticles.checked), c(), n());
      }),
    e.savePanicSettings &&
      e.savePanicSettings.addEventListener('click', () => {
        (localStorage.setItem('panicKey', e.panicKey.value), localStorage.setItem('panicUrl', e.panicUrl.value), n());
      }),
    e.resetSettings &&
      e.resetSettings.addEventListener('click', () => {
        confirm('Are you sure you want to reset all settings to default?') && (localStorage.clear(), r(), a(), n());
      }),
    e.openAboutBlank && e.openAboutBlank.addEventListener('click', s),
    e.exportData &&
      e.exportData.addEventListener('click', () => {
        const e = { localStorage: { ...localStorage }, cookies: document.cookie },
          t = new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' }),
          o = URL.createObjectURL(t),
          a = document.createElement('a');
        ((a.href = o), (a.download = 'settings-export.json'), a.click(), URL.revokeObjectURL(o));
      }),
    e.importData &&
      e.importData.addEventListener('change', (e) => {
        const t = e.target.files[0];
        if (!t) return;
        const o = new FileReader();
        ((o.onload = (e) => {
          const t = JSON.parse(e.target.result);
          (localStorage.clear(),
            Object.keys(t.localStorage).forEach((e) => localStorage.setItem(e, t.localStorage[e])),
            (document.cookie = t.cookies),
            r(),
            a(),
            n());
        }),
          o.readAsText(t));
      }),
    e.resetAllData &&
      e.resetAllData.addEventListener('click', () => {
        confirm('Are you sure you want to reset all data? This will clear all settings, cookies, and local storage.') &&
          (localStorage.clear(),
          document.cookie.split(';').forEach((e) => {
            document.cookie = e.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
          }),
          r(),
          a(),
          n());
      }),
    window.addEventListener('keydown', (e) => {
      const t = localStorage.getItem('panicKey'),
        o = localStorage.getItem('panicUrl');
      t && o && e.key === t && (window.location.href = o);
    }),
    window.addEventListener('storage', (e) => {
      'settingsUpdated' === e.key && a();
    }),
    r(),
    g(e.tabs, e.sections, 'data-tab'),
    g(e.legalTabs, e.legalSections, 'data-legal'),
    window === window.top && e.autocloakToggle && e.autocloakToggle.checked && !navigator.userAgent.includes('Firefox') && i());
});
const beforeUnloadHandler = (e) => {
    (e.preventDefault(), (e.returnValue = ''));
  },
  rightClickHandler = (e) => e.preventDefault();
