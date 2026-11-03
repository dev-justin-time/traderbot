/*
  room.js
  - Join a shared room (fixed hash "2yvnl60b"), prefer WebsimSocket when available, fallback to BroadcastChannel.
  - Exchange lightweight snapshots and chat messages; includes simple agent support (agent list, routing).
  - Exposes window.roomModule API: start(), stop(), sendChat(msg, agentId), sendSnapshot(), isActive()
*/

(function () {
  const ROOM_HASH = '2yvnl60b';
  const CHANNEL = `nexus-room-${ROOM_HASH}`;
  let usingWebsim = false;
  let wsRoom = null;
  let bc = null;
  let stopped = true;
  let heartbeat = null;

  // simple agent registry (can be extended)
  const AGENTS = [
    { id: 'technical', name: 'Technical Agent' },
    { id: 'sentiment', name: 'Sentiment Agent' },
    { id: 'risk', name: 'Risk Agent' },
  ];

  function now() { return Date.now(); }

  function snapshotState() {
    // attempt to read nexus_ultimate_state from localStorage to include useful info
    let s = {};
    try { s = JSON.parse(localStorage.getItem('nexus_ultimate_state') || '{}'); } catch (e) {}
    return { t: now(), id: `${Math.random().toString(36).slice(2,10)}@${location.hostname}`, snapshot: { cash: s.cash, trades: s.trades?.slice?.(-50), bundles: s.bundles?.slice?.(-20) } };
  }

  function applySnapshot(payload) {
    if (!payload || !payload.snapshot) return;
    try {
      // merge trades/bundles into local stored state conservatively
      const cur = JSON.parse(localStorage.getItem('nexus_ultimate_state') || '{}');
      cur.trades = Array.isArray(cur.trades) ? cur.trades : [];
      cur.bundles = Array.isArray(cur.bundles) ? cur.bundles : [];
      if (Array.isArray(payload.snapshot.trades)) {
        // append non-duplicate by time
        const existingTimes = new Set(cur.trades.map(t => t.time));
        payload.snapshot.trades.forEach(t => { if (!existingTimes.has(t.time)) cur.trades.unshift(t); });
        cur.trades = cur.trades.slice(0, 500);
      }
      if (Array.isArray(payload.snapshot.bundles)) {
        const existingIds = new Set(cur.bundles.map(b => b.id));
        payload.snapshot.bundles.forEach(b => { if (!existingIds.has(b.id)) cur.bundles.unshift(b); });
        cur.bundles = cur.bundles.slice(0, 200);
      }
      cur.savedAt = now();
      localStorage.setItem('nexus_ultimate_state', JSON.stringify(cur));
      // try to trigger UI refresh if available
      if (typeof renderAll === 'function') try { renderAll(); } catch (e) {}
    } catch (e) {
      console.warn('room.applySnapshot failed', e);
    }
  }

  function handleIncoming(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'snapshot':
        applySnapshot(msg.payload);
        break;
      case 'chat':
        // deliver to any in-page listeners via custom event
        window.dispatchEvent(new CustomEvent('nexus-room-chat', { detail: msg.payload }));
        break;
      case 'request_snapshot':
        // peer requests snapshot; reply
        send({ type: 'snapshot', payload: snapshotState() });
        break;
      default:
        console.debug('room: unknown msg', msg);
    }
  }

  async function startWebsim() {
    if (typeof WebsimSocket === 'undefined') return false;
    try {
      const room = new WebsimSocket();
      await room.initialize();
      room.onmessage = (ev) => {
        const data = ev.data;
        if (!data) return;
        if (data.channel !== CHANNEL) return;
        handleIncoming(data);
      };
      wsRoom = room;
      usingWebsim = true;
      return true;
    } catch (e) {
      console.warn('room.startWebsim failed', e);
      usingWebsim = false;
      wsRoom = null;
      return false;
    }
  }

  function stopWebsim() {
    try { if (wsRoom) wsRoom.onmessage = null; } catch (e) {}
    wsRoom = null; usingWebsim = false;
  }

  function startBC() {
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel(CHANNEL);
        bc.onmessage = (ev) => { handleIncoming(ev.data); };
      } else {
        bc = null;
      }
      // also listen storage events for cross-tab fallback
      window.addEventListener('storage', storageListener);
      return true;
    } catch (e) {
      console.warn('room.startBC failed', e);
      bc = null;
      return false;
    }
  }

  function stopBC() {
    try { if (bc) { bc.close(); bc = null; } } catch (e) {}
    window.removeEventListener('storage', storageListener);
  }

  function storageListener(ev) {
    try {
      if (!ev.key || !ev.newValue) return;
      if (!ev.key.startsWith(`nexus-room-${ROOM_HASH}-`)) return;
      const parsed = JSON.parse(ev.newValue);
      handleIncoming(parsed);
    } catch (e) { /* ignore */ }
  }

  function send(msg) {
    if (stopped) return;
    msg = Object.assign({}, msg, { channel: CHANNEL, meta: { t: now(), from: location.hostname } });
    try {
      if (usingWebsim && wsRoom) { wsRoom.send(msg); return; }
    } catch (e) { console.warn('room.send websim failed', e); }
    // fallback: BroadcastChannel
    try {
      if (bc) { bc.postMessage(msg); }
      // also write to localStorage as ephemeral key to notify other tabs
      const key = `nexus-room-${ROOM_HASH}-msg`;
      localStorage.setItem(key, JSON.stringify(msg));
      // cleanup quickly
      setTimeout(() => { try { localStorage.removeItem(key); } catch (e) {} }, 700);
    } catch (e) { console.warn('room.send fallback failed', e); }
  }

  // public helpers
  function sendChat(text, agentId = null) {
    const payload = { text, agentId, t: now(), id: Math.random().toString(36).slice(2,10) };
    // dispatch locally for immediate UI update
    window.dispatchEvent(new CustomEvent('nexus-room-chat', { detail: payload }));
    send({ type: 'chat', payload });
    // simulate optional agent auto-response locally if agentId provided
    if (agentId) {
      setTimeout(() => {
        const agent = AGENTS.find(a => a.id === agentId) || { id: agentId, name: agentId };
        const resp = { text: `[${agent.name}] Echo: ${text.slice(0,200)}`, agentId: agent.id, t: now(), id: 'resp-' + Math.random().toString(36).slice(2,8) };
        window.dispatchEvent(new CustomEvent('nexus-room-chat', { detail: resp }));
        send({ type: 'chat', payload: resp });
      }, 600 + Math.random() * 800);
    }
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    (async () => {
      const ok = await startWebsim();
      if (!ok) startBC();
      // announce presence and request snapshots
      send({ type: 'request_snapshot', payload: { t: now(), id: location.hostname } });
      send({ type: 'snapshot', payload: snapshotState() });
      heartbeat = setInterval(() => {
        send({ type: 'snapshot', payload: snapshotState() });
      }, 30 * 1000);
    })();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    stopWebsim();
    stopBC();
    try { clearInterval(heartbeat); } catch (e) {}
    heartbeat = null;
  }

  // expose API
  window.roomModule = window.roomModule || {};
  window.roomModule.start = start;
  window.roomModule.stop = stop;
  window.roomModule.sendChat = sendChat;
  window.roomModule.sendSnapshot = () => send({ type: 'snapshot', payload: snapshotState() });
  window.roomModule.isActive = () => !stopped;
  window.roomModule.agents = AGENTS;
  window.roomModule.roomHash = ROOM_HASH;

  // auto-start when the page hash matches the room or when explicitly requested
  try {
    const curHash = location.hash.replace(/^#/, '');
    if (curHash === ROOM_HASH) start();
  } catch (e) {}

})();