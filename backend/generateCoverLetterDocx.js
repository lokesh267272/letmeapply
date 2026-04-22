const { Document, Packer, Paragraph, TextRun } = require("docx");

const FONT = "Georgia";

// A4 with 2cm / 2.2cm margins (matching PDF template)
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN_TB = 1134;  // 2cm
const MARGIN_LR = 1247;  // 2.2cm

function formatDate(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

async function buildCoverLetterDocx(payload) {
  const name = String(payload.candidateName || "").trim();
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();
  const location = String(payload.location || "").trim();
  const text = String(payload.coverLetterText || "").trim();
  const date = formatDate(payload.generatedAt);

  const children = [];

  // ── Sender name ──
  if (name) {
    children.push(new Paragraph({
      children: [new TextRun({ text: name, bold: true, size: 48, font: FONT })],
      spacing: { after: 40 }
    }));
  }

  // ── Contact info ──
  const contactParts = [email, phone, location].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join("  |  "), size: 20, font: FONT, color: "444444" })],
      spacing: { after: 240 }
    }));
  }

  // ── Date ──
  children.push(new Paragraph({
    children: [new TextRun({ text: date, size: 22, font: FONT })],
    spacing: { after: 240 }
  }));

  // ── Body paragraphs ──
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    // Preserve single-line breaks within a paragraph
    const lines = para.split(/\n/);
    const runs = [];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) runs.push(new TextRun({ break: 1 }));
      runs.push(new TextRun({ text: lines[i].trim(), size: 22, font: FONT }));
    }
    children.push(new Paragraph({
      children: runs,
      spacing: { after: 160 }
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildCoverLetterDocx };
