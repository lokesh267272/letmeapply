# ApplyMatrix Local PDF Backend

This backend generates ATS-friendly resume PDFs locally using Express and Puppeteer.

## Endpoints

- `GET /health`
- `POST /preview-html`
- `POST /generate-pdf`

## Run locally

```bash
cd backend
npm install
npm start
```

The server starts on `http://127.0.0.1:3001` by default.

## Request shape

Send the same structured object your extension stores as `resumeBuilder`, either directly or wrapped in `resumeData`.

Example:

```json
{
  "fileName": "Lokesh-Tailored-Resume.pdf",
  "resumeData": {
    "personal": {
      "firstName": "Sunkara",
      "lastName": "Lokesh",
      "email": "sunkaralokesh0@gmail.com",
      "phone": "+91 9490835911",
      "location": "Hyderabad",
      "linkedin": "https://linkedin.com/in/sunkara-lokesh",
      "github": "https://github.com/lokesh267272"
    },
    "summary": "Results-driven software engineer...",
    "experience": [],
    "education": [],
    "skills": {
      "programmingLanguages": ["Python", "JavaScript"]
    },
    "projects": [],
    "certifications": [],
    "achievements": [],
    "languages": [],
    "publications": []
  }
}
```

## Download from the extension

Example fetch:

```js
async function generatePdf(resumeData) {
  const response = await fetch("http://127.0.0.1:3001/generate-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName: "Tailored-Resume.pdf",
      resumeData
    })
  });

  if (!response.ok) {
    throw new Error("PDF generation failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url,
    filename: "Tailored-Resume.pdf",
    saveAs: true
  });
}
```

## Notes

- `displayHeaderFooter: false` removes browser-added print headers and footers in the generated PDF.
- `@page` margins are defined in the HTML renderer so every PDF page has consistent spacing.
- Long entries are allowed to flow across pages to avoid large white gaps.
