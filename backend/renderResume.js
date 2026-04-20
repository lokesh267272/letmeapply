const { buildResumeContentMarkup, getResumeTitle } = require("../utils/resumeRenderer");

function buildResumeHtml(payload = {}) {
  const title = getResumeTitle(payload);

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
      size: letter;
      margin: 1.8cm 2cm;
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
      font-size: 14px;
      line-height: 1.42;
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
      margin-bottom: 12px;
    }

    .resume-header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      line-height: 1.1;
    }

    .contact-line {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      font-size: 14px;
      line-height: 1.5;
    }

    .sep {
      padding: 0 2px;
    }

    .resume-section {
      margin-top: 18px;
    }

    .resume-section h2 {
      margin: 0 0 8px;
      padding-bottom: 3px;
      border-bottom: 1px solid var(--line);
      font-size: 20px;
      font-weight: 700;
      line-height: 1.2;
      break-after: avoid-page;
      page-break-after: avoid;
    }

    .objective {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
    }

    .entry {
      margin-top: 12px;
      break-inside: auto;
      page-break-inside: auto;
    }

    .entry:first-of-type {
      margin-top: 0;
    }

    .entry-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: start;
      break-after: avoid-page;
      page-break-after: avoid;
    }

    .entry-main,
    .entry-side {
      font-size: 14px;
      line-height: 1.4;
    }

    .entry-side {
      text-align: right;
      white-space: nowrap;
    }

    .bullet-list {
      list-style: none;
      margin: 6px 0 0;
      padding: 0 0 0 14px;
    }

    .bullet-list.compact {
      margin-top: 4px;
    }

    .bullet-list li {
      position: relative;
      margin: 0 0 4px;
      line-height: 1.4;
      break-inside: auto;
      page-break-inside: auto;
    }

    .bullet-list li::before {
      content: "";
      position: absolute;
      left: -11px;
      top: 0.58em;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--text);
    }

    @media screen and (max-width: 640px) {
      .resume-header h1 {
        font-size: 28px;
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
  </style>
</head>
<body>
  ${buildResumeContentMarkup(payload)}
</body>
</html>`;
}

module.exports = {
  buildResumeHtml
};
