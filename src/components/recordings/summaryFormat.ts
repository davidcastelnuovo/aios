// Converters for the meeting-summary Markdown: WhatsApp text formatting and
// simple email-safe HTML. Both intentionally minimal — the summary structure
// is controlled by our own prompt (headings, bullets, one task table).

export function markdownToWhatsApp(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    // Table rows → "cell — cell — cell"; separator rows dropped
    if (/^\|/.test(line.trim())) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      out.push("• " + cells.join(" — "));
      continue;
    }
    let text = line;
    const heading = text.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      out.push("");
      out.push(`*${heading[1].replace(/\*\*/g, "")}*`);
      continue;
    }
    text = text.replace(/\*\*(.+?)\*\*/g, "*$1*");
    text = text.replace(/^[-*]\s+/, "• ");
    out.push(text);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function markdownToEmailHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let listOpen = false;
  let tableRows: string[][] = [];

  const closeList = () => { if (listOpen) { out.push("</ul>"); listOpen = false; } };
  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [head, ...body] = tableRows;
    out.push('<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">');
    out.push("<tr>" + head.map((c) => `<th style="border:1px solid #e2e8f0;padding:6px 10px;background:#f8fafc;text-align:right;">${inlineHtml(c)}</th>`).join("") + "</tr>");
    for (const row of body) {
      out.push("<tr>" + row.map((c) => `<td style="border:1px solid #e2e8f0;padding:6px 10px;text-align:right;">${inlineHtml(c)}</td>`).join("") + "</tr>");
    }
    out.push("</table>");
    tableRows = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (/^\|/.test(line)) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (!cells.every((c) => /^:?-+:?$/.test(c))) tableRows.push(cells);
      continue;
    }
    flushTable();

    if (!line) { closeList(); continue; }

    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 || h2 || h3) {
      closeList();
      const text = (h1 || h2 || h3)![1];
      const size = h1 ? 20 : h2 ? 17 : 15;
      out.push(`<h3 style="margin:18px 0 6px;font-size:${size}px;color:#1e293b;">${inlineHtml(text)}</h3>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) { out.push('<ul style="margin:6px 0;padding-right:20px;">'); listOpen = true; }
      out.push(`<li style="margin:3px 0;color:#334155;font-size:14px;line-height:1.6;">${inlineHtml(bullet[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p style="margin:6px 0;color:#334155;font-size:14px;line-height:1.7;">${inlineHtml(line)}</p>`);
  }
  closeList();
  flushTable();
  return out.join("\n");
}
