/* Simple live simulation using the same EMA crossover applied to a streaming random walk */
let timer=null;
let prices=[];
let position=0;
let entry=0;

const tickEl = document.getElementById('tick');
const posEl = document.getElementById('position');

function ema(values,length){
  const k=2/(length+1); let arr=[];
  values.forEach((v,i)=> arr.push(i? v*k + arr[i-1]*(1-k) : v));
  return arr;
}

document.getElementById('start-sim')?.addEventListener('click', ()=>{
  if(timer) return;
  const raw = document.getElementById('live-strat').value.trim();
  let strat;
  try{ strat = raw ? JSON.parse(raw) : JSON.parse(localStorage.getItem('last_strategy')||'{}'); }
  catch{ strat = {indicators:{ema_fast:12,ema_slow:26}}; }
  const fast = strat.indicators?.ema_fast || 12;
  const slow = strat.indicators?.ema_slow || 26;

  prices = [50000 + (Math.random()-0.5)*1000];
  position = 0; entry = 0;
  posEl.textContent = 'Flat';
  timer = setInterval(()=>{
    const last = prices[prices.length-1];
    const next = Math.max(1, last * (1 + (Math.random()-0.5)*0.004));
    prices.push(next);
    if(prices.length > Math.max(200, slow+10)) prices.shift();
    const ef = ema(prices, fast), es = ema(prices, slow);
    const i = prices.length-1;
    tickEl.textContent = next.toFixed(2);
    // crossover logic
    if(!position && ef[i] > es[i] && ef[i-1] <= es[i-1]){ position=1; entry=next; posEl.textContent = `Long @ ${entry.toFixed(2)}`; }
    else if(position && ef[i] < es[i] && ef[i-1] >= es[i-1]){ const pnl = (next-entry)/entry*100; posEl.textContent = `Flat (closed ${pnl.toFixed(2)}%)`; position=0; entry=0; }
  }, 400);
});

document.getElementById('stop-sim')?.addEventListener('click', ()=>{
  if(timer){ clearInterval(timer); timer=null; posEl.textContent='Stopped'; }
});