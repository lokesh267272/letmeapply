# ⚡ ApplyMatrix – AI Job Application Assistant

A Chrome extension that helps you apply to jobs faster using **Google Gemini AI**.

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Job Detection** | Auto-extracts job title, company, location & description |
| 📄 **Resume Tailor** | Rewrites your resume to match the job's keywords (ATS-optimized) |
| ✉️ **Cover Letter** | Generates a personalized cover letter for each role |
| 📊 **ATS Score** | Shows keyword match %, matched/missing keywords & improvement tips |

## 🌐 Supported Platforms

- **LinkedIn** Jobs
- **Naukri** Job Listings
- **Indeed** Job Postings
- **Universal** — works on any job listing page

## 🚀 Installation (Chrome)

1. **Download** and extract this `applymatrix-extension` folder
2. Open Chrome → go to `chrome://extensions/`
3. Toggle **Developer Mode ON** (top-right corner)
4. Click **"Load unpacked"** and select the `applymatrix-extension` folder
5. The ⚡ icon will appear in your browser toolbar

## 🔑 Setup

1. **Get a free Gemini API key** at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click the ⚡ extension icon → click the ⚙ gear icon
3. Enter your **Gemini API Key**
4. Add your **Full Name**, **Email**, **Skills**
5. **Paste your base resume** in the text area
6. Click **Save Profile**

## 🧑‍💻 How to Use

1. Navigate to any job listing on LinkedIn, Naukri, or Indeed
2. Click the ⚡ **ApplyMatrix** icon
3. The **Job Details** tab auto-fills with extracted data
4. Switch to **Resume** tab → click "✨ Tailor My Resume"
5. Switch to **Cover Letter** tab → click "📝 Generate Cover Letter"
6. Switch to **ATS Score** tab → click "📊 Check ATS Score"
7. Use the **📋 Copy** button to copy results

## 🔄 Switching AI Model (Advanced)

To switch from Gemini 2.0 Flash to another model, open `utils/gemini.js` and change:

```js
const GEMINI_MODEL = 'gemini-2.0-flash'; // change to 'gemini-1.5-pro', etc.
```

## 📁 File Structure

```
applymatrix-extension/
├── manifest.json          ← Extension config (Manifest V3)
├── backend/               ← Local Puppeteer PDF backend
│   ├── package.json
│   ├── server.js
│   ├── renderResume.js
│   └── README.md
├── popup/
│   ├── popup.html         ← Popup UI
│   ├── popup.css          ← Styles
│   └── popup.js           ← Popup logic
├── content/
│   └── content.js         ← Job extraction (runs on job pages)
├── background/
│   └── background.js      ← Service worker
├── utils/
│   └── gemini.js          ← Gemini API calls (Tailor / Cover / ATS)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🧾 Local PDF Backend

If you want direct PDF downloads without the browser print dialog, a local Puppeteer backend is included in `backend/`.

Run it locally:

```bash
cd backend
npm install
npm start
```

It starts on `http://127.0.0.1:3001` and can generate a resume PDF from the structured `resumeBuilder` data.

## 🔒 Privacy

- Your resume and API key are stored **locally** in Chrome storage only
- Data is sent **directly** from your browser to Gemini API — nothing goes through any server
- You can clear all data via Chrome → Settings → Privacy → Clear browsing data

---

Built with ❤️ using Google Gemini AI
