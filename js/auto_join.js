/*
  Auto-join / approved member helper
  - Adds a trusted agent entry for websim user ou812 (trader) into the local agent list
  - Auto-starts the connection BroadcastChannel on the connection page so agents auto-connect to room
  - Exposes window.nexusApprovedMembers for other modules
*/

(function () {
  // Trusted member metadata (websim profile)
  const APPROVED_MEMBER = {
    id: 'ou812',
    name: 'ou812 · trader',
    status: 'online',
    source: 'websim',
    profileUrl: 'https://websim.com/@ou812/trader'
  };

  // Expose approved members
  window.nexusApprovedMembers = window.nexusApprovedMembers || [];
  // ensure no duplicate
  if (!window.nexusApprovedMembers.find(m => m.id === APPROVED_MEMBER.id)) {
    window.nexusApprovedMembers.push(APPROVED_MEMBER);
  }

  // When connection UI exists, insert into AGENTS_LOCAL if present and update UI
  function injectApprovedAgent() {
    try {
      if (window.AGENTS && Array.isArray(window.AGENTS)) {
        if (!window.AGENTS.find(a => a.id === APPROVED_MEMBER.id)) {
          window.AGENTS.push(Object.assign({}, APPROVED_MEMBER));
        }
      }
      // connection.js uses AGENTS_LOCAL read at script-run; if it already ran, update DOM via its render function
      // try to update agentsList if present
      const agentsList = document.getElementById('agentsList');
      if (agentsList && typeof renderAgents === 'function') {
        // allow renderAgents to pick up global AGENTS (connection.js maps AGENTS to AGENTS_LOCAL)
        renderAgents();
      } else if (agentsList) {
        // simple append fallback
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.dataset.id = APPROVED_MEMBER.id;
        card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700">${APPROVED_MEMBER.name}</div>
          <div style="font-size:12px;color:#9fb0d9">${APPROVED_MEMBER.status}</div>
        </div>
        <div style="font-size:12px;color:#9fb0d9">id: ${APPROVED_MEMBER.id}</div>`;
        agentsList.prepend(card);
      }
    } catch (e) {
      console.warn('auto_join inject failed', e);
    }
  }

  // Auto-start connection: when startConn exists, invoke it after a short delay to allow other scripts to initialize.
  async function autoStartConnectionIfPresent() {
    try {
      // Delay to let connection.js bind handlers
      await new Promise(r => setTimeout(r, 350));
      const startBtn = document.getElementById('startConn');
      if (startBtn && typeof startBtn.onclick === 'function') {
        // If already connected (connDot shows online), avoid re-trigger
        const dot = document.getElementById('connDot');
        if (dot && dot.classList.contains('online')) return;
        startBtn.click();
      } else if (window.nexusSync && typeof window.nexusSync.start === 'function') {
        // If link_sync auto API exists, start sync for room in hash
        try { window.nexusSync.start(); } catch (e) {}
      }
    } catch (e) {
      console.warn('auto_join startConn failed', e);
    }
  }

  // On DOM ready, run injections and auto-start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectApprovedAgent();
      autoStartConnectionIfPresent();
    }, { once: true });
  } else {
    injectApprovedAgent();
    autoStartConnectionIfPresent();
  }

  // Provide a manual API
  window.__nexusAutoJoin = {
    approvedMember: APPROVED_MEMBER,
    inject: injectApprovedAgent,
    start: autoStartConnectionIfPresent
  };
})();