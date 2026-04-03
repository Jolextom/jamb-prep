import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

async function checkAndIncrementUserRate(name: string, question: string): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return true;

  const cleanName = (name || "Unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
  const epochKey = "jolextom_rate_limit_epoch";
  const historyKey = "jolextom_chat_history_v2";

  try {
    const time = new Date().toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await redis.lpush(
      historyKey,
      JSON.stringify({
        name: name || "Unknown",
        time,
        question: question.substring(0, 100),
      }),
    );
    await redis.ltrim(historyKey, 0, 99);

    const epochRaw = await redis.get(epochKey);
    let epoch = Number(epochRaw || 1);
    if (!Number.isFinite(epoch) || epoch < 1) {
      epoch = 1;
      await redis.set(epochKey, epoch);
    }

    const userKey = `jolextom_rate_limit_v${epoch}_${cleanName}`;
    const current = await redis.incr(userKey);
    if (current === 1) {
      await redis.expire(userKey, 86400);
    }

    return current <= 50;
  } catch (err) {
    console.error("Redis Rate Limit Error:", err);
    return true;
  }
}

export async function POST(req: NextRequest) {
  const { messages, questionContext, candidateName } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const userQuery = messages.length > 0 ? messages[messages.length - 1].content : "Started chat";

  if (!(await checkAndIncrementUserRate(candidateName, userQuery))) {
    return NextResponse.json(
      { error: "Daily usage limit reached. Please try again tomorrow." },
      { status: 429 },
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
  }

  const recentMessages = messages.slice(-4);
  const policyInstruction =
    "Use the supplied question context and any candidate examples to answer naturally. If the user asks for a similar question, harder question, quiz, year, source, or whether it is a JAMB question, handle it in a grounded way from the provided context. Prefer real JAMB items if they are present in the context. If you must create a fallback practice item, clearly label it as not from the JAMB database. When rendering any math, use LaTeX delimiters such as \\\\( ... \\\\) or \\\\[ ... \\\\]. Keep quiz responses interactive and do not explain until the user answers unless the user explicitly asks for an explanation.";

  const quizStateInstruction =
    "CRITICAL QUIZ BEHAVIOR:\n" +
    "- When user gives a bare answer (A/B/C/D), map it to the MOST RECENT question ONLY.\n" +
    "- Always echo back: 'Your answer to [question topic]: [letter] is [correct/incorrect]' before explaining.\n" +
    "- Never regress to or re-explain prior questions unless the user explicitly asks.\n" +
    "- If user asks for next question, move forward. Do not repeat prior content.\n" +
    "- Maintain quiz flow: acknowledge current answer, then proceed.";

  const systemPrompt = `Elite JAMB Coach DNA:
- Acc: 99.9% | Speed: 2x | Tone: Expert Mentor.
- Context: ${questionContext}
- Rules:
  1. Truth Guardrail: If "sol" in context contradicts "a", trust "sol".
  2. Tone: Tactical mentor. Bold key terms. Max 2 short paragraphs unless user asks for deeper detail.
  3. Cost Discipline: Keep output concise, avoid repetition, and avoid unnecessary examples.
  4. Scope: Answer the current question only; do not create extra practice questions unless the user asks.
  5. ${policyInstruction}
  6. ${quizStateInstruction}`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, ...recentMessages],
      max_tokens: 500,
      temperature: 0.35,
      stream: true,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("Groq error:", err);
    return NextResponse.json({ error: "AI service error. Please try again." }, { status: 502 });
  }

  return new NextResponse(groqRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
