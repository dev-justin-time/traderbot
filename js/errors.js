/* error_reporter executes automatically; avoid static module import to keep this file usable as a simple script */

/* Global error handling and helpers for the app */
function showToast(msg, level='error') {
  try {
    const existing = document.getElementById('toast');
    const t = existing || document.createElement('div');
    t.id = 'toast';
    t.className = `toast show ${level}`;
    t.textContent = msg;
    if (!document.body.contains(t)) document.body.appendChild(t);
    setTimeout(()=>{ t.className = 'toast'; }, 4000);
  } catch (e) {
    console.warn('toast failed', e);
  }
}

window.addEventListener('error', (ev) => {
  const msg = `Error: ${ev.message} at ${ev.filename}:${ev.lineno}:${ev.colno}`;
  console.error(msg, ev.error);
  try { showToast(msg, 'error'); } catch (e) {}
});

window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason;
  const msg = reason && reason.message ? `Unhandled Rejection: ${reason.message}` : `Unhandled Rejection: ${String(reason)}`;
  console.error(msg, reason);
  try { showToast(msg, 'error'); } catch (e) {}
});

/* Safe DOM accessor helper to avoid null DOM access crashes in renderers */
export function $idSafe(id) {
  return document.getElementById(id) || null;
}

/* Small utility to wrap render calls to catch runtime errors */
export function safeRun(fn, ctxName = 'anonymous') {
  try {
    return fn();
  } catch (e) {
    console.error(`safeRun caught error in ${ctxName}:`, e);
    showToast(`UI error (${ctxName}): ${e.message}`, 'error');
    return null;
  }
}

export default {
  showToast, $idSafe, safeRun
};