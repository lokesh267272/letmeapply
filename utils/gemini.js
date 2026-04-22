// Gemini API utility
// Uses a model that supports structured JSON output well for resume workflows.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RESUME_JSON_SCHEMA = {
  type: "object",
  properties: {
    personal: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        location: { type: "string" },
        linkedin: { type: "string" },
        github: { type: "string" }
      },
      required: ["firstName", "lastName", "email", "phone", "location", "linkedin", "github"]
    },
    summary: { type: "string" },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          current: { type: "boolean" },
          bullets: { type: "array", items: { type: "string" } }
        },
        required: ["title", "company", "location", "startDate", "endDate", "current", "bullets"]
      }
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          school: { type: "string" },
          degree: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          current: { type: "boolean" },
          cgpa: { type: "string" },
          bullets: { type: "array", items: { type: "string" } }
        },
        required: ["school", "degree", "location", "startDate", "endDate", "current", "cgpa", "bullets"]
      }
    },
    skills: {
      type: "object",
      properties: {
        programmingLanguages: { type: "array", items: { type: "string" } },
        csConcepts: { type: "array", items: { type: "string" } },
        webDevelopment: { type: "array", items: { type: "string" } },
        databases: { type: "array", items: { type: "string" } },
        cloudPlatforms: { type: "array", items: { type: "string" } },
        mlAI: { type: "array", items: { type: "string" } },
        mobileDevelopment: { type: "array", items: { type: "string" } }
      },
      required: ["programmingLanguages", "csConcepts", "webDevelopment", "databases", "cloudPlatforms", "mlAI", "mobileDevelopment"]
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          organization: { type: "string" },
          link: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          current: { type: "boolean" },
          bullets: { type: "array", items: { type: "string" } }
        },
        required: ["name", "organization", "link", "location", "startDate", "endDate", "current", "bullets"]
      }
    },
    certifications: { type: "array", items: { type: "string" } },
    achievements: { type: "array", items: { type: "string" } },
    languages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          proficiency: { type: "string" }
        },
        required: ["name", "proficiency"]
      }
    },
    publications: { type: "array", items: { type: "string" } }
  },
  required: ["personal", "summary", "experience", "education", "skills", "projects", "certifications", "achievements", "languages", "publications"]
};

const ATS_JSON_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    grade: { type: "string" },
    matched_keywords: { type: "array", items: { type: "string" } },
    missing_keywords: { type: "array", items: { type: "string" } },
    suggestions: { type: "string" }
  },
  required: ["score", "grade", "matched_keywords", "missing_keywords", "suggestions"]
};

async function callGemini(prompt, apiKey, config = {}) {
  const response = await fetch(GEMINI_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: config.maxOutputTokens ?? 2048,
        ...(config.responseMimeType ? { responseMimeType: config.responseMimeType } : {}),
        ...(config.responseJsonSchema ? { responseJsonSchema: config.responseJsonSchema } : {}),
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API Error: ${msg}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned empty response.");
  return text;
}

function parseJsonSafely(rawText, fallbackMessage) {
  const cleaned = String(rawText || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .replace(/^\uFEFF/, "")
    .trim();

  const candidates = [];

  if (cleaned) candidates.push(cleaned);
  if (cleaned) {
    candidates.push(
      cleaned
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u0019]+/g, " ")
        .trim()
    );
  }

  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    candidates.push(match[0]);
    candidates.push(
      match[0]
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u0019]+/g, " ")
        .trim()
    );
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Try the next candidate.
    }
  }

  throw new Error(fallbackMessage);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.replace(/^[\-\*\u2022]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeATSResult(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const scoreValue = Number(
    source.score ??
    source.ats_score ??
    source.match_score ??
    0
  );

  return {
    score: Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, Math.round(scoreValue))) : 0,
    grade: String(source.grade ?? source.rating ?? "Fair").trim() || "Fair",
    matched_keywords: normalizeStringArray(source.matched_keywords ?? source.matchedKeywords ?? source.matched),
    missing_keywords: normalizeStringArray(source.missing_keywords ?? source.missingKeywords ?? source.missing),
    suggestions: String(source.suggestions ?? source.recommendations ?? source.feedback ?? "").trim()
  };
}

function parseLabeledATSResponse(text) {
  const raw = String(text || "").trim();
  const scoreMatch = raw.match(/score\s*:\s*(\d{1,3})/i);
  const gradeMatch = raw.match(/grade\s*:\s*([^\n\r]+)/i);
  const matchedMatch = raw.match(/matched[_\s-]*keywords?\s*:\s*([\s\S]*?)(?:\n\s*missing[_\s-]*keywords?\s*:|\n\s*suggestions?\s*:|$)/i);
  const missingMatch = raw.match(/missing[_\s-]*keywords?\s*:\s*([\s\S]*?)(?:\n\s*suggestions?\s*:|$)/i);
  const suggestionsMatch = raw.match(/suggestions?\s*:\s*([\s\S]*)$/i);

  const result = normalizeATSResult({
    score: scoreMatch ? Number(scoreMatch[1]) : 0,
    grade: gradeMatch ? gradeMatch[1].trim() : "Fair",
    matched_keywords: matchedMatch ? matchedMatch[1].trim() : [],
    missing_keywords: missingMatch ? missingMatch[1].trim() : [],
    suggestions: suggestionsMatch ? suggestionsMatch[1].trim() : ""
  });

  if (!result.suggestions) {
    result.suggestions = "Review the missing keywords and update your summary and bullet points to align more closely with the job description.";
  }

  return result;
}

/**
 * Tailor resume for a specific job
 */
async function tailorResume(
  { jobTitle, company, jobDescription, baseResume, candidateName },
  apiKey,
) {
  const prompt = `You are an expert resume writer and ATS optimization specialist.

CANDIDATE NAME: ${candidateName || "Candidate"}

JOB DETAILS:
Title: ${jobTitle || "Not specified"}
Company: ${company || "Not specified"}
Description:
${jobDescription}

CURRENT RESUME:
${baseResume}

TASK: Rewrite and optimize this resume to perfectly match the job description above.

Guidelines:
- Keep the candidate's actual experience and truthful information, only reframe and reword
- Match important keywords from the job description naturally throughout
- Rewrite the professional summary to target this specific role
- Reorganize bullets to lead with most relevant achievements
- Ensure ATS compatibility with no tables, columns, or graphics
- Keep it to 1-2 pages worth of content
- Format clearly: Summary | Experience | Skills | Education | Certifications (if any)
- Use strong action verbs and quantify achievements where possible

Return ONLY the tailored resume text with no commentary or markdown fences.`;

  return await callGemini(prompt, apiKey);
}

/**
 * Tailor a structured resume for a specific job and return structured JSON
 */
async function tailorResumeStructured(
  { jobTitle, company, jobDescription, resumeData, candidateName },
  apiKey,
) {
  const prompt = `You are an expert resume writer and ATS optimization specialist.

CANDIDATE NAME: ${candidateName || "Candidate"}

JOB DETAILS:
Title: ${jobTitle || "Not specified"}
Company: ${company || "Not specified"}
Description:
${jobDescription}

CURRENT STRUCTURED RESUME JSON:
${JSON.stringify(resumeData, null, 2)}

TASK:
Return an ATS-friendly, job-tailored version of this resume in the exact same schema.

STRICT RULES:
1. Keep all experience, education, projects, certifications, achievements, languages, and publications truthful.
2. Do not invent new companies, roles, dates, achievements, projects, certifications, or metrics.
3. You may improve the summary, reorder bullet points, rewrite bullet wording, and emphasize the most relevant skills.
4. Keep personal contact fields unchanged unless only formatting cleanup is needed.
5. Preserve links, dates, company names, school names, and project names unless light cleanup is needed.
6. Make bullets stronger, more concise, and more relevant to the job description.
7. Integrate important keywords from the job description naturally and honestly.
8. Keep the resume concise and ATS friendly.
9. If a section is empty in the input, keep it empty in the output.
10. Bullets must remain arrays of strings.

QUALITY GOALS:
- Professional summary should be targeted to this role
- Experience bullets should lead with the most relevant achievements
- Skills should prioritize the tools and concepts that best match the job
- Wording should be clear, strong, and recruiter-friendly`;

  const raw = await callGemini(prompt, apiKey, {
    temperature: 0.2,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseJsonSchema: RESUME_JSON_SCHEMA
  });

  return parseJsonSafely(raw, "Could not parse tailored resume structure. Please try again.");
}

/**
 * Generate personalized cover letter
 */
async function generateCoverLetter(
  { jobTitle, company, jobDescription, baseResume, candidateName, email },
  apiKey,
) {
  const prompt = `You are an expert career coach and professional writer.

CANDIDATE: ${candidateName || "Candidate"} | ${email || ""}

JOB DETAILS:
Title: ${jobTitle || "this role"}
Company: ${company || "this company"}
Description:
${jobDescription}

CANDIDATE'S BACKGROUND (from resume):
${baseResume}

TASK: Write a compelling, personalized cover letter for this specific job.

Guidelines:
- Strong opening hook, do not start with "I am writing to apply..."
- Mention the company by name naturally
- Highlight 2-3 specific, quantifiable achievements directly relevant to this role
- Show enthusiasm for this specific role and company
- Address key requirements from the job description
- Keep it under 320 words
- Close with a confident, specific call to action
- Professional but warm tone

Format:
[Date]
Hiring Manager
${company || "[Company Name]"}

Dear Hiring Manager,

[Body paragraphs]

Best regards,
${candidateName || "[Your Name]"}
${email || "[Email]"}

Return ONLY the cover letter with no commentary or markdown fences.`;

  return await callGemini(prompt, apiKey, {
    maxOutputTokens: 8192
  });
}

/**
 * Parse raw resume text into structured JSON fields
 */
async function parseResumeStructured(resumeText, apiKey) {
  const prompt = `You are an expert resume parser. Extract all information from the resume text below into the required structured resume JSON.

RESUME TEXT:
${resumeText}

STRICT RULES:
1. Extract all jobs, all education entries, and all projects. Never skip entries.
2. Bullets must be arrays of clean strings with no bullet prefix characters.
3. Categorize each skill into the best-fitting category:
   - programmingLanguages: Python, Java, C++, JavaScript, TypeScript, Go, etc.
   - csConcepts: Data Structures, Algorithms, OOP, OS, DBMS, Networking, etc.
   - webDevelopment: React, Next.js, Node.js, HTML, CSS, Django, Flask, Spring, etc.
   - databases: MySQL, MongoDB, PostgreSQL, Redis, Firebase, etc.
   - cloudPlatforms: AWS, Azure, GCP, Docker, Kubernetes, Linux, Git, etc.
   - mlAI: TensorFlow, PyTorch, scikit-learn, NLP, Computer Vision, etc.
   - mobileDevelopment: React Native, Flutter, Android, iOS, Swift, Kotlin, etc.
4. Dates format: "MMM YYYY" when possible, for example "Jan 2022". If currently active, set current: true and leave endDate as "".
5. Language proficiency must use only "Native", "Professional", or "Basic".
6. If a field is not found, use "" for strings, [] for arrays, and false for booleans.`;

  const raw = await callGemini(prompt, apiKey, {
    temperature: 0.1,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseJsonSchema: RESUME_JSON_SCHEMA
  });

  return parseJsonSafely(raw, "Could not parse resume structure. Please try again.");
}

/**
 * Check ATS score and return parsed JSON
 */
async function checkATSScore({ jobDescription, resume }, apiKey) {
  const prompt = `You are an ATS (Applicant Tracking System) expert analyst.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resume}

TASK: Analyze how well this resume matches the job description for ATS systems.

  Scoring guide:
  - 80-100: Excellent match
  - 60-79: Good match
  - 40-59: Fair match (needs improvement)
  - 0-39: Poor match (significant gaps)`;

  try {
    const raw = await callGemini(prompt, apiKey, {
      temperature: 0.2,
      maxOutputTokens: 3072,
      responseMimeType: "application/json",
      responseJsonSchema: ATS_JSON_SCHEMA
    });

    return normalizeATSResult(parseJsonSafely(raw, "Could not parse ATS score response. Please try again."));
  } catch (_) {
    const fallbackPrompt = `${prompt}

Respond with ONLY valid JSON in this exact shape:
{
  "score": 0,
  "grade": "Excellent",
  "matched_keywords": ["keyword 1"],
  "missing_keywords": ["keyword 2"],
  "suggestions": "Short actionable paragraph"
}`;

    const raw = await callGemini(fallbackPrompt, apiKey, {
      temperature: 0.1,
      maxOutputTokens: 2048
    });

    try {
      return normalizeATSResult(parseJsonSafely(raw, "Could not parse ATS score response. Please try again."));
    } catch (_) {
      const labeledPrompt = `${prompt}

Respond in exactly this plain-text format:
Score: <0-100>
Grade: <Excellent|Good|Fair|Poor>
Matched Keywords: keyword 1, keyword 2, keyword 3
Missing Keywords: keyword 4, keyword 5, keyword 6
Suggestions: <one short actionable paragraph>`;

      const labeledRaw = await callGemini(labeledPrompt, apiKey, {
        temperature: 0.1,
        maxOutputTokens: 1024
      });

      return parseLabeledATSResponse(labeledRaw);
    }
  }
}
