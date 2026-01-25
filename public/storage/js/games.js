let games = [],
  currentPage = 1;
const gamesPerPage = 50;
async function loadGames() {
  try {
    const e = await fetch('/storage/data/games.json');
    ((games = (await e.json()).games), displayGames(games.slice(0, 50)), updateLoadMoreButton());
  } catch (e) {
    console.error('Error loading games:', e);
  }
}
function displayGames(e, t = !1) {
  const n = document.getElementById('imageContainer');
  t || (n.innerHTML = '');
  const a = document.createDocumentFragment();
  (e.forEach((e) => {
    const t = document.createElement('div');
    ((t.className = 'image-item'),
      t.setAttribute('data-label', e.label),
      e.categories.length > 0 && t.setAttribute('data-category', e.categories[0]),
      (t.innerHTML = `\n                    <a href="${e.url}" class="game-link" data-url="${e.url}">\n                        <img src="${e.imageUrl}" alt="${e.label}" loading="lazy" decoding="async">\n                        <div class="label">${e.label}</div>\n                    </a>\n                `),
      a.appendChild(t));
  }),
    n.appendChild(a));
}
function updateLoadMoreButton() {
  let e = document.getElementById('loadMoreBtn');
  (e ||
    ((e = document.createElement('button')),
    (e.id = 'loadMoreBtn'),
    (e.textContent = 'Load More'),
    (e.style.cssText =
      '\n                    padding: 10px 20px; margin: 20px auto; display: block;\n                    background-color: #141414; color: white; border: 1px solid white;\n                    font-size: 16px; cursor: pointer; border-radius: 16px;\n                '),
    e.addEventListener('click', () => {
      const t = 50 * currentPage,
        n = t + 50,
        a = getFilteredGames();
      (displayGames(a.slice(t, n), !0), currentPage++, n >= a.length && (e.style.display = 'none'));
    }),
    document.getElementById('imageContainer').after(e)),
    (e.style.display = 50 * currentPage < getFilteredGames().length ? 'block' : 'none'));
}
function debounce(e, t) {
  let n;
  return function (...a) {
    (clearTimeout(n),
      (n = setTimeout(() => {
        (clearTimeout(n), e(...a));
      }, t)));
  };
}
function getFilteredGames() {
  const e = document.getElementById('search-games').value.toLowerCase(),
    t = document.getElementById('gameFilter').value.toLowerCase();
  let n = games;
  return (e && (n = n.filter((t) => t.label.toLowerCase().includes(e))), t && (n = n.filter((e) => e.categories.includes(t))), n);
}
function filterItems() {
  ((currentPage = 1), displayGames(getFilteredGames().slice(0, 50)), updateLoadMoreButton());
}
function randomGameOpen() {
  if (games.length > 0) {
    const e = Math.floor(Math.random() * games.length);
    window.location.href = games[e].url;
  }
}
function filterByCategory() {
  filterItems();
}
(document.getElementById('imageContainer').addEventListener('click', (e) => {
  const t = e.target.closest('.game-link');
  t && (e.preventDefault(), (window.location.href = t.getAttribute('data-url')));
}),
  window.addEventListener(
    'scroll',
    debounce(() => {
      const e = document.getElementById('loadMoreBtn');
      if (e && 'none' !== e.style.display && null !== e.offsetParent) {
        const t = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight,
          document.body.clientHeight,
          document.documentElement.clientHeight
        );
        window.scrollY + window.innerHeight >= t - 200 && e.click();
      }
    }, 100)
  ),
  document.addEventListener('DOMContentLoaded', () => {
    (loadGames(), document.getElementById('search-games').addEventListener('input', debounce(filterItems, 300)));
  }));
