# ApplyMatrix – Local Setup Guide

## Step 1: Star & Clone the Repository

If you find this useful, please **star the repo** — it helps a lot!

Then clone it to your machine:

```bash
git clone https://github.com/lokesh267272/applymatrix.git
cd applymatrix
```

## Step 2: Install Node.js

You need Node.js to run the backend server.

**Download Node.js here:** https://nodejs.org/en/download

> Not sure how to install Node.js? Watch this quick tutorial:
> https://www.youtube.com/watch?v=4FAtFwKVhn0

## Step 3: Run the Backend

Navigate into the backend folder and start the server:

```bash
cd backend
npm install
npm start
```

The backend will start on `http://127.0.0.1:3001` — keep this terminal window open.

## Step 4: Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Toggle **Developer Mode ON** (top-right corner)
3. Click **"Load unpacked"**
4. Select the `applymatrix` folder (the root of the cloned repo)
5. The ApplyMatrix icon will appear in your Chrome toolbar

> New to Chrome extensions? Watch this guide:
> https://www.youtube.com/watch?v=RKcnRJAZMfU

## Step 5: Get Your Free Gemini API Key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"** and copy it

## Step 6: Configure the Extension

1. Click the ApplyMatrix icon in your Chrome toolbar
2. Click the **gear icon (Settings)**
3. Enter your **Full Name** under the name field
4. Paste your **Gemini API Key** in the API key field
5. Click **Save**

You're all set! Navigate to any job listing on LinkedIn, Naukri, or Indeed and click the ApplyMatrix icon to extract job data and generate tailored content.
