const { Document, Packer, Paragraph, TextRun, LineRuleType } = require("docx");

const FONT = "Georgia";

// Exact line height: 11pt × 1.6 = 17.6pt → 352 twips (1pt = 20 twips)
const BODY_LINE = 352;

// A4 with 2cm / 2.2cm margins (matching PDF template)
const PAGE_W     = 11906;
const PAGE_H     = 16838;
const MARGIN_TB  = 1134;  // 2 cm
const MARGIN_LR  = 1247;  // 2.2 cm

// Document-level styles – lock in Georgia so Word cannot substitute Calibri.
const DOC_STYLES = {
  default: {
    document: {
      run:       { font: FONT, size: 22 },
      paragraph: { spacing: { after: 0, line: BODY_LINE, lineRule: LineRuleType.EXACT } }
    }
  },
  paragraphStyles: [
    {
      id:   "Normal",
      name: "Normal",
      run:       { font: FONT, size: 22 },
      paragraph: { spacing: { after: 0, line: BODY_LINE, lineRule: LineRuleType.EXACT } }
    }
  ]
};

function formatDate(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

async function buildCoverLetterDocx(payload) {
  const name     = String(payload.candidateName || "").trim();
  const email    = String(payload.email    || "").trim();
  const phone    = String(payload.phone    || "").trim();
  const location = String(payload.location || "").trim();
  const text     = String(payload.coverLetterText || "").trim();
  const date     = formatDate(payload.generatedAt);

  const children = [];

  // Sender name – exact line height sized for 24pt text (24pt × 1.2 = 28.8pt → 576 twips)
  if (name) {
    children.push(new Paragraph({
      children: [new TextRun({ text: name, bold: true, size: 48, font: FONT })],
      spacing:  { after: 40, line: 576, lineRule: LineRuleType.EXACT }
    }));
  }

  // Contact info
  const contactParts = [email, phone, location].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join("  |  "), size: 20, font: FONT, color: "444444" })],
      spacing:  { after: 240, line: BODY_LINE, lineRule: LineRuleType.EXACT }
    }));
  }

  // Date
  children.push(new Paragraph({
    children: [new TextRun({ text: date, size: 22, font: FONT })],
    spacing:  { after: 240, line: BODY_LINE, lineRule: LineRuleType.EXACT }
  }));

  // Body paragraphs
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const lines = para.split(/\n/);
    const runs  = [];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) runs.push(new TextRun({ break: 1 }));
      runs.push(new TextRun({ text: lines[i].trim(), size: 22, font: FONT }));
    }
    children.push(new Paragraph({
      children: runs,
      spacing:  { after: 200, line: BODY_LINE, lineRule: LineRuleType.EXACT }
    }));
  }

  const doc = new Document({
    styles: DOC_STYLES,
    sections: [{
      properties: {
        page: {
          size:   { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildCoverLetterDocx };
