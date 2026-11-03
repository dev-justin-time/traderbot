/*
  Agent Manager Bridge
  - Ensures the inline agent-manager UI boots and runs safe background tasks
  - Rate-limits scraper and CSV builds to avoid hitting public API limits
*/

(function(){
  // guard: renderAll should exist (defined in inline script)
  function safe(fn){ try{ return fn(); }catch(e){ console.warn('agent_manager_bridge error', e); } }

  // initial render now that DOM/scripts loaded
  document.addEventListener('DOMContentLoaded', () => {
    safe(() => {
      if (typeof renderAll === 'function') renderAll();
    });
  });

  // BACKGROUND JOBS: rate-limited scraper + CSV builder
  // Parameters: run scraper at most once per 60s, CSV build at most once per 5 minutes
  const SCRAPE_INTERVAL_MS = 60 * 1000;
  const CSV_INTERVAL_MS = 5 * 60 * 1000;

  let lastScrape = 0;
  let lastCsvBuild = 0;
  let autoBackground = true; // can be toggled programmatically later

  async function maybeScrape() {
    if (!autoBackground) return;
    const now = Date.now();
    if (now - lastScrape < SCRAPE_INTERVAL_MS) return;
    lastScrape = now;
    safe(() => {
      const btn = document.getElementById('scrapeAll');
      if (btn) {
        // call existing handler
        btn.click();
      } else if (typeof scraper !== 'undefined' && scraper.scrapeAll) {
        scraper.scrapeAll().then(items => { safe(()=>{ renderScraper && renderScraper(); toast && toast(`Scraped ${items.length} items`); }); });
      }
    });
  }

  async function maybeCsvBuild() {
    if (!autoBackground) return;
    const now = Date.now();
    if (now - lastCsvBuild < CSV_INTERVAL_MS) return;
    lastCsvBuild = now;
    safe(async () => {
      const buildBtn = document.getElementById('csvBuild');
      if (buildBtn) {
        // build but avoid downloading automatically to respect user control
        buildBtn.click();
        // update UI after short delay (csvBuilder logs)
        setTimeout(()=>{ renderCSVLog && renderCSVLog(); }, 2200);
      }
    });
  }

  // Scheduler
  const scheduler = setInterval(() => {
    maybeScrape();
    maybeCsvBuild();
    // refresh some stats on the page
    safe(()=>{ renderCache && renderCache(); renderCSVLog && renderCSVLog(); });
  }, 15 * 1000); // check every 15s, actions themselves respect intervals

  // Expose a small control to toggle background auto-run from console if needed
  window.__agentManagerBridge = {
    stop() { autoBackground = false; clearInterval(scheduler); console.info('Agent Manager bridge stopped'); },
    start() { if (!autoBackground) { autoBackground = true; lastScrape = 0; lastCsvBuild = 0; console.info('Agent Manager bridge started'); } }
  };

  // Safety: if user navigates away, stop scheduler
  window.addEventListener('beforeunload', () => { clearInterval(scheduler); });
})();