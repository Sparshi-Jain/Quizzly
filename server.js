import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const API_KEY = process.env.OPENAI_API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL   = "openrouter/free";

// ================= AI HELPER =================
async function askAI(prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + API_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Quizzly AI"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });

  const data = await res.json();
  console.log("AI raw response:", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0]) {
    throw new Error(data.error?.message || "No choices in response");
  }

  return data.choices[0].message.content;
}

// ================= JSON CLEANER =================
function extractAndCleanJSON(raw) {
  // 1. Strip markdown fences
  let text = raw.replace(/```(?:json)?/gi, "").trim();

  // 2. Extract the first { ... } block (handles stray text before/after)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response");
  text = match[0];

  // 3. Fix double-quotes before commas/braces  e.g. "value"" , → "value",
  text = text.replace(/""+\s*([,}\]])/g, '"$1');

  // 4. Escape lone backslashes not already part of a valid JSON escape
  //    Catches LaTeX like \( \displaystyle \sum etc.
  text = text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

  return text;
}

// ================= GENERATE QUESTION =================
app.post("/question", async (req, res) => {
  try {
    const { topic } = req.body;

    const prompt = `You are a quiz generator. Generate ONE multiple choice question about ${topic}.

You MUST respond with ONLY this exact JSON format, nothing else:
{"question":"What is X?","options":["A. first option","B. second option","C. third option","D. fourth option"],"answer":"A. first option"}

Rules:
- All 4 options must have full text after A. B. C. D.
- The answer must exactly match one of the options
- No markdown, no explanation, no LaTeX, just plain JSON`;

    const raw  = await askAI(prompt);
    const clean = extractAndCleanJSON(raw);
    const parsed = JSON.parse(clean);

    // Sanity check: answer must be one of the options
    if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length !== 4) {
      throw new Error("Invalid options array in response");
    }
    if (!parsed.options.includes(parsed.answer)) {
      throw new Error(`Answer "${parsed.answer}" does not match any option`);
    }

    res.json({ text: JSON.stringify(parsed) });

  } catch (err) {
    console.error("❌ Question error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= EVALUATE ANSWER =================
app.post("/evaluate", async (req, res) => {
  try {
    const { question, userAnswer, correctAnswer } = req.body;

    const prompt = `Quiz question: ${question}
User answered: ${userAnswer}
Correct answer: ${correctAnswer}

In 2-3 sentences: say if they were correct or not, explain why, and give one tip. Be encouraging.`;

    const feedback = await askAI(prompt);
    res.json({ feedback });

  } catch (err) {
    console.error("❌ Evaluate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Quizzly AI running at http://localhost:${PORT}`);
  console.log(`🔑 API key set: ${API_KEY ? "✅ Yes" : "❌ No — check your .env file!"}\n`);
});