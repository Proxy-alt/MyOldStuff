let apps = [],
  currentAppId = null;

function getCustomApps() {
  const stored = localStorage.getItem('customApps');
  return stored ? JSON.parse(stored) : [];
}

function saveCustomApps(customApps) {
  localStorage.setItem('customApps', JSON.stringify(customApps));
}

function getFavorites() {
  const stored = localStorage.getItem('favoriteApps');
  return stored ? JSON.parse(stored) : [];
}

function saveFavorites(favorites) {
  localStorage.setItem('favoriteApps', JSON.stringify(favorites));
}

function generateAppId(app) {
  return `${app.label}-${app.url}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function getHiddenApps() {
  const stored = localStorage.getItem('hiddenApps');
  return stored ? JSON.parse(stored) : [];
}

function saveHiddenApps(hiddenApps) {
  localStorage.setItem('hiddenApps', JSON.stringify(hiddenApps));
}

function loadApps() {
  const container = document.getElementById('imageContainer');
  const appElements = container.querySelectorAll('.image-item');
  
  apps = Array.from(appElements).map(element => {
    const label = element.getAttribute('data-label');
    const link = element.querySelector('a');
    const img = element.querySelector('img');
    const url = link ? link.getAttribute('href') : '';
    const imageUrl = img ? img.getAttribute('src') : '';
    
    return {
      label: label,
      url: url,
      imageUrl: imageUrl,
      isCustom: false,
      id: generateAppId({ label, url })
    };
  });
  
  const customApps = getCustomApps();
  apps = [...customApps, ...apps];
  
  const hiddenApps = getHiddenApps();
  apps = apps.filter(a => !hiddenApps.includes(a.id));
  
  displayApps(apps);
}

function displayApps(appsList) {
  const container = document.getElementById('imageContainer');
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const favorites = getFavorites();
  
  appsList.sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });
  
  appsList.forEach((app) => {
    const div = document.createElement('div');
    div.className = 'image-item';
    div.setAttribute('data-label', app.label);
    div.setAttribute('data-id', app.id);
    
    const isFavorited = favorites.includes(app.id);
    if (isFavorited) {
      div.classList.add('favorited');
    }
    
    div.innerHTML = `
      <a href="${app.url}" class="app-link" data-url="${app.url}">
        <img src="${app.imageUrl}" alt="${app.label}" loading="lazy" decoding="async">
        <div class="label">${app.label}</div>
      </a>
      <div class="app-options" onclick="openAppOptions('${app.id}', event)">
        <i class="fas fa-ellipsis-v"></i>
      </div>
      <div class="favorite-badge">
        <i class="fas fa-star"></i> Favorite
      </div>
    `;
    fragment.appendChild(div);
  });
  container.appendChild(fragment);
}

function filterItems() {
  const searchValue = document.getElementById('search-games').value.toLowerCase();
  let filtered = apps;
  
  if (searchValue) {
    filtered = filtered.filter((app) => app.label.toLowerCase().includes(searchValue));
  }
  
  displayApps(filtered);
}

function openAddAppPopup() {
  document.getElementById('addAppPopup').classList.add('active');
}

function closeAddAppPopup() {
  document.getElementById('addAppPopup').classList.remove('active');
  document.getElementById('addAppForm').reset();
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = '';
  preview.classList.remove('active');
}

function addCustomApp(event) {
  event.preventDefault();
  
  const title = document.getElementById('appTitle').value;
  let url = document.getElementById('appUrl').value;
  const imageFile = document.getElementById('appImage').files[0];
  
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
    const appUrl = `/iframe.html?url=/embed.html#${url}`;
    
    const newApp = {
      label: title,
      url: appUrl,
      imageUrl: imageUrl,
      isCustom: true,
      id: generateAppId({ label: title, url: appUrl })
    };
    
    const customApps = getCustomApps();
    customApps.unshift(newApp);
    saveCustomApps(customApps);
    
    apps.unshift(newApp);
    
    closeAddAppPopup();
    filterItems();
  };
  reader.readAsDataURL(imageFile);
}

function openAppOptions(appId, event) {
  event.preventDefault();
  event.stopPropagation();
  currentAppId = appId;
  
  const app = apps.find(a => a.id === appId);
  const favorites = getFavorites();
  const isFavorited = favorites.includes(appId);
  
  document.getElementById('favoriteText').textContent = isFavorited ? 'Unfavorite' : 'Favorite';
  document.querySelector('#appOptionsPopup .option-btn i').className = isFavorited ? 'fas fa-star' : 'far fa-star';
  
  document.getElementById('appOptionsPopup').classList.add('active');
}

function closeAppOptionsPopup() {
  document.getElementById('appOptionsPopup').classList.remove('active');
  currentAppId = null;
}

function toggleFavorite() {
  if (!currentAppId) return;
  
  const favorites = getFavorites();
  const index = favorites.indexOf(currentAppId);
  
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(currentAppId);
  }
  
  saveFavorites(favorites);
  closeAppOptionsPopup();
  filterItems();
}

function removeApp() {
  if (!currentAppId) return;
  
  const app = apps.find(a => a.id === currentAppId);
  if (!app) return;
  
  if (app.isCustom) {
    const customApps = getCustomApps();
    const filteredCustomApps = customApps.filter(a => a.id !== currentAppId);
    saveCustomApps(filteredCustomApps);
  }
  
  const hiddenApps = getHiddenApps();
  hiddenApps.push(currentAppId);
  saveHiddenApps(hiddenApps);
  
  apps = apps.filter(a => a.id !== currentAppId);
  
  const favorites = getFavorites();
  const favIndex = favorites.indexOf(currentAppId);
  if (favIndex > -1) {
    favorites.splice(favIndex, 1);
    saveFavorites(favorites);
  }
  
  closeAppOptionsPopup();
  filterItems();
}

function shareApp() {
  if (!currentAppId) return;
  
  const app = apps.find(a => a.id === currentAppId);
  if (!app) return;
  
  let shareUrl = app.url;
  
  if (!shareUrl.startsWith('http://') && !shareUrl.startsWith('https://')) {
    shareUrl = window.location.origin + shareUrl;
  }
  
  document.getElementById('shareLink').value = shareUrl;
  closeAppOptionsPopup();
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
  if (e.target.closest('.app-options')) {
    return;
  }
  
  const appItem = e.target.closest('.image-item');
  if (appItem) {
    const appLink = appItem.querySelector('.app-link');
    if (appLink) {
      e.preventDefault();
      window.location.href = appLink.getAttribute('data-url');
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadApps();
  
  document.getElementById('search-games').addEventListener('input', filterItems);
  
  document.getElementById('addAppPopup').addEventListener('click', (e) => {
    if (e.target.id === 'addAppPopup') {
      closeAddAppPopup();
    }
  });
  
  document.getElementById('appOptionsPopup').addEventListener('click', (e) => {
    if (e.target.id === 'appOptionsPopup') {
      closeAppOptionsPopup();
    }
  });
  
  document.getElementById('sharePopup').addEventListener('click', (e) => {
    if (e.target.id === 'sharePopup') {
      closeSharePopup();
    }
  });
  
  document.getElementById('appImage').addEventListener('change', (e) => {
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