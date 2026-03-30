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
  history: { name: string; time: string; question: string } [];
}

async function redisGet(): Promise<RateData | null> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return null;

  try {
    return await redis.get("jamb_rate_limit");
  } catch (err) {
    console.error("Redis Get Error:", err);
    return null;
  }
}

async function redisSet(data: RateData) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return;

  try {
    await redis.set("jamb_rate_limit", data);
  } catch (err) {
    console.error("Redis Set Error:", err);
  }
}

async function loadRate(): Promise<RateData> {
  // Try Redis first
  const redisData = await redisGet();
  if (redisData) return redisData;

  // Fallback to local file
  try {
    if (fs.existsSync(RATE_FILE)) {
      return JSON.parse(fs.readFileSync(RATE_FILE, "utf-8"));
    }
  } catch {}
  return { date: "", count: 0, history: [] };
}

async function saveRate(data: RateData) {
  // Save to Redis if available
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (url) {
    await redisSet(data);
    return;
  }

  // Otherwise save to local file
  try {
    const dir = path.dirname(RATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RATE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn("Local save failed (expected on Vercel if Redis not setup):", err);
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrementRate(name: string, question: string): Promise<boolean> {
  const today = getTodayString();
  const data = await loadRate();
  const time = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

  // Log to history
  const newEntry = { name: name || "Unknown", time, question: question.replace(/\n/g, " ") };
  const history = [newEntry, ...(data.history || [])].slice(0, 100);

  if (data.date !== today) {
    // New day — reset
    await saveRate({ date: today, count: 1, history });
    return true;
  }

  if (data.count >= DAILY_CAP) {
    return false;
  }

  await saveRate({ date: today, count: data.count + 1, history });
  return true;
}

export async function POST(req: NextRequest) {
  const { messages, questionContext, candidateName } = await req.json();

  const userQuery = messages.length > 0 ? messages[messages.length - 1].content : "Started chat";

  // Rate limit check
  console.log(`[Chat API] Request from ${candidateName} for query: ${userQuery.substring(0, 50)}...`);
  if (!(await checkAndIncrementRate(candidateName, userQuery))) {
    return NextResponse.json(
      { error: "Daily usage limit reached. Please try again tomorrow." },
      { status: 429 }
    );
  }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
  }

  // Keep only last 6 messages to limit token usage
  const recentMessages = messages.slice(-6);

  const systemPrompt = `You are a high-performance JAMB Exam Coach. Your goal is to help students solve questions with extreme speed and accuracy.

QUESTION CONTEXT:
${questionContext}

YOUR STYLE:
1. **Be Conversational**: Act like a real person who knows the shortcuts. Don't use robotic headers like "*Speed First*" or "*The Why*".
2. **Speed is King**: Always aim to show how to get the answer in <30 seconds. Use tricks, keyword association, or elimination as your tactics.
3. **Strategic Elimination**: Only mention specific options if there's a "trick" that makes them obviously wrong or if elimination is the fastest path. Don't waste time narrating the elimination of every option if the direct logic is already clear.
4. **Direct and Punchy**: Small questions get small answers. Complex ones get a quick tactical breakdown. Focus on the core logic.
5. **Authoritative**: Use Nigerian secondary school level English (official, but encouraging).

RULES:
- Limit response to 2-3 concise paragraphs or bullet points max.
- Always be clear about which option is correct.
- Stay strictly on the topic of this specific question.`;

  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...recentMessages,
  ];

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: groqMessages,
      max_tokens: 2048,
      temperature: 0.4,
      stream: true,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("Groq error:", err);
    return NextResponse.json({ error: "AI service error. Please try again." }, { status: 502 });
  }

  // Return the raw readable stream directly to the client
  return new NextResponse(groqRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
