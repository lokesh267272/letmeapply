const { buildResumeContentMarkup, getResumeTitle } = require("../utils/resumeRenderer");

function buildResumeHtml(payload = {}) {
  const title = getResumeTitle(payload);
  const template = String(payload.template || "classic");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} Resume</title>
  <style>
    :root {
      --text: #111111;
      --muted: #4d4d4d;
      --line: #111111;
      --paper: #ffffff;
    }

    * {
      box-sizing: border-box;
    }

    @page {
      size: A4;
      margin: 1.3cm 1.7cm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      color: var(--text);
      background: var(--paper);
      font-family: Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
    }

    body {
      font-size: 13px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .page {
      width: 100%;
    }

    .resume-header {
      text-align: center;
      margin-bottom: 8px;
    }

    .resume-header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      line-height: 1.1;
    }

    .contact-line {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 5px;
      font-size: 12.5px;
      line-height: 1.4;
    }

    .sep {
      padding: 0 2px;
    }

    .resume-section {
      margin-top: 11px;
    }

    .resume-section h2 {
      margin: 0 0 5px;
      padding-bottom: 2px;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.06em;
      break-after: avoid-page;
      page-break-after: avoid;
    }

    .objective {
      margin: 0;
      font-size: 13px;
      line-height: 1.4;
    }

    .entry {
      margin-top: 7px;
      break-inside: auto;
      page-break-inside: auto;
    }

    .entry:first-of-type {
      margin-top: 0;
    }

    .entry-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
      break-after: avoid-page;
      page-break-after: avoid;
    }

    .entry-main,
    .entry-side {
      font-size: 13px;
      line-height: 1.35;
    }

    .entry-side {
      text-align: right;
      white-space: nowrap;
    }

    .bullet-list {
      list-style: none;
      margin: 3px 0 0;
      padding: 0 0 0 14px;
    }

    .bullet-list.compact {
      margin-top: 3px;
    }

    .bullet-list li {
      position: relative;
      margin: 0 0 2px;
      line-height: 1.35;
      break-inside: auto;
      page-break-inside: auto;
    }

    .bullet-list li::before {
      content: "•";
      position: absolute;
      left: -11px;
      top: 0;
      color: var(--text);
      font-size: 10px;
      line-height: 1.35;
    }

    @media screen and (max-width: 640px) {
      .resume-header h1 {
        font-size: 22px;
      }

      .entry-row {
        grid-template-columns: 1fr;
        gap: 2px;
      }

      .entry-side {
        text-align: left;
        white-space: normal;
        color: var(--muted);
      }
    }

    /* ── Template: Modern ── */
    .template-modern {
      font-family: system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    }
    .template-modern .resume-header {
      text-align: left;
      margin-bottom: 9px;
    }
    .template-modern .resume-header h1 {
      font-size: 28px;
    }
    .template-modern .contact-line {
      justify-content: flex-start;
      gap: 4px;
    }
    .template-modern .resume-section {
      margin-top: 12px;
    }
    .template-modern .resume-section h2 {
      border-bottom: none;
      border-left: 2.5px solid var(--text);
      padding-left: 8px;
      padding-bottom: 0;
      font-size: 11px;
      letter-spacing: 0.09em;
      line-height: 1.5;
    }
    .template-modern .entry {
      margin-top: 7px;
    }

    /* ── Template: Executive ── */
    .template-executive .resume-header {
      border-bottom: 1.5px solid var(--line);
      padding-bottom: 9px;
      margin-bottom: 11px;
    }
    .template-executive .resume-header h1 {
      font-size: 28px;
      letter-spacing: 0.03em;
    }
    .template-executive .resume-section {
      margin-top: 12px;
    }
    .template-executive .resume-section h2 {
      font-size: 13px;
      font-weight: 700;
      text-transform: none;
      letter-spacing: 0.01em;
      border-bottom: 0.8px solid #777;
      margin: 0 0 5px;
      padding-bottom: 2px;
    }
    .template-executive .entry {
      margin-top: 7px;
    }
    .template-executive .entry-main {
      font-size: 13px;
    }
  </style>
</head>
<body>
  ${buildResumeContentMarkup(payload, { template })}
</body>
</html>`;
}

module.exports = {
  buildResumeHtml
};
