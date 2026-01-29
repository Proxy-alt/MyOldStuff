document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-games').addEventListener('input', function () {
    const e = document.getElementById('search-games').value.toLowerCase();
    document.querySelectorAll('.image-item').forEach((t) => {
      const n = t.dataset.label.toLowerCase();
      t.style.display = n.includes(e) ? '' : 'none';
    });
  });
});
