// Reads the text lines of a PDF in the browser (pdf.js). Nothing leaves the phone.
// Resolves to a JSON array of lines; rejects with "password" or "wrong_password" when locked.
window.pocketreePdfLines = async function (bytes, password) {
  const lib = window.pdfjsLib;
  if (!lib) throw new Error('PDF reader did not load');
  lib.GlobalWorkerOptions.workerSrc = 'pdfjs/pdf.worker.min.js';
  let doc;
  try {
    doc = await lib.getDocument({ data: bytes.slice(), password: password || undefined, isEvalSupported: false }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new Error(password ? 'wrong_password' : 'password');
    throw new Error('Could not read this PDF.');
  }
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str !== undefined && i.str.trim() !== '').map(i => ({
      s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || Math.abs(i.height) || 8,
    }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const it of items) {
      const row = rows.find(r => Math.abs(r.y - it.y) <= Math.max(2, Math.min(r.h, it.h) * 0.4));
      if (row) row.items.push(it); else rows.push({ y: it.y, h: it.h, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let line = '', end = null;
      for (const it of r.items) {
        if (end !== null) {
          const gap = it.x - end;
          if (gap > it.h * 0.15 && !line.endsWith(' ') && !it.s.startsWith(' ')) line += ' ';
        }
        line += it.s;
        end = it.x + it.w;
      }
      line = line.replace(/\s+/g, ' ').trim();
      if (line) out.push(line);
    }
    page.cleanup();
  }
  await doc.destroy();
  return JSON.stringify(out);
};

// Saves a file from the iPhone web app: the share sheet (Save to Files, WhatsApp...) when the
// browser allows it, otherwise a normal download. Resolves "shared", "downloaded" or "cancelled".
window.pocketreeSaveFile = async function (bytes, name, mime) {
  const file = new File([bytes], name, { type: mime || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // NotAllowedError (too long after the tap) falls through to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
};
