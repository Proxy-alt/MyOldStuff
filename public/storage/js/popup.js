function showPopup(n, e = 'info') {
  const o = document.createElement('div');
  ((o.className = `styled-popup ${e}`),
    (o.innerHTML = `\n    <div class="popup-content">\n      <span class="popup-icon">${'success' === e ? '✓' : 'error' === e ? '✕' : 'ℹ'}</span>\n      <span class="popup-message">${n}</span>\n      <button class="popup-close" onclick="this.parentElement.parentElement.remove()">×</button>\n    </div>\n  `));
  const p = document.createElement('style');
  ((p.textContent =
    "\n    .styled-popup {\n      position: fixed;\n      top: 20px;\n      right: 20px;\n      z-index: 10000;\n      min-width: 300px;\n      max-width: 500px;\n      animation: slideIn 0.3s ease-out;\n      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n    }\n    @keyframes slideIn {\n      from {\n        transform: translateX(400px);\n        opacity: 0;\n      }\n      to {\n        transform: translateX(0);\n        opacity: 1;\n      }\n    }\n    .popup-content {\n      background: linear-gradient(135deg, #111117, #182129);\n      border: 1px solid rgba(255, 255, 255, 0.1);\n      border-radius: 12px;\n      padding: 16px 20px;\n      display: flex;\n      align-items: center;\n      gap: 12px;\n      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);\n      backdrop-filter: blur(10px);\n    }\n    .styled-popup.success .popup-content {\n      border-left: 4px solid #22c55e;\n    }\n    .styled-popup.error .popup-content {\n      border-left: 4px solid #ef4444;\n    }\n    .styled-popup.info .popup-content {\n      border-left: 4px solid #3b82f6;\n    }\n    .popup-icon {\n      width: 24px;\n      height: 24px;\n      border-radius: 50%;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      font-weight: bold;\n      font-size: 14px;\n      flex-shrink: 0;\n    }\n    .styled-popup.success .popup-icon {\n      background: rgba(34, 197, 94, 0.2);\n      color: #22c55e;\n    }\n    .styled-popup.error .popup-icon {\n      background: rgba(239, 68, 68, 0.2);\n      color: #ef4444;\n    }\n    .styled-popup.info .popup-icon {\n      background: rgba(59, 130, 246, 0.2);\n      color: #3b82f6;\n    }\n    .popup-message {\n      flex: 1;\n      color: #f8fafc;\n      font-size: 14px;\n      line-height: 1.5;\n    }\n    .popup-close {\n      background: transparent;\n      border: none;\n      color: #94a3b8;\n      font-size: 24px;\n      cursor: pointer;\n      padding: 0;\n      width: 24px;\n      height: 24px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      transition: color 0.2s;\n      flex-shrink: 0;\n    }\n    .popup-close:hover {\n      color: #f8fafc;\n    }\n  "),
    document.getElementById('popup-styles') || ((p.id = 'popup-styles'), document.head.appendChild(p)),
    document.body.appendChild(o),
    setTimeout(() => {
      ((o.style.animation = 'slideOut 0.3s ease-in'), setTimeout(() => o.remove(), 300));
    }, 5e3));
  const t = document.createElement('style');
  ((t.textContent =
    '\n    @keyframes slideOut {\n      from {\n        transform: translateX(0);\n        opacity: 1;\n      }\n      to {\n        transform: translateX(400px);\n        opacity: 0;\n      }\n    }\n  '),
    document.getElementById('popup-animations') || ((t.id = 'popup-animations'), document.head.appendChild(t)));
}
