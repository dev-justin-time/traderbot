/* small enhancements for home page */
const cards = document.querySelectorAll('.card');
cards.forEach(c=>c.addEventListener('click', ()=>{ c.classList.add('clicked'); }));

/* Add Node: prompt for sibling room/hash and attempt to start sync */
document.getElementById('addNodeBtn')?.addEventListener('click', async () => {
  try {
    const room = prompt('Enter sibling room key or hash to connect (leave out #):');
    if (!room) return;
    // Update URL hash for link_sync to pick up (non-destructive)
    if (location.hash.replace(/^#/, '') !== room) {
      history.replaceState(null, '', location.pathname + '#' + room);
    }
    // If nexusSync exists (from link_sync.js), start it
    if (window.nexusSync && typeof window.nexusSync.start === 'function') {
      try {
        await window.nexusSync.start();
        alert('Attempting to connect to room: ' + room);
      } catch (err) {
        console.warn('nexusSync.start failed', err);
        alert('Started with hash set; nexusSync.start failed (see console).');
      }
    } else {
      alert('Room hash set. Open the Connection page to join the room.');
    }
  } catch (e) {
    console.warn('addNodeBtn handler error', e);
  }
});

/* Copy Hash button behavior: shows current hash and copies it to clipboard (creates one if none) */
document.getElementById('copyHashBtn')?.addEventListener('click', async () => {
  try {
    // If no hash present, generate a short random room id and set it (non-destructive)
    let room = location.hash.replace(/^#/, '');
    if (!room) {
      room = Math.random().toString(36).slice(2, 10);
      history.replaceState(null, '', location.pathname + '#' + room);
    }
    // Copy to clipboard
    await navigator.clipboard.writeText(room);
    // Provide quick feedback
    const btn = document.getElementById('copyHashBtn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = '# Copy Hash'; }, 1400);
    alert('Room hash copied to clipboard: ' + room);
  } catch (err) {
    console.warn('copyHashBtn failed', err);
    alert('Failed to copy hash: ' + (err && err.message ? err.message : String(err)));
  }
});

/* Display/update current room hash in header */
function updateRoomHashDisplay() {
  try {
    const el = document.getElementById('roomHashDisplay');
    if (!el) return;
    let room = location.hash.replace(/^#/, '');
    if (!room || room.trim() === '') {
      el.textContent = '#—';
      return;
    }
    el.textContent = '#' + room;
  } catch (e) {
    console.warn('updateRoomHashDisplay error', e);
  }
}

// initialize on load
updateRoomHashDisplay();

// ensure display updates when user adds/changes hash via Add Node
const originalAddNode = document.getElementById('addNodeBtn')?.onclick;
document.getElementById('addNodeBtn')?.addEventListener('click', async (ev) => {
  // allow existing handler to run (it already sets the hash)
  try {
    if (originalAddNode) await originalAddNode(ev);
  } catch (e) {}
  // reflect new hash
  setTimeout(updateRoomHashDisplay, 50);
});

// update display when copyHashBtn generates/sets a new room id
const copyBtn = document.getElementById('copyHashBtn');
if (copyBtn) {
  const originalCopy = copyBtn.onclick;
  copyBtn.addEventListener('click', async (ev) => {
    try {
      if (originalCopy) await originalCopy(ev);
    } catch (e) {}
    setTimeout(updateRoomHashDisplay, 50);
  });
}

// Also update if hash changes from elsewhere (back/forward or manual)
window.addEventListener('hashchange', updateRoomHashDisplay);

/* -------------------------
   WalletConnect integration
   - Uses WalletConnect Provider (v1 compatibility) from esm.sh
   - Adds Connect / Disconnect and displays connected address
   - If injected wallet available (MetaMask), prefers it and still shows address
   ------------------------- */

let web3Provider = null;
let wcProvider = null;
let currentAddress = null;

async function shortAddr(a){
  if(!a) return '—';
  return a.slice(0,6) + '…' + a.slice(-4);
}

function updateWalletUI(){
  const btn = document.getElementById('walletBtn');
  const addr = document.getElementById('walletAddr');
  if(currentAddress){
    btn.textContent = 'Disconnect';
    addr.textContent = ' ' + (shortAddr(currentAddress));
    addr.title = currentAddress;
  } else {
    btn.textContent = '🔌 Connect Wallet';
    addr.textContent = '—';
    addr.title = '';
  }
}

/* Attempt EIP-1193 (window.ethereum) connection first, fall back to WalletConnect */
async function connectWallet() {
  try {
    // prefer injected provider
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAddress = accounts && accounts[0] ? accounts[0] : null;
        web3Provider = window.ethereum;
        updateWalletUI();
        return;
      } catch (e) {
        console.warn('Injected wallet connection failed, falling back to WalletConnect', e);
      }
    }

    // dynamic import WalletConnectProvider
    const mod = await import('https://esm.sh/@walletconnect/web3-provider@1.8.0');
    const WalletConnectProvider = mod.default || mod;
    // create provider with public bridge (user may change to own)
    wcProvider = new WalletConnectProvider({
      rpc: {
        1: "https://rpc.ankr.com/eth", // mainnet public rpc as fallback
      },
      bridge: 'https://bridge.walletconnect.org',
      qrcode: true,
    });

    await wcProvider.enable();
    // wcProvider exposes accounts
    if (wcProvider.accounts && wcProvider.accounts.length) {
      currentAddress = wcProvider.accounts[0];
      web3Provider = wcProvider;
      updateWalletUI();
    }
  } catch (err) {
    console.error('Wallet connect failed', err);
    alert('Wallet connection failed: ' + (err && err.message ? err.message : String(err)));
  }
}

async function disconnectWallet(){
  try {
    if (wcProvider && wcProvider.close) {
      await wcProvider.close();
      wcProvider = null;
    }
    currentAddress = null;
    web3Provider = null;
    updateWalletUI();
  } catch (e) {
    console.warn('disconnect failed', e);
  }
}

document.getElementById('walletBtn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (currentAddress) {
    if (!confirm('Disconnect wallet?')) return;
    await disconnectWallet();
    alert('Wallet disconnected');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  try {
    await connectWallet();
    if (currentAddress) {
      alert('Connected: ' + currentAddress);
    }
  } finally {
    btn.disabled = false;
    updateWalletUI();
  }
});

// on load, show shortened address if already connected (WalletConnect sessions persisted)
(async function initWalletOnLoad(){
  try {
    // No heavy checks; if WalletConnect session stored in localStorage, the provider lib will rehydrate upon import.
    updateWalletUI();
  } catch(e){}
})();

export {};