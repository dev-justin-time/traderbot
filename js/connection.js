/* Connection viewport + simple agent chat (simulated peers + local sync hooks)
   - Renders agent list (reuses AGENTS if present on page; otherwise a small local set)
   - Provides Start/Stop connection toggles and simulated Websim room fallback via localBroadcast
   - Simple chat UI for messaging "agents" (local simulated responses)
*/

const agentsListEl = document.getElementById('agentsList');
const chatMessagesEl = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const connDot = document.getElementById('connDot');
const connLabel = document.getElementById('connLabel');
const startBtn = document.getElementById('startConn');
const stopBtn = document.getElementById('stopConn');

let AGENTS_LOCAL = [
  { id:'technical', name:'Technical Agent', status:'online'},
  { id:'sentiment', name:'Sentiment Agent', status:'online'},
  { id:'risk', name:'Risk Agent', status:'online'},
];

if (window.AGENTS && Array.isArray(window.AGENTS)) {
  AGENTS_LOCAL = window.AGENTS.map(a => ({ id: a.id, name: a.name, status: a.status || 'online' }));
}

let selectedAgent = AGENTS_LOCAL[0]?.id || null;
let connected = false;
let bc = null;

// render agents
function renderAgents(){
  agentsListEl.innerHTML = AGENTS_LOCAL.map(a => `
    <div class="agent-card ${selectedAgent===a.id ? 'active' : ''}" data-id="${a.id}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:700">${a.name}</div>
        <div style="font-size:12px;color:#9fb0d9">${a.status}</div>
      </div>
      <div style="font-size:12px;color:#9fb0d9">id: ${a.id}</div>
    </div>
  `).join('');
  agentsListEl.querySelectorAll('.agent-card').forEach(card=>{
    card.onclick = ()=> {
      selectedAgent = card.dataset.id;
      renderAgents();
      appendSystem(`Selected agent: ${selectedAgent}`);
    };
  });
}
renderAgents();

// chat helpers
function appendMessage(text, cls='agent'){
  const d = document.createElement('div');
  d.className = 'msg ' + (cls==='user' ? 'user' : 'agent');
  d.textContent = text;
  chatMessagesEl.appendChild(d);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function appendSystem(text){
  const d = document.createElement('div');
  d.className = 'msg agent';
  d.style.opacity = '0.75';
  d.style.fontStyle = 'italic';
  d.textContent = text;
  chatMessagesEl.appendChild(d);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// simulate an agent response
function simulateAgentResponse(agentId, message){
  setTimeout(()=>{
    const name = (AGENTS_LOCAL.find(a=>a.id===agentId)?.name) || agentId;
    const resp = `[${name}] Echo: ${message.slice(0,200)}`;
    appendMessage(resp, 'agent');
    // also broadcast to peers when connected
    if (connected && bc) {
      try { bc.postMessage({ type:'chat', agent: agentId, msg: resp, t: Date.now() }); } catch(e){}
    }
  }, 700 + Math.random()*700);
}

// broadcastchannel connection start/stop
function startConnection(){
  if (connected) return;
  try {
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('nexus-conn-room');
      bc.onmessage = (ev)=>{
        const data = ev.data;
        if (!data) return;
        if (data.type === 'chat' && data.agent && data.msg) {
          appendMessage(`[peer ${data.agent}] ${data.msg}`, 'agent');
        } else if (data.type === 'snapshot') {
          appendSystem(`Received snapshot from peer (${new Date(data.t).toLocaleTimeString()})`);
        }
      };
    }
    connected = true;
    connDot.className = 'dot online';
    connLabel.textContent = 'Connected (local)';
    appendSystem('Connection started (BroadcastChannel)');
    // announce presence
    if (bc) bc.postMessage({ type:'snapshot', t: Date.now(), info: 'hello' });
  } catch (e) {
    console.warn('startConnection failed', e);
    appendSystem('Connection start failed: ' + e.message);
  }
}

function stopConnection(){
  if (!connected) return;
  try {
    if (bc) { bc.close(); bc = null; }
  } catch(e){}
  connected = false;
  connDot.className = 'dot offline';
  connLabel.textContent = 'Disconnected';
  appendSystem('Connection stopped');
}

startBtn.onclick = startConnection;
stopBtn.onclick = stopConnection;

chatForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const txt = chatInput.value.trim();
  if(!txt) return;
  if(!selectedAgent){ appendSystem('Select an agent first'); return; }
  appendMessage(txt, 'user');
  chatInput.value = '';
  simulateAgentResponse(selectedAgent, txt);
});

// on load, show welcome
appendSystem('Connection viewport ready. Select an agent and send a message. Click Start Sync to enable peer broadcast.');