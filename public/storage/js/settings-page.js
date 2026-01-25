function exportLocalStorage() {
  const e = JSON.stringify(localStorage, null, 2),
    t = new Blob([e], { type: 'application/json' }),
    o = URL.createObjectURL(t),
    a = document.createElement('a');
  ((a.href = o), (a.download = 'localStorage-export.json'), a.click(), URL.revokeObjectURL(o));
}
function importLocalStorage() {
  const e = document.getElementById('fileInput').files[0];
  if (!e) return void alert('Please select a JSON file first.');
  const t = new FileReader();
  ((t.onload = function (e) {
    try {
      const t = JSON.parse(e.target.result);
      for (const e in t) localStorage.setItem(e, t[e]);
      alert('LocalStorage imported successfully');
    } catch (e) {
      alert('Failed to parse JSON: ' + e.message);
    }
  }),
    t.readAsText(e));
}
