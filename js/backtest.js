/* Simple backtester that uses EMA crossover on generated synthetic price series */
function genPrices(n=500, start=50000){
  const arr=[start];
  for(let i=1;i<n;i++){
    const last=arr[i-1];
    const change=(Math.random()-0.5)*0.02; // small random walk
    arr.push(Math.max(1, last*(1+change)));
  }
  return arr;
}

function ema(values, length){
  const k = 2/(length+1);
  let emaArr = [];
  values.forEach((v,i)=>{
    if(i===0) emaArr.push(v);
    else emaArr.push(v*k + emaArr[i-1]*(1-k));
  });
  return emaArr;
}

document.getElementById('run-backtest')?.addEventListener('click', ()=>{
  const raw = document.getElementById('bt-strat').value.trim();
  let strat;
  try{ strat = raw ? JSON.parse(raw) : JSON.parse(localStorage.getItem('last_strategy')||'{}'); }
  catch(e){ document.getElementById('bt-results').textContent = 'Invalid strategy JSON'; return; }

  const period = Number(document.getElementById('bt-period').value||500);
  const prices = genPrices(period, 50000);
  const fast = strat.indicators?.ema_fast || strat.fast || 12;
  const slow = strat.indicators?.ema_slow || strat.slow || 26;
  const emaF = ema(prices, fast);
  const emaS = ema(prices, slow);

  let position = 0; // 0 flat, 1 long
  let entryPrice = 0;
  let trades = [];
  for(let i=1;i<prices.length;i++){
    if(!position && emaF[i] > emaS[i] && emaF[i-1] <= emaS[i-1]){
      position = 1; entryPrice = prices[i]; trades.push({side:'buy', price:entryPrice, index:i});
    } else if(position && emaF[i] < emaS[i] && emaF[i-1] >= emaS[i-1]){
      position = 0; const exit=prices[i]; trades.push({side:'sell', price:exit, entry:entryPrice, pnl: (exit-entryPrice)/entryPrice, index:i});
    }
  }

  const closed = trades.filter(t=>t.side==='sell');
  const wins = closed.filter(t=>t.pnl>0).length;
  const loss = closed.length - wins;
  const totalPnL = closed.reduce((s,t)=>s + (t.pnl||0), 0);
  const out = {
    strategy: strat.name || 'ema',
    trades: closed.length,
    wins, loss,
    total_return_pct: +(totalPnL*100).toFixed(2)
  };
  document.getElementById('bt-results').textContent = JSON.stringify(out,null,2);
});