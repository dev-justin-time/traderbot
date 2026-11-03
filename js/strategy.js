const form = document.getElementById('strategy-form');
const out = document.getElementById('strategy-output');

function buildStrategy(data){
  // minimal normalized strategy JSON
  return {
    name: data.name || 'unnamed',
    symbol: data.symbol || 'BTC/USDT',
    timeframe: data.timeframe || '1h',
    indicators: { ema_fast: Number(data.fast||12), ema_slow: Number(data.slow||26) },
    risk_pct: Number(data.risk||1)
  };
}

form?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(form).entries());
  const strat = buildStrategy(fd);
  localStorage.setItem('last_strategy', JSON.stringify(strat));
  out.textContent = JSON.stringify(strat, null, 2);
});

document.getElementById('export-strat')?.addEventListener('click', ()=>{
  const s = localStorage.getItem('last_strategy') || '{}';
  const blob = new Blob([s], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'strategy.json'; a.click();
  URL.revokeObjectURL(url);
});