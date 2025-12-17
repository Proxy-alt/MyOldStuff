function showPopup(message, type = 'info') {
  const popup = document.createElement('div');
  popup.className = `styled-popup ${type}`;
  popup.innerHTML = `
    <div class="popup-content">
      <span class="popup-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="popup-message">${message}</span>
      <button class="popup-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .styled-popup {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      min-width: 300px;
      max-width: 500px;
      animation: slideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .popup-content {
      background: linear-gradient(135deg, #111117, #182129);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
    }
    .styled-popup.success .popup-content {
      border-left: 4px solid #22c55e;
    }
    .styled-popup.error .popup-content {
      border-left: 4px solid #ef4444;
    }
    .styled-popup.info .popup-content {
      border-left: 4px solid #3b82f6;
    }
    .popup-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      flex-shrink: 0;
    }
    .styled-popup.success .popup-icon {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .styled-popup.error .popup-icon {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .styled-popup.info .popup-icon {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }
    .popup-message {
      flex: 1;
      color: #f8fafc;
      font-size: 14px;
      line-height: 1.5;
    }
    .popup-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
      flex-shrink: 0;
    }
    .popup-close:hover {
      color: #f8fafc;
    }
  `;

  if (!document.getElementById('popup-styles')) {
    style.id = 'popup-styles';
    document.head.appendChild(style);
  }

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => popup.remove(), 300);
  }, 5000);

  const slideOutStyle = document.createElement('style');
  slideOutStyle.textContent = `
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  if (!document.getElementById('popup-animations')) {
    slideOutStyle.id = 'popup-animations';
    document.head.appendChild(slideOutStyle);
  }
}
