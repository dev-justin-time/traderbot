/*
  Link-to-sibling sync (hash-key based) — enhanced
  - Uses Websim multiplayer (WebsimSocket) when available to join a room based on the URL hash.
  - Falls back to BroadcastChannel / localStorage sync (existing behavior).
  - Exchanges lightweight snapshots (prices, trades, priceLog, bundles) and merges safely into local storage.
  - Exposes window.nexusSync.start()/stop() and window.nexusSync.sendSnapshot().
*/

(function () {
  const RAW_KEY_PREFIX = 'nexus_ultimate_state';
  const SYNC_PREFIX = 'nexus_sync_snapshot_';
  const params = (() => {
    try {
      const h = location.hash || '';
      const obj = {};
      h.replace(/^#/, '').split('&').forEach(pair => {
        if (!pair) return;
        const [k,v] = pair.split('=');
        obj[k] = v;
      });
      return obj;
    } catch (e) { return {}; }
  })();

  const roomKey = params.room || params.r || (location.hash && location.hash.replace(/^#/, '')) || null;
  const channelName = roomKey ? `nexus-sync-${roomKey}` : null;

  // simple helpers
  function now() { return Date.now(); }
  function readLocalState() { try { return JSON.parse(localStorage.getItem(RAW_KEY_PREFIX) || '{}'); } catch(e){ return {}; } }
  function writeLocalState(o){ try{ localStorage.setItem(RAW_KEY_PREFIX, JSON.stringify(o)); }catch(e){} }

  function snapshotState() {
    const s = readLocalState();
    return {
      t: now(),
      id: `${Math.random().toString(36).slice(2,10)}@${location.hostname}`,
      cash: s.cash ?? undefined,
      trades: s.trades ?? undefined,
      bundles: s.bundles ?? undefined,
      priceLog: (s.priceLog && s.priceLog.slice(-200)) || undefined,
    };
  }

  function mergeArraysUnique(dest = [], incoming = [], key = 'id', timeKey = 'time') {
    if (!Array.isArray(incoming) || incoming.length === 0) return dest;
    const map = new Map();
    dest.forEach(it => {
      const k = it[key] ?? (it[timeKey] ?? JSON.stringify(it));
      map.set(k, it);
    });
    incoming.forEach(it => {
      const k = it[key] ?? (it[timeKey] ?? JSON.stringify(it));
      if (!map.has(k)) map.set(k, it);
      else {
        const existing = map.get(k);
        if (it[timeKey] && existing[timeKey] && it[timeKey] > existing[timeKey]) map.set(k, it);
      }
    });
    return Array.from(map.values()).slice(-5000);
  }

  function applySnapshot(snap) {
    if (!snap || typeof snap !== 'object') return;
    const cur = readLocalState();
    let changed = false;

    if (typeof snap.cash === 'number' && (cur.cash === undefined || snap.t > (cur.savedAt || 0))) {
      cur.cash = snap.cash; changed = true;
    }
    if (Array.isArray(snap.trades)) { cur.trades = mergeArraysUnique(cur.trades || [], snap.trades, null, 'time'); changed = true; }
    if (Array.isArray(snap.bundles)) { cur.bundles = mergeArraysUnique(cur.bundles || [], snap.bundles, 'id', 'time'); changed = true; }
    if (Array.isArray(snap.priceLog)) {
      cur.priceLog = mergeArraysUnique(cur.priceLog || [], snap.priceLog.map(p => ({ ...p, time: p.t || p.time || now() })), null, 'time');
      changed = true;
    }
    if (changed) {
      cur.savedAt = now();
      try { localStorage.setItem(RAW_KEY_PREFIX, JSON.stringify(cur)); } catch (e) { console.warn('nexusSync write failed', e); }
      try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
    }
  }

  // messaging layer: tries WebsimSocket first, then BroadcastChannel/localStorage fallback
  let usingWebsim = false;
  let wsRoom = null;
  let bc = null;
  let stopped = false;
  let localListener = null;
  let heartbeat = null;

  async function startWebsim(roomName) {
    if (!roomName) return false;
    try {
      if (typeof WebsimSocket === 'undefined') return false;
      const room = new WebsimSocket(); // global provided by websim environment
      await room.initialize();
      // join a logical room by sending an ephemeral "join" event with a channel tag
      // we piggyback on send/receive: listeners get all events
      room.onmessage = (ev) => {
        const data = ev.data;
        if (!data) return;
        // only accept messages tagged with our channel to avoid collisions
        if (data.channel !== roomName) return;
        if (data.type === 'snapshot' && data.payload) applySnapshot(data.payload);
        if (data.type === 'request_snapshot') {
          room.send({ channel: roomName, type: 'snapshot', payload: snapshotState() });
        }
      };
      // Ask peers for their snapshot
      room.send({ channel: roomName, type: 'request_snapshot', payload: { t: now(), id: 'who-wants-snapshot' } });
      // store room to allow sending later
      wsRoom = room;
      usingWebsim = true;
      return true;
    } catch (e) {
      console.warn('nexusSync websim start failed', e);
      usingWebsim = false;
      wsRoom = null;
      return false;
    }
  }

  function stopWebsim() {
    try {
      if (wsRoom && typeof wsRoom.onmessage !== 'undefined') wsRoom.onmessage = null;
    } catch (e) {}
    wsRoom = null;
    usingWebsim = false;
  }

  // fallback messaging: broadcastchannel + localStorage event
  function startFallback(chName) {
    if ('BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(chName);
        bc.onmessage = (ev) => { try{ onMessageReceived(ev.data); }catch(e){console.warn(e);} };
      } catch (e) { bc = null; }
    }
    localListener = function (ev) {
      try {
        if (!ev.key) return;
        if (ev.key === SYNC_PREFIX + chName && ev.newValue) {
          const parsed = JSON.parse(ev.newValue);
          if (parsed && parsed.msg) onMessageReceived(parsed.msg);
        }
      } catch (e) { console.warn('nexusSync fallback parse failed', e); }
    };
    window.addEventListener('storage', localListener);
    // same-tab custom event
    window.addEventListener('nexus-sync-local-' + chName, () => {
      const key = SYNC_PREFIX + chName;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.msg) onMessageReceived(parsed.msg);
      } catch (e) { console.warn('nexusSync parse local event', e); }
    });
  }

  function stopFallback(chName) {
    try { if (bc) { bc.close(); bc = null; } } catch (e) {}
    try { if (localListener) window.removeEventListener('storage', localListener); } catch(e){}
  }

  function onMessageReceived(msg) {
    if (!msg) return;
    const type = msg.type || 'snapshot';
    if (type === 'snapshot') {
      if (!msg.payload || !msg.payload.t) return;
      applySnapshot(msg.payload);
    } else if (type === 'request_snapshot') {
      // reply via active channel
      sendMessage({ type: 'snapshot', payload: snapshotState() });
    } else if (type === 'ping') {
      sendMessage({ type: 'pong', payload: { t: now(), id: msg.payload?.id || null } });
    }
  }

  function sendMessage(msg) {
    if (stopped) return;
    msg = msg || {};
    // prefer websim room if active
    if (usingWebsim && wsRoom) {
      try { wsRoom.send(Object.assign({}, msg, { channel: channelName })); return; } catch (e) { console.warn('nexusSync websim send failed', e); }
    }
    // fallback: broadcast/localStorage
    if (bc) {
      try { bc.postMessage(msg); } catch(e){ console.warn('nexusSync bc post failed', e); }
    }
    try {
      const key = SYNC_PREFIX + channelName;
      const payload = JSON.stringify({ msg, t: now() });
      localStorage.setItem(key, payload);
      window.dispatchEvent(new Event('nexus-sync-local-' + channelName));
      setTimeout(() => { try { localStorage.removeItem(key); } catch (e) {} }, 600);
    } catch (e) { console.warn('nexusSync fallback write failed', e); }
  }

  async function start() {
    if (!channelName) {
      window.nexusSync = window.nexusSync || {};
      window.nexusSync.start = () => {};
      window.nexusSync.stop = () => {};
      return;
    }
    stopped = false;
    // try Websim first
    const ok = await startWebsim(channelName);
    if (!ok) startFallback(channelName);
    // send initial request and snapshot
    sendMessage({ type: 'request_snapshot', payload: { t: now(), id: 'who-wants-snapshot' } });
    setTimeout(() => sendMessage({ type: 'snapshot', payload: snapshotState() }), 300);
    // heartbeat
    heartbeat = setInterval(() => { sendMessage({ type: 'snapshot', payload: snapshotState() }); }, 30*1000);
  }

  function stop() {
    stopped = true;
    stopWebsim();
    stopFallback(channelName);
    try { clearInterval(heartbeat); } catch(e){}
    heartbeat = null;
  }

  // expose API
  window.nexusSync = window.nexusSync || {};
  window.nexusSync.start = start;
  window.nexusSync.stop = stop;
  window.nexusSync.active = () => !stopped && (usingWebsim || !!bc);
  window.nexusSync.channel = channelName;
  window.nexusSync.sendSnapshot = () => sendMessage({ type: 'snapshot', payload: snapshotState() });

  // auto-start only if a room key exists
  if (channelName) {
    try { start(); } catch (e) { console.warn('nexusSync auto-start failed', e); }
  } else {
    // define no-op controls
    window.nexusSync.start = () => {};
    window.nexusSync.stop = () => {};
  }

})();