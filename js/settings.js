const form = document.getElementById('settings-form');
const out = document.getElementById('settings-out');

function maskKey(k) {
  if(!k) return '';
  return k.length <= 8 ? '••••••••' : k.slice(0,4) + '•'.repeat(Math.max(4, k.length-8)) + k.slice(-4);
}

form?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  // Basic client-side validation for API key format (simple heuristic)
  if (data.apiKey && typeof data.apiKey === 'string') {
    const k = data.apiKey.trim();
    if (k.length < 8 || /[\s]/.test(k)) {
      out.textContent = 'Invalid API key format — please check and try again.';
      out.style.color = 'var(--danger)';
      return;
    }
    data.apiKey = k;
  }
  try {
    localStorage.setItem('trader_settings', JSON.stringify(data));
    out.style.color = '';
    out.textContent = `Saved settings. API Key: ${maskKey(data.apiKey)}`;
  } catch (err) {
    out.style.color = 'var(--danger)';
    out.textContent = 'Failed to save settings.';
    console.error('settings save failed', err);
  }
});

document.getElementById('clear-storage')?.addEventListener('click', ()=>{
  if (!confirm('Clear all local settings?')) return;
  // preserve unrelated local data lightly: only remove trader_settings and trader_load
  try {
    localStorage.removeItem('trader_settings');
    localStorage.removeItem('trader_load');
    document.getElementById('settings-out').textContent = 'Local data cleared.';
  } catch(e){
    document.getElementById('settings-out').textContent = 'Clear failed.';
    console.error(e);
  }
});