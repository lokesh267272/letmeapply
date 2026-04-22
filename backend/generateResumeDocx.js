const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TabStopType } = require("docx");

const FONT = "Georgia";
const BODY_PT = 22;    // 11pt in half-points
const NAME_PT = 52;    // 26pt
const CONTACT_PT = 20; // 10pt

// A4 dimensions in twips (1 inch = 1440 twips, 1mm = 56.69 twips)
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN_TOP = 739;    // 1.3cm
const MARGIN_SIDE = 964;   // 1.7cm
const TEXT_W = PAGE_W - MARGIN_SIDE * 2; // right tab stop position

function normalizeData(payload) {
  const input = payload.resumeData || payload;
  return (input && typeof input === "object" && input.resumeData) ? input.resumeData : (input || {});
}

function formatDateRange(startDate, endDate, current) {
  const start = String(startDate ?? "").trim();
  const end = current ? "Present" : String(endDate ?? "").trim();
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

function sectionHeader(title) {
  return new Paragraph({
    children: [new TextRun({ text: title.toUpperCase(), bold: true, size: BODY_PT, font: FONT })],
    spacing: { before: 180, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "111111", space: 2 } }
  });
}

function entryRow(leftText, rightText) {
  const runs = [new TextRun({ text: String(leftText || ""), bold: true, size: BODY_PT, font: FONT })];
  if (rightText) {
    runs.push(new TextRun({ text: "\t" + String(rightText), size: BODY_PT, font: FONT }));
  }
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }],
    children: runs,
    spacing: { before: 60, after: 0 }
  });
}

function bodyPara(text) {
  return new Paragraph({
    children: [new TextRun({ text: String(text || ""), size: BODY_PT, font: FONT })],
    spacing: { after: 0 }
  });
}

function bulletItem(text) {
  return new Paragraph({
    children: [new TextRun({ text: String(text || ""), size: BODY_PT, font: FONT })],
    bullet: { level: 0 },
    spacing: { after: 20 }
  });
}

async function buildResumeDocx(payload) {
  const resume = normalizeData(payload);
  const personal = resume.personal || {};

  const firstName = String(personal.firstName ?? "").trim();
  const lastName = String(personal.lastName ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Candidate";

  const children = [];

  // ── Name ──
  children.push(new Paragraph({
    children: [new TextRun({ text: fullName, bold: true, size: NAME_PT, font: FONT })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 }
  }));

  // ── Contact ──
  const contactParts = [];
  if (personal.location) contactParts.push(personal.location);
  if (personal.email) contactParts.push(personal.email);
  if (personal.phone) contactParts.push(personal.phone);
  if (personal.linkedin) contactParts.push(personal.linkedin.replace(/^https?:\/\//i, ""));
  if (personal.github) contactParts.push(personal.github.replace(/^https?:\/\//i, ""));
  if (contactParts.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join("  |  "), size: CONTACT_PT, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 }
    }));
  }

  // ── Career Objective ──
  const summary = String(resume.summary ?? "").trim();
  if (summary) {
    children.push(sectionHeader("Career Objective"));
    children.push(bodyPara(summary));
  }

  // ── Skills ──
  const skills = resume.skills || {};
  const skillRows = [
    ["Programming Languages", skills.programmingLanguages],
    ["Core CS Concepts", skills.csConcepts],
    ["Web Development", skills.webDevelopment],
    ["Databases", skills.databases],
    ["Cloud & Platforms", skills.cloudPlatforms],
    ["Machine Learning & AI", skills.mlAI],
    ["Mobile Development", skills.mobileDevelopment]
  ].filter(([, list]) => Array.isArray(list) && list.some(Boolean));

  if (skillRows.length) {
    children.push(sectionHeader("Skills"));
    for (const [label, list] of skillRows) {
      const value = list.filter(Boolean).join(", ");
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: BODY_PT, font: FONT }),
          new TextRun({ text: value, size: BODY_PT, font: FONT })
        ],
        bullet: { level: 0 },
        spacing: { after: 20 }
      }));
    }
  }

  // ── Education ──
  const education = (Array.isArray(resume.education) ? resume.education : []).filter(Boolean);
  if (education.length) {
    children.push(sectionHeader("Education"));
    for (const edu of education) {
      const leftParts = [edu.school, edu.degree, edu.location].filter(Boolean).join(", ");
      children.push(entryRow(leftParts, formatDateRange(edu.startDate, edu.endDate, edu.current)));
      const extras = [];
      if (edu.cgpa) extras.push(`CGPA / Percentage: ${edu.cgpa}`);
      if (Array.isArray(edu.bullets)) extras.push(...edu.bullets.filter(Boolean));
      for (const b of extras) children.push(bulletItem(b));
    }
  }

  // ── Experience ──
  const experience = (Array.isArray(resume.experience) ? resume.experience : []).filter(Boolean);
  if (experience.length) {
    children.push(sectionHeader("Experience"));
    for (const exp of experience) {
      const loc = exp.location ? ` – ${exp.location}` : "";
      const left = [exp.title, exp.company].filter(Boolean).join(", ") + loc;
      children.push(entryRow(left, formatDateRange(exp.startDate, exp.endDate, exp.current)));
      for (const b of (exp.bullets || []).filter(Boolean)) children.push(bulletItem(b));
    }
  }

  // ── Projects ──
  const projects = (Array.isArray(resume.projects) ? resume.projects : []).filter(Boolean);
  if (projects.length) {
    children.push(sectionHeader("Projects"));
    for (const proj of projects) {
      const leftParts = [proj.name, proj.organization, proj.location].filter(Boolean).join(" – ");
      const right = proj.link
        ? proj.link.replace(/^https?:\/\//i, "")
        : formatDateRange(proj.startDate, proj.endDate, proj.current);
      children.push(entryRow(leftParts, right));
      for (const b of (proj.bullets || []).filter(Boolean)) children.push(bulletItem(b));
    }
  }

  // ── Achievements ──
  const achievements = (Array.isArray(resume.achievements) ? resume.achievements : []).filter(Boolean);
  if (achievements.length) {
    children.push(sectionHeader("Achievements"));
    for (const a of achievements) children.push(bulletItem(String(a)));
  }

  // ── Certifications ──
  const certifications = (Array.isArray(resume.certifications) ? resume.certifications : []).filter(Boolean);
  if (certifications.length) {
    children.push(sectionHeader("Certifications"));
    for (const c of certifications) children.push(bulletItem(String(c)));
  }

  // ── Languages ──
  const languages = (Array.isArray(resume.languages) ? resume.languages : []).filter(Boolean);
  if (languages.length) {
    children.push(sectionHeader("Languages"));
    for (const lang of languages) {
      const name = String(lang?.name ?? "").trim();
      const prof = String(lang?.proficiency ?? "").trim();
      if (name) children.push(bulletItem(prof ? `${name} – ${prof}` : name));
    }
  }

  // ── Publications ──
  const publications = (Array.isArray(resume.publications) ? resume.publications : []).filter(Boolean);
  if (publications.length) {
    children.push(sectionHeader("Publications"));
    for (const p of publications) children.push(bulletItem(String(p)));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN_TOP, bottom: MARGIN_TOP, left: MARGIN_SIDE, right: MARGIN_SIDE }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildResumeDocx };
