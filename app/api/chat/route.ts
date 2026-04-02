import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const RATE_FILE = path.join(process.cwd(), "rate_limit.json");
const DAILY_CAP = 200; // max requests per day across all users

interface RateData {
  date: string; // YYYY-MM-DD
  count: number;
  history: { name: string; time: string; question: string }[];
}

async function checkAndIncrementUserRate(
  name: string,
  question: string,
): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return true; // No rate limit if Redis is not configured

  const cleanName = (name || "Unknown").trim().replace(/[^a-zA-Z0-9]/g, "_");
  const userKey = `jolextom_rate_limit_${cleanName}`;
  const historyKey = "jolextom_chat_history_v2";

  try {
    // 1. Log to the global history list (LPOP/RPUSH pattern is best for Redis but we'll stick to a list)
    const time = new Date().toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const logEntry = JSON.stringify({
      name: name || "Unknown",
      time,
      question: question.substring(0, 100),
    });
    await redis.lpush(historyKey, logEntry);
    await redis.ltrim(historyKey, 0, 99); // Keep only last 100 entries

    // 2. Increment user counter
    // INCR returns the value AFTER incrementing
    const current = await redis.incr(userKey);

    // 3. If new key (current === 1), set expiration (86400s = 1 day)
    if (current === 1) {
      await redis.expire(userKey, 86400);
    }

    // A limit of 50 per user per day is much more reasonable than 200 shared by everyone
    if (current > 50) return false;
    return true;
  } catch (err) {
    console.error("Redis Rate Limit Error:", err);
    return true; // don't block users if Redis is failing
  }
}

export async function POST(req: NextRequest) {
  const { messages, questionContext, candidateName } = await req.json();

  const userQuery =
    messages.length > 0
      ? messages[messages.length - 1].content
      : "Started chat";

  // Rate limit check
  console.log(
    `[Chat API] Request from ${candidateName} for query: ${userQuery.substring(0, 50)}...`,
  );
  if (!(await checkAndIncrementUserRate(candidateName, userQuery))) {
    return NextResponse.json(
      { error: "Daily usage limit reached. Please try again tomorrow." },
      { status: 429 },
    );
  }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service not configured." },
      { status: 500 },
    );
  }

  // Keep only last 6 messages to limit token usage
  const recentMessages = messages.slice(-6);

  // Subject Extraction Logic
  let subjectGuide =
    "Provide a logical breakdown and a helpful 'Speed Hack' or 'Pro Tip'.";
  let subjectName = "General";

  try {
    let context;
    if (
      typeof questionContext === "string" &&
      questionContext.trim().startsWith("{")
    ) {
      context = JSON.parse(questionContext);
    } else {
      // Handle legacy string format or simple string
      context = { q: questionContext };
    }

    // Support both long and short keys: 'subject'/'s' or 'examtype'
    subjectName = context.s || context.subject || context.examtype || "General";
    const subjectLower = subjectName.toLowerCase();

    if (subjectLower.includes("english")) {
      subjectGuide = `Focus: Phonics (IPA), Concord, Lexis. Explaining vowel/consonant symbols is high-value. Avoid 'homophone' unless identical.`;
    } else if (subjectLower.includes("math") || subjectLower.includes("phys")) {
      subjectGuide = `Focus on formula application and "Calculative Shortcuts". 
      - Show how to eliminate options by looking at the last digit or unit magnitude.
      - Keep calculation steps extremely lean.`;
    } else if (
      subjectLower.includes("govt") ||
      subjectLower.includes("history") ||
      subjectLower.includes("crk")
    ) {
      subjectGuide = `Focus on historical context and "Keyword Association". 
      - Link dates/names to the core principle. 
      - Explain the 'Why' behind a policy or event simply.`;
    }
  } catch (e) {
    console.warn(
      "[Chat API] Failed to parse questionContext for subject awareness.",
    );
  }

  const systemPrompt = `Elite JAMB Coach DNA:
- Acc: 99.9% | Speed: 2x | Tone: Expert Mentor.
- Context: ${questionContext}
- Rules: 
  1. Truth Guardrail: If "sol" in context contradicts "a", trust "sol". 
  2. Tone: Tactical mentor. Bold key terms. Max 2 brief paragraphs. Be punchy. No filler.
  3. Speed Hack ⚡: Use only when it materially helps and keep it brief.
  4. Scope: Answer the question at hand. Do not generate similar questions or follow-ups.`;

  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...recentMessages,
  ];

  const groqRes = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        max_tokens: 800, // Increased room for deep explanations
        temperature: 0.5,
        stream: true,
      }),
    },
  );

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("Groq error:", err);
    return NextResponse.json(
      { error: "AI service error. Please try again." },
      { status: 502 },
    );
  }

  // Return the raw readable stream directly to the client
  return new NextResponse(groqRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
