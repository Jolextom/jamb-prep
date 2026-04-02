import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type TutorBucket =
  | "algorithmic"
  | "factual"
  | "rule_based_language"
  | "inference";

function parseContext(questionContext: unknown): Record<string, unknown> {
  if (typeof questionContext === "string") {
    const trimmed = questionContext.trim();
    if (trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        return { q: questionContext };
      }
    }
    return { q: questionContext };
  }
  if (questionContext && typeof questionContext === "object") {
    return questionContext as Record<string, unknown>;
  }
  return {};
}

function classifyTutorBucket(
  context: Record<string, unknown>,
  userQuery: string,
): TutorBucket {
  const subject = String(
    context.s || context.subject || context.examtype || "",
  ).toLowerCase();
  const topic = String(context.topic || context.tp || "").toLowerCase();
  const subTopic = String(
    context.sub_topic || context.subTopic || "",
  ).toLowerCase();
  const questionText = String(
    context.q || context.question || "",
  ).toLowerCase();
  const solutionText = String(
    context.sol || context.solution || "",
  ).toLowerCase();
  const corpus = `${subject} ${topic} ${subTopic} ${questionText} ${solutionText} ${userQuery.toLowerCase()}`;

  const hasPassage =
    corpus.includes("passage") ||
    corpus.includes("paragraph") ||
    corpus.includes("infer") ||
    corpus.includes("theme") ||
    corpus.includes("author") ||
    corpus.includes("tone") ||
    corpus.includes("character") ||
    corpus.includes("plot");

  const hasLanguageRule =
    corpus.includes("grammar") ||
    corpus.includes("concord") ||
    corpus.includes("syntax") ||
    corpus.includes("tense") ||
    corpus.includes("punctuation") ||
    corpus.includes("question tag") ||
    corpus.includes("reported speech") ||
    corpus.includes("subject verb agreement");

  const hasCalculationSignals =
    /[0-9]/.test(corpus) ||
    corpus.includes("calculate") ||
    corpus.includes("solve") ||
    corpus.includes("find the value") ||
    corpus.includes("equation") ||
    corpus.includes("formula") ||
    corpus.includes("simplify") ||
    corpus.includes("substitute") ||
    corpus.includes("stoichiometry") ||
    corpus.includes("kinematics");

  if (hasPassage || subject.includes("literature")) return "inference";
  if (subject.includes("english") && hasLanguageRule)
    return "rule_based_language";
  if (
    (subject.includes("math") ||
      subject.includes("physics") ||
      subject.includes("chemistry")) &&
    hasCalculationSignals
  ) {
    return "algorithmic";
  }
  if (hasLanguageRule) return "rule_based_language";
  if (hasCalculationSignals && !subject.includes("government"))
    return "algorithmic";
  return "factual";
}

function buildBucketInstruction(bucket: TutorBucket): string {
  if (bucket === "algorithmic") {
    return [
      "Tutor Mode: Algorithmic/Calculation.",
      "Output format:",
      "1) Known values",
      "2) Formula or governing rule",
      "3) Substitution and compact steps",
      "4) Final answer and quick verification",
      "Keep steps lean and avoid long derivations unless user asks.",
    ].join(" ");
  }

  if (bucket === "rule_based_language") {
    return [
      "Tutor Mode: Rule-Based Language.",
      "Output format:",
      "1) Name the exact rule",
      "2) Show why the correct option fits the rule",
      "3) Explain why alternatives violate the rule",
      "4) Give up to 2 short everyday examples",
      "Keep examples compact.",
    ].join(" ");
  }

  if (bucket === "inference") {
    return [
      "Tutor Mode: Inference/Comprehension.",
      "Output format:",
      "1) Point to textual evidence",
      "2) Explain reasoning chain",
      "3) Eliminate traps in wrong options",
      "Do not invent evidence not present in context.",
    ].join(" ");
  }

  return [
    "Tutor Mode: Factual Recall.",
    "Output format:",
    "1) State correct fact",
    "2) Eliminate wrong options clearly",
    "3) Give one brief memory hook",
    "Keep to high-signal facts only.",
  ].join(" ");
}

async function checkAndIncrementUserRate(
  name: string,
  question: string,
): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!url) return true; // No rate limit if Redis is not configured

  const cleanName = (name || "Unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
  const epochKey = "jolextom_rate_limit_epoch";
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

    // Epoch lets admin global reset invalidate all old per-user keys instantly.
    const epochRaw = await redis.get(epochKey);
    let epoch = Number(epochRaw || 1);
    if (!Number.isFinite(epoch) || epoch < 1) {
      epoch = 1;
      await redis.set(epochKey, epoch);
    }

    const userKey = `jolextom_rate_limit_v${epoch}_${cleanName}`;

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

  // Keep a short window to control token cost.
  const recentMessages = messages.slice(-4);

  const context = parseContext(questionContext);
  const bucket = classifyTutorBucket(context, userQuery);
  const bucketInstruction = buildBucketInstruction(bucket);
  const policyInstruction = `Use the supplied question context and any candidate examples to answer naturally. If the user asks for a similar question, harder question, quiz, year, source, or whether it is a JAMB question, handle it in a grounded way from the provided context. Prefer real JAMB items if they are present in the context. If you must create a fallback practice item, clearly label it as not from the JAMB database. When rendering any math, use LaTeX delimiters such as \( ... \) or \[ ... \].`;

  const systemPrompt = `Elite JAMB Coach DNA:
- Acc: 99.9% | Speed: 2x | Tone: Expert Mentor.
- Context: ${questionContext}
- Rules: 
  1. Truth Guardrail: If "sol" in context contradicts "a", trust "sol". 
  2. Tone: Tactical mentor. Bold key terms. Max 2 short paragraphs unless user asks for deeper detail.
  3. Cost Discipline: Keep output concise, avoid repetition, and avoid unnecessary examples.
  4. Scope: Answer the current question only; do not create extra practice questions unless the user asks.
  5. Mode: ${bucketInstruction}
  6. ${policyInstruction}`;

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
        max_tokens: 500,
        temperature: 0.35,
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
