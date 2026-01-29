let games = [],
  currentPage = 1,
  currentCategory = '',
  currentGameId = null;
const gamesPerPage = 50;

function getCustomGames() {
  const stored = localStorage.getItem('customGames');
  return stored ? JSON.parse(stored) : [];
}

function saveCustomGames(customGames) {
  localStorage.setItem('customGames', JSON.stringify(customGames));
}

function getFavorites() {
  const stored = localStorage.getItem('favoriteGames');
  return stored ? JSON.parse(stored) : [];
}

function saveFavorites(favorites) {
  localStorage.setItem('favoriteGames', JSON.stringify(favorites));
}

function generateGameId(game) {
  return `${game.label}-${game.url}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

async function loadGames() {
  try {
    const e = await fetch('/storage/data/games.json');
    const data = await e.json();
    games = data.games.map(game => ({
      ...game,
      id: generateGameId(game),
      isCustom: false
    }));
    
    const customGames = getCustomGames();
    games = [...customGames, ...games];
    
    const hiddenGames = getHiddenGames();
    games = games.filter(g => !hiddenGames.includes(g.id));
    
    displayGames(games.slice(0, 50));
    updateLoadMoreButton();
  } catch (e) {
    console.error('Error loading games:', e);
    const customGames = getCustomGames();
    const hiddenGames = getHiddenGames();
    games = customGames.filter(g => !hiddenGames.includes(g.id));
    displayGames(games.slice(0, 50));
    updateLoadMoreButton();
  }
}

function displayGames(e, t = !1) {
  const n = document.getElementById('imageContainer');
  t || (n.innerHTML = '');
  const a = document.createDocumentFragment();
  const favorites = getFavorites();
  
  e.forEach((e) => {
    const t = document.createElement('div');
    t.className = 'image-item';
    t.setAttribute('data-label', e.label);
    t.setAttribute('data-id', e.id);
    e.categories.length > 0 && t.setAttribute('data-category', e.categories[0]);
    
    const isFavorited = favorites.includes(e.id);
    if (isFavorited) {
      t.classList.add('favorited');
    }
    
    t.innerHTML = `
      <a href="${e.url}" class="game-link" data-url="${e.url}">
        <img src="${e.imageUrl}" alt="${e.label}" loading="lazy" decoding="async">
        <div class="label">${e.label}</div>
      </a>
      <div class="game-options" onclick="openGameOptions('${e.id}', event)">
        <i class="fas fa-ellipsis-v"></i>
      </div>
      <div class="favorite-badge">
        <i class="fas fa-star"></i> Favorite
      </div>
    `;
    a.appendChild(t);
  });
  n.appendChild(a);
}

function updateLoadMoreButton() {
  let e = document.getElementById('loadMoreBtn');
  if (!e) {
    e = document.createElement('button');
    e.id = 'loadMoreBtn';
    e.textContent = 'Load More';
    e.addEventListener('click', () => {
      const t = 50 * currentPage;
      const n = t + 50;
      const a = getFilteredGames();
      displayGames(a.slice(t, n), !0);
      currentPage++;
      if (n >= a.length) {
        e.style.display = 'none';
      }
    });
    document.getElementById('imageContainer').after(e);
  }
  const filteredGames = getFilteredGames();
  e.style.display = 50 * currentPage < filteredGames.length ? 'block' : 'none';
}

function debounce(e, t) {
  let n;
  return function (...a) {
    clearTimeout(n);
    n = setTimeout(() => {
      clearTimeout(n);
      e(...a);
    }, t);
  };
}

function getFilteredGames() {
  const e = document.getElementById('search-games').value.toLowerCase();
  const favorites = getFavorites();
  let n = games;
  
  if (e) {
    n = n.filter((t) => t.label.toLowerCase().includes(e));
  }
  if (currentCategory) {
    n = n.filter((e) => e.categories.some(cat => cat.toLowerCase().includes(currentCategory.toLowerCase())));
  }
  
  n.sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });
  
  return n;
}

function filterItems() {
  currentPage = 1;
  displayGames(getFilteredGames().slice(0, 50));
  updateLoadMoreButton();
}

function randomGameOpen() {
  if (games.length > 0) {
    const e = Math.floor(Math.random() * games.length);
    window.location.href = games[e].url;
  }
}

function setActiveCategory(category) {
  currentCategory = category;
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`[data-category="${category}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  filterItems();
}

function openAddGamePopup() {
  document.getElementById('addGamePopup').classList.add('active');
}

function closeAddGamePopup() {
  document.getElementById('addGamePopup').classList.remove('active');
  document.getElementById('addGameForm').reset();
}

function addCustomGame(event) {
  event.preventDefault();
  
  const title = document.getElementById('gameTitle').value;
  let url = document.getElementById('gameUrl').value;
  const imageFile = document.getElementById('gameImage').files[0];
  const category = document.getElementById('gameCategory').value;
  
  if (!imageFile) {
    alert('Please select an image');
    return;
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageUrl = e.target.result;
    const gameUrl = `/iframe.html?url=/embed.html#${url}`;
    
    const newGame = {
      label: title,
      url: gameUrl,
      imageUrl: imageUrl,
      categories: [category],
      isCustom: true,
      id: generateGameId({ label: title, url: gameUrl })
    };
    
    const customGames = getCustomGames();
    customGames.unshift(newGame);
    saveCustomGames(customGames);
    
    games.unshift(newGame);
    
    closeAddGamePopup();
    filterItems();
  };
  reader.readAsDataURL(imageFile);
}

function openGameOptions(gameId, event) {
  event.preventDefault();
  event.stopPropagation();
  currentGameId = gameId;
  
  const game = games.find(g => g.id === gameId);
  const favorites = getFavorites();
  const isFavorited = favorites.includes(gameId);
  
  document.getElementById('favoriteText').textContent = isFavorited ? 'Unfavorite' : 'Favorite';
  document.querySelector('#gameOptionsPopup .option-btn i').className = isFavorited ? 'fas fa-star' : 'far fa-star';
  
  document.getElementById('gameOptionsPopup').classList.add('active');
}

function closeGameOptionsPopup() {
  document.getElementById('gameOptionsPopup').classList.remove('active');
  currentGameId = null;
}

function toggleFavorite() {
  if (!currentGameId) return;
  
  const favorites = getFavorites();
  const index = favorites.indexOf(currentGameId);
  
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(currentGameId);
  }
  
  saveFavorites(favorites);
  closeGameOptionsPopup();
  filterItems();
}

function removeGame() {
  if (!currentGameId) return;
  
  const game = games.find(g => g.id === currentGameId);
  if (!game) return;
  
  if (game.isCustom) {
    const customGames = getCustomGames();
    const filteredCustomGames = customGames.filter(g => g.id !== currentGameId);
    saveCustomGames(filteredCustomGames);
  }
  
  const hiddenGames = getHiddenGames();
  hiddenGames.push(currentGameId);
  saveHiddenGames(hiddenGames);
  
  games = games.filter(g => g.id !== currentGameId);
  
  const favorites = getFavorites();
  const favIndex = favorites.indexOf(currentGameId);
  if (favIndex > -1) {
    favorites.splice(favIndex, 1);
    saveFavorites(favorites);
  }
  
  closeGameOptionsPopup();
  filterItems();
}

function getHiddenGames() {
  const stored = localStorage.getItem('hiddenGames');
  return stored ? JSON.parse(stored) : [];
}

function saveHiddenGames(hiddenGames) {
  localStorage.setItem('hiddenGames', JSON.stringify(hiddenGames));
}

function shareGame() {
  if (!currentGameId) return;
  
  const game = games.find(g => g.id === currentGameId);
  if (!game) return;
  
  let shareUrl = game.url;
  
  if (!shareUrl.startsWith('http://') && !shareUrl.startsWith('https://')) {
    shareUrl = window.location.origin + shareUrl;
  }
  
  document.getElementById('shareLink').value = shareUrl;
  closeGameOptionsPopup();
  document.getElementById('sharePopup').classList.add('active');
}

function closeSharePopup() {
  document.getElementById('sharePopup').classList.remove('active');
}

function copyShareLink() {
  const shareLink = document.getElementById('shareLink');
  shareLink.select();
  shareLink.setSelectionRange(0, 99999);
  
  navigator.clipboard.writeText(shareLink.value).then(() => {
    const copyBtn = document.querySelector('.copy-btn');
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    alert('Failed to copy link');
  });
}

document.getElementById('imageContainer').addEventListener('click', (e) => {
  if (e.target.closest('.game-options')) {
    return;
  }
  
  const gameItem = e.target.closest('.image-item');
  if (gameItem) {
    const gameLink = gameItem.querySelector('.game-link');
    if (gameLink) {
      e.preventDefault();
      window.location.href = gameLink.getAttribute('data-url');
    }
  }
});

window.addEventListener('scroll', debounce(() => {
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
    if (window.scrollY + window.innerHeight >= t - 200) {
      e.click();
    }
  }
}, 100));

document.addEventListener('DOMContentLoaded', () => {
  loadGames();
  
  document.getElementById('search-games').addEventListener('input', debounce(filterItems, 300));
  
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category');
      setActiveCategory(category);
    });
  });
  
  document.getElementById('addGamePopup').addEventListener('click', (e) => {
    if (e.target.id === 'addGamePopup') {
      closeAddGamePopup();
    }
  });
  
  document.getElementById('gameOptionsPopup').addEventListener('click', (e) => {
    if (e.target.id === 'gameOptionsPopup') {
      closeGameOptionsPopup();
    }
  });
  
  document.getElementById('sharePopup').addEventListener('click', (e) => {
    if (e.target.id === 'sharePopup') {
      closeSharePopup();
    }
  });
  
  document.getElementById('gameImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
        preview.classList.add('active');
      };
      reader.readAsDataURL(file);
    }
  });
});