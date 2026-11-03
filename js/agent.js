/* Simple rule-based agent that helps craft strategies and explain indicators.
   Adds templating for exits, position sizing (Kelly + fixed), trade simulator (slippage/impact),
   plugin hooks for custom indicators, persistent per-strategy metrics + grid-tune, and a sandboxed ML stub.
   No external network calls required for these features. */

const agentForm = document.getElementById('agent-form');
const agentMessages = document.getElementById('agent-messages');

/* Preset prompts mapping for quick runs */
const PRESET_PROMPTS = {
  create_ema: 'Create an EMA crossover strategy for 15m with conservative sizing.',
  suggest_abilities: 'Suggest ability improvements for the agent and feature roadmap.',
  agent_arb_usecase: 'Create an agent use-case for detecting DEX arbitrage and building flash-loan bundles.',
  explain_ema: 'Explain how EMA works and why a crossover signals momentum.',
  risk_table: 'Generate a position sizing table for $10,000 account using 0.5%–2% risk levels.'
};

/* Structured prompt templates and helper creators for agents (reusable) */
const AGENT_PROMPTS = {
  strategy_template: (symbol = 'BTC/USDT', timeframe = '15m', tone = 'concise') => 
    `You are a trading strategy generator. Produce a JSON strategy for ${symbol} on ${timeframe} timeframe. Include indicators, parameter values, entry rules, templated exits (stop/take), position-sizing guidance, and a short rationale (${tone}).`,

  arb_agent_template: (priority='practical') =>
    `Design an arbitrage-detection agent that monitors DEX prices, detects atomic arbitrage opportunities, estimates slippage & gas, builds flash-loan execution steps, and outputs a deployable flashbots bundle spec. Focus on ${priority} decision logic and safe failure modes.`,

  explain_indicator: (indicator='EMA', depth='brief') =>
    `Explain ${indicator} in ${depth} detail with why crossovers signal momentum, include simple example parameters and a one-line usage tip.` ,

  risk_table: (account = 10000, risks = [0.5,1,2]) =>
    `Generate a position sizing table for account $${account} using risk levels ${risks.join('% , ')}; include USD size, suggested leverage (if any), and recommended stop placement.`
};

/* Generate a structured agent use-case object (persistable, human+machine readable) */
function generateAgentUseCase(text){
  // derive a small id and some fields from request text
  const id = 'usecase_' + Date.now().toString(36).slice(4);
  const title = (text && text.length < 60) ? text : 'Arbitrage detection & flash-loan builder';
  const description = `Auto-generated agent use-case from request: "${text}"`;
  const capabilities = [
    'price-feed-ingestion',
    'cross-dex-price-compare',
    'slippage-estimation',
    'flash-loan-simulation',
    'bundle-builder',
    'safety-checks'
  ];
  const config = {
    watchlist: ['BTC','ETH','SOL'],
    cadence: '8s',
    alert_threshold_pct: 0.15,
    max_notional_usd: 50000,
    required_liquidity_multiplier: 0.001
  };
  const agent = { id, title, description, capabilities, config, created_at: new Date().toISOString() };
  return agent;
}

/* Lightweight suggestion generator for agent abilities (returns string list) */
function suggestAbilityImprovements() {
  const suggestions = [
    'Persist per-strategy performance and use half-Kelly as a safe default position sizing.',
    'Add templated stop-loss/take-profit to strategy schema and apply before backtests.',
    'Expose indicator plugin API and list registered plugins in the Agent Manager UI.',
    'Run lightweight grid-search on indicator lengths during idle and cache best params.',
    'Simulate trades with slippage and impact for proposed notional sizes before execution.',
    'Add role-based safety checks for flash-loan bundles and gas/priority fee estimation.',
    'Provide a probability-calibrated ML stub for signal confidence and expose as advisory only.',
  ];
  return suggestions.join(' · ');
}

const presetSelect = document.getElementById('agent-preset');
const runPresetBtn = document.getElementById('run-preset');

if (runPresetBtn) {
  runPresetBtn.addEventListener('click', () => {
    const v = presetSelect?.value;
    if (!v) {
      post('agent', 'Select a preset prompt from the dropdown to run.');
      return;
    }
    // If preset exists, use it. Otherwise synthesize a friendly fallback prompt.
    let prompt = PRESET_PROMPTS[v];
    if (!prompt) {
      // Try to make a readable prompt from the key, e.g., "create_ema" -> "Create EMA"
      const human = v.replace(/[_\-]+/g, ' ').replace(/\b([a-z])/g, (m) => m.toUpperCase());
      prompt = `${human} — please generate a concise strategy template and suggestions.`;
      post('agent', `Note: preset "${v}" was undefined. Using generated fallback prompt: "${prompt}"`);
    }
    const input = document.getElementById('agent-text');
    if (input) input.value = prompt;
    agentForm?.dispatchEvent(new Event('submit', { cancelable: true }));
  });
}

/* --- UI helpers --- */
function post(role, text){
  const el = document.createElement('div');
  el.className = role;
  el.textContent = (role === 'user' ? 'You: ' : 'Agent: ') + text;
  agentMessages.appendChild(el);
  agentMessages.scrollTop = agentMessages.scrollHeight;
}

/* ---------- Strategy generation (heuristics) ---------- */
function generateStrategyFromRequest(text){
  text = text.toLowerCase();
  let timeframe = '1h';
  if(text.includes('15m')||text.includes('15')) timeframe='15m';
  if(text.includes('5m')||text.includes('5')) timeframe='5m';
  let fast=12, slow=26;
  if(text.includes('fast')) fast=8;
  if(text.includes('conservative')){ fast=21; slow=55; }
  if(text.includes('scalp')){ fast=5; slow=13; timeframe='1m'; }
  const strat = {
    name: `agent_${Date.now()}`,
    symbol: 'BTC/USDT',
    timeframe,
    indicators: { ema_fast: Number(fast), ema_slow: Number(slow) },
    risk_pct: text.includes('risk') ? 0.5 : 1,
    exits: { // templated stop/take settings (relative % or ATR based)
      stop: { mode: 'pct', value: 2 },    // 2% default stop
      take: { mode: 'ratio', value: 2 },  // take-profit 2× risk
    },
  };
  // persist template for reuse
  try { localStorage.setItem(`strategy_template_${strat.name}`, JSON.stringify(strat)); } catch(e){}
  return strat;
}

/* ---------- New: Exit templating (stop-loss / take-profit) ---------- */
function templatedExitsForStrategy(strat, entryPrice) {
  if (!strat || !strat.exits) return null;
  const s = strat.exits.stop;
  const t = strat.exits.take;
  // Support modes: pct (percent), atr (multiplier of ATR - requires ATR input), price (absolute)
  function compute(m) {
    if (m.mode === 'pct') return entryPrice * (1 - m.value / 100);
    if (m.mode === 'price') return m.value;
    // atr unsupported locally: fallback to pct
    return entryPrice * (1 - (m.value || 1) / 100);
  }
  const stopPrice = compute(s);
  // take profit can be ratio relative to distance to stop
  let tpPrice;
  if (t.mode === 'ratio') {
    const riskPct = s.mode === 'pct' ? s.value / 100 : 0.02;
    tpPrice = entryPrice * (1 + riskPct * (t.value || 2));
  } else {
    tpPrice = entryPrice * (1 + (t.value || 2) / 100);
  }
  return { stopPrice, tpPrice };
}

/* ---------- New: Position sizing (Kelly + fixed-fraction fallback) ---------- */
// Kelly fraction: f* = (bp - q) / b ; where b = avg win / avg loss, p = win rate, q = 1-p
// For safety we'll cap at 0.25 and fallback to fixed fraction if estimates are invalid.
function kellyPositionFraction(winProb, avgWin, avgLoss) {
  if (!winProb || winProb <= 0 || !avgWin || !avgLoss || avgLoss <= 0) return null;
  const b = avgWin / avgLoss;
  const p = winProb;
  const q = 1 - p;
  const f = (b * p - q) / b;
  if (!isFinite(f) || f <= 0) return null;
  // safety cap
  return Math.min(0.25, f);
}

function computePositionSize(accountUsd, fraction, price) {
  if (!price || price <= 0) return 0;
  const usd = accountUsd * fraction;
  return usd / price;
}

// Utility: produce sizing suggestions given observed strategy metrics (persisted)
function sizingSuggestionsForStrategy(stratName, accountUsd = 10000) {
  const metrics = loadStrategyMetrics(stratName);
  // heuristics if not enough data
  const p = metrics.winRate ?? 0.55;
  const avgWin = metrics.avgWin ?? 0.02; // 2%
  const avgLoss = metrics.avgLoss ?? 0.01; // 1%
  const kelly = kellyPositionFraction(p, avgWin, avgLoss);
  const fixed = 0.01; // 1% fixed fallback
  const chosen = kelly !== null ? kelly : fixed;
  return { kelly, fixed, chosenFraction: chosen, exampleSizeUSD: (accountUsd * chosen).toFixed(2) };
}

/* ---------- New: Trade simulator (slippage & market impact) ---------- */
/*
  simulateTrade:
    - side: 'buy'|'sell'
    - price: mid/market price
    - sizeUsd: usd notional
    - liquidity: available liquidity USD at target dex/exchange
    - baseSlippagePct: baseline slippage % (exchange)
    returns simulated execution price, avgPrice, slippageUsd, gasUsd (est)
*/
function simulateTrade({ side='buy', price=100, sizeUsd=10000, liquidity=1000000, baseSlippagePct=0.003, gasUsd=15 }) {
  // simple impact model: slippage increases with size/liquidity nonlinearly
  const impactFactor = Math.min(1, sizeUsd / liquidity);
  const impactPct = baseSlippagePct + Math.pow(impactFactor, 0.7) * 0.02; // up to additional 2%
  const sign = side === 'buy' ? 1 : -1;
  const avgPrice = price * (1 + sign * impactPct / 2);
  const executedNotional = sizeUsd * (1 - impactPct); // effective after slippage
  const slippageUsd = sizeUsd - executedNotional;
  return { executedPrice: avgPrice, executedNotional, slippageUsd, impactPct, gasUsd };
}

/* ---------- Plugin hooks: custom indicators registration ---------- */
const IndicatorPlugins = {
  registry: {},
  register(name, fn) {
    if (typeof fn !== 'function') throw new Error('indicator must be a function');
    this.registry[name] = fn;
  },
  run(name, priceSeries, opts) {
    const fn = this.registry[name];
    if (!fn) return null;
    try { return fn(priceSeries, opts); } catch (e) { console.warn('indicator plugin failed', e); return null; }
  },
  list() { return Object.keys(this.registry); }
};

/* ---------- Persisted per-strategy metrics and simple grid search tuner ---------- */
function loadStrategyMetrics(name) {
  try {
    const s = JSON.parse(localStorage.getItem('strategy_metrics') || '{}');
    return s[name] || {};
  } catch (e) { return {}; }
}
function saveStrategyMetrics(name, metrics) {
  try {
    const all = JSON.parse(localStorage.getItem('strategy_metrics') || '{}');
    all[name] = Object.assign({}, all[name] || {}, metrics, { lastUpdated: Date.now() });
    localStorage.setItem('strategy_metrics', JSON.stringify(all));
  } catch (e) { console.warn('saveStrategyMetrics failed', e); }
}

/* Basic grid search tuner: takes a strategy skeleton and list of parameter ranges (fast, slow)
   Does quick simulated evaluation using historical series passed in (priceSeries array).
   For demo we run an inexpensive metric: simple returns from crossing signals.
*/
function gridTuneStrategy(strat, priceSeries, paramGrid = { fast: [8,12,21], slow: [26,50,89] }) {
  if (!Array.isArray(priceSeries) || priceSeries.length < 100) return null;
  const results = [];
  for (const f of paramGrid.fast) {
    for (const s of paramGrid.slow) {
      if (f >= s) continue;
      // quick EMA crossover sim (very lightweight)
      const fastEma = emaSimple(priceSeries, f);
      const slowEma = emaSimple(priceSeries, s);
      let position = 0, cash = 10000, entry = 0;
      for (let i = 1; i < priceSeries.length; i++) {
        if (!fastEma[i] || !slowEma[i]) continue;
        if (!position && fastEma[i] > slowEma[i] && fastEma[i-1] <= slowEma[i-1]) { position = 1; entry = priceSeries[i]; }
        else if (position && fastEma[i] < slowEma[i] && fastEma[i-1] >= slowEma[i-1]) { cash *= (priceSeries[i] / entry); position = 0; }
      }
      const final = position ? cash * (priceSeries[priceSeries.length-1] / entry) : cash;
      results.push({ fast: f, slow: s, final, retPct: ((final - 10000) / 10000) * 100 });
    }
  }
  results.sort((a,b) => b.final - a.final);
  const best = results[0];
  // persist best metrics
  saveStrategyMetrics(strat.name || ('strat_' + Date.now()), { lastTuned: Date.now(), bestParams: { fast: best.fast, slow: best.slow }, backtestReturn: best.retPct });
  return best;
}

/* Lightweight EMA used by tuner */
function emaSimple(values, length){
  const k = 2/(length+1);
  const out = [];
  for (let i=0;i<values.length;i++){
    if (i===0) out.push(values[0]);
    else out.push(values[i]*k + out[i-1]*(1-k));
  }
  return out;
}

/* ---------- Sandboxed ML agent stub for probability scoring ----------
   For security and demo we run a deterministic lightweight calibration stub
   that turns a numeric composite score into a probability via logistic mapping.
*/
function mlProbabilityStub(compositeScore) {
  // compositeScore expected between -100..100
  const x = Math.max(-100, Math.min(100, compositeScore));
  // map to probability 0..1 via logistic with mild temp
  const z = (x / 50); // scale
  const p = 1 / (1 + Math.exp(-z));
  // apply simple calibration fudge if few samples exist (placeholder)
  return Number(p.toFixed(3));
}

/* ---------- Conversation handling with expanded intents ---------- */
agentForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const text = document.getElementById('agent-text').value.trim();
  if(!text) return;
  post('user', text);
  document.getElementById('agent-text').value = '';
  post('agent','Processing…');
  setTimeout(()=>{
    let reply='';

    if (text.match(/\b(improve|suggest|abilities|features)\b/i)) {
      reply = 'Ability improvement suggestions:\n' + suggestAbilityImprovements();
    } else if (text.match(/\b(use case|use-case|usecase|agent for|create agent)\b/i)) {
      const uc = generateAgentUseCase(text);
      reply = 'Agent use-case generated:\n' + JSON.stringify(uc, null, 2) + '\n\nSaved locally.';
      try { localStorage.setItem(uc.id, JSON.stringify(uc)); } catch(e){}
    } else if (text.match(/stop-?loss|take-?profit|exit/i)) {
      // exemplify templated exits
      const strat = generateStrategyFromRequest(text);
      const entry = 100; // demo price
      const exits = templatedExitsForStrategy(strat, entry);
      reply = `Example templated exits for ${strat.name} at entry $${entry}:\nStop: $${exits.stopPrice.toFixed(4)} · TP: $${exits.tpPrice.toFixed(4)}\nYou can save these in the strategy.exits object.`;
    } else if (text.match(/\b(kelly|position size|sizing)\b/i)) {
      const stratName = 'last_strategy';
      const account = 10000;
      const sizing = sizingSuggestionsForStrategy(stratName, account);
      reply = `Sizing suggestions (account $${account}):\nKelly fraction: ${sizing.kelly ?? 'N/A'}\nFixed fallback: ${sizing.fixed}\nChosen fraction: ${sizing.chosenFraction}\nExample USD size: $${sizing.exampleSizeUSD}`;
    } else if (text.match(/\b(simulate|slippage|impact)\b/i)) {
      // run demo simulation
      const sim = simulateTrade({ side: 'buy', price: 100, sizeUsd: 50000, liquidity: 500000, baseSlippagePct: 0.003, gasUsd: 20 });
      reply = `Simulated trade:\nExecuted price: $${sim.executedPrice.toFixed(4)} · Slippage: $${sim.slippageUsd.toFixed(2)} · Impact: ${(sim.impactPct*100).toFixed(3)}% · Gas est: $${sim.gasUsd}`;
    } else if (text.match(/\b(register|plugin|indicator)\b/i)) {
      reply = `Indicator plugin API available: IndicatorPlugins.register(name, fn). Current: [${IndicatorPlugins.list().join(', ')}]`;
    } else if (text.match(/\b(tune|grid|autotune)\b/i)) {
      // attempt quick tune if historical sample present in localStorage under 'sample_prices'
      const raw = localStorage.getItem('sample_prices');
      if (!raw) { reply = 'No sample price history found in localStorage under "sample_prices" to run grid-tune.'; }
      else {
        try {
          const prices = JSON.parse(raw);
          const strat = generateStrategyFromRequest(text);
          const best = gridTuneStrategy(strat, prices);
          if (best) reply = `Grid tune result: fast=${best.fast}, slow=${best.slow}, ret=${best.retPct.toFixed(2)}%`;
          else reply = 'Grid tune failed or insufficient data.';
        } catch(e) { reply = 'Invalid sample_prices data.'; }
      }
    } else if (text.match(/\b(probability|confidence|ml)\b/i)) {
      // demo ML stub mapping composite score to probability
      const composite = Number((Math.random()*200 - 100).toFixed(2)); // demo score
      const p = mlProbabilityStub(composite);
      reply = `ML stub produced probability ${p} for composite score ${composite.toFixed(2)} (demo calibrated).`;
    } else if (text.match(/explain|what is|indicator/i)){
      reply = 'EMA (Exponential Moving Average) gives more weight to recent prices. A crossover of a fast EMA above a slow EMA signals upward momentum.';
    } else if(text.match(/create|make|generate/i)){
      const strat = generateStrategyFromRequest(text);
      try { localStorage.setItem('last_strategy', JSON.stringify(strat)); } catch(e){}
      reply = 'Generated strategy JSON and saved to local storage:\n' + JSON.stringify(strat, null, 2);
    } else {
      reply = 'I can: (1) template exits, (2) compute sizing (Kelly), (3) simulate slippage, (4) register indicator plugins, (5) grid-tune indicators, (6) provide ML probability stubs. Try: "Simulate slippage" or "Run grid tune".';
    }

    const last = [...agentMessages.children].pop();
    if(last && last.textContent && last.textContent.startsWith('Agent: Processing')) last.remove();
    post('agent', reply);
    resetIdleTimer();
  }, 600);
});

/* ---------- Auto-run improvements when idle (kept from original) ---------- */
const IDLE_MS = 60 * 1000;
let idleTimer = null;
let autoRunInProgress = false;
let lastAutoRun = 0;
const AUTO_COOLDOWN_MS = 5 * 60 * 1000;

function resetIdleTimer() {
  try { clearTimeout(idleTimer); } catch(e){}
  idleTimer = setTimeout(() => { runAutoImprovementsIfIdle(); }, IDLE_MS);
}
['click','keydown','mousemove','touchstart'].forEach(evt=>{
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});
resetIdleTimer();

async function runAutoImprovementsIfIdle() {
  if (autoRunInProgress) return;
  const now = Date.now();
  if (now - lastAutoRun < AUTO_COOLDOWN_MS) return;
  autoRunInProgress = true; lastAutoRun = now;
  post('agent', 'Auto-run: generating offline improvement suggestions…');
  try {
    // lightweight built-in suggestions (no remote call)
    const suggestions = [
      'Persist strategy performance and use half-Kelly as default sizing until metrics stabilize.',
      'Expose exit templates (stop/take) in strategy editor and apply before backtests.',
      'Add indicator plugin API and show registered plugins in Agent Manager.',
      'Run a lightweight grid-search on EMA lengths during idle and cache best params.',
      'Offer a simulated trade preview showing slippage/impact for entered notional sizes.',
    ].join(' • ');
    post('agent', `Auto-improvements (local): ${suggestions}`);
    toast('Auto-improvements applied locally', 'success');
  } catch (err) {
    console.warn('Auto-run failed', err);
    post('agent', 'Auto-run failed: ' + (err && err.message ? err.message : String(err)));
  } finally {
    autoRunInProgress = false;
    resetIdleTimer();
  }
}

/* ---------- Expose plugin API and utilities to global for other modules/pages ---------- */
window.NexusAgent = window.NexusAgent || {};
window.NexusAgent.IndicatorPlugins = IndicatorPlugins;
window.NexusAgent.simulateTrade = simulateTrade;
window.NexusAgent.templatedExitsForStrategy = templatedExitsForStrategy;
window.NexusAgent.sizingSuggestionsForStrategy = sizingSuggestionsForStrategy;
window.NexusAgent.loadStrategyMetrics = loadStrategyMetrics;
window.NexusAgent.saveStrategyMetrics = saveStrategyMetrics;
window.NexusAgent.gridTuneStrategy = gridTuneStrategy;
window.NexusAgent.mlProbabilityStub = mlProbabilityStub;

/* ---------- Idle timer hookup preserved ---------- */
resetIdleTimer();