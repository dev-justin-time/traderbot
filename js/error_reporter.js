/*
  Error Reporter
  - Scans document scripts (same-origin) for lines containing common error-handling terms
  - Produces a plain-text report listing filename, line number and matching code lines
  - Triggers an automatic download on page start
*/
(async function() {
  const TERMS = ['error', 'unhandledrejection', 'showToast', 'addEventListener', 'window.addEventListener', 'unhandledRejection', 'try {', 'catch ('];
  const now = Date.now();

  function safeFilename(name) {
    return name.replace(/[^\w\-.]/g, '_').slice(0,200);
  }

  async function fetchScriptText(src) {
    try {
      // Only attempt if same-origin or relative path (avoid CORS failures)
      const url = new URL(src, location.href);
      if (url.origin !== location.origin) return null;
      const res = await fetch(url.href, {cache: "no-store"});
      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      return null;
    }
  }

  function gatherMatches(text, terms) {
    const lines = text.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const t of terms) {
        if (line.toLowerCase().includes(t.toLowerCase())) {
          hits.push({ line: i+1, code: line.trim() });
          break;
        }
      }
    }
    return hits;
  }

  async function buildReport() {
    const reportLines = [];
    reportLines.push(`Error Logic Report — generated ${new Date(now).toISOString()}`);
    reportLines.push('------------------------------------------------------------\n');

    const scripts = Array.from(document.scripts || []);
    for (const s of scripts) {
      // Only process external scripts or modules with src
      const src = s.src || s.getAttribute('src');
      if (!src) continue;
      const text = await fetchScriptText(src);
      if (!text) {
        reportLines.push(`File: ${src} — (unfetched - likely cross-origin or inline)`);
        reportLines.push('');
        continue;
      }
      const matches = gatherMatches(text, TERMS);
      reportLines.push(`File: ${src}`);
      if (matches.length === 0) {
        reportLines.push('  (no matches for error-related terms found)');
        reportLines.push('');
        continue;
      }
      for (const m of matches) {
        // include a small context window (previous and next line) if possible
        const allLines = text.split(/\r?\n/);
        const ctxStart = Math.max(0, m.line - 2);
        const ctxEnd = Math.min(allLines.length, m.line + 1);
        reportLines.push(`  Line ${m.line}: ${m.code}`);
        for (let li = ctxStart; li < ctxEnd; li++) {
          if (li + 1 === m.line) continue;
          reportLines.push(`    ${li+1}: ${allLines[li].trim()}`);
        }
      }
      reportLines.push('');
    }

    // Also include a small env snapshot
    reportLines.push('Environment snapshot:');
    reportLines.push(`  URL: ${location.href}`);
    reportLines.push(`  UserAgent: ${navigator.userAgent}`);
    reportLines.push(`  Local Time: ${new Date().toString()}`);
    reportLines.push('');
    return reportLines.join('\n');
  }

  function downloadText(filename, text) {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Download failed', e);
    }
  }

  // Run on DOMContentLoaded to ensure document.scripts populated
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      const report = await buildReport();
      const filename = `error_report_${safeFilename(location.hostname)}_${now}.txt`;
      downloadText(filename, report);
    }, { once: true });
  } else {
    const report = await buildReport();
    const filename = `error_report_${safeFilename(location.hostname)}_${now}.txt`;
    downloadText(filename, report);
  }
})();