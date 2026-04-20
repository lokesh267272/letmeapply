const express = require("express");
const puppeteer = require("puppeteer");
const { buildResumeHtml } = require("./renderResume");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3001);

const app = express();

app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "letmeapply-pdf-backend"
  });
});

app.post("/generate-pdf", async (req, res) => {
  const payload = req.body || {};
  let browser;

  try {
    const html = buildResumeHtml(payload);

    browser = await puppeteer.launch({
      headless: true
    });

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0"
    });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true
    });
    const pdfBuffer = Buffer.from(pdf);

    const fileName = String(payload.fileName || "Tailored-Resume.pdf").replace(/[<>:"/\\|?*]+/g, "-");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.end(pdfBuffer);
  } catch (error) {
    console.error("[PDF backend] Failed to generate PDF", error);
    res.status(500).json({
      ok: false,
      error: "Failed to generate PDF"
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

app.post("/preview-html", (req, res) => {
  try {
    const html = buildResumeHtml(req.body || {});
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("[PDF backend] Failed to render preview HTML", error);
    res.status(500).send("Failed to render preview HTML");
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[LetMeApply PDF backend] Running at http://${HOST}:${PORT}`);
});
