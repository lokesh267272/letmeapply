const { buildCoverLetterMarkup } = require("../utils/coverLetterRenderer");

function buildCoverLetterHtml(payload = {}) {
  const name = String(payload.candidateName || "Cover Letter");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} - Cover Letter</title>
  <style>
    :root {
      --text: #111111;
      --muted: #4d4d4d;
      --paper: #ffffff;
    }

    * {
      box-sizing: border-box;
    }

    @page {
      size: A4;
      margin: 2cm 2.2cm;
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
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .cl-page {
      width: 100%;
    }

    .cl-header {
      margin-bottom: 28px;
    }

    .cl-name {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.1;
    }

    .cl-contact {
      margin-top: 5px;
      font-size: 12px;
      color: var(--muted);
    }

    .cl-date {
      margin-bottom: 22px;
      font-size: 13px;
    }

    .cl-body {
      max-width: 100%;
    }

    .cl-para {
      margin: 0 0 14px;
      line-height: 1.65;
    }

    .cl-para:last-child {
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  ${buildCoverLetterMarkup(payload)}
</body>
</html>`;
}

module.exports = { buildCoverLetterHtml };
