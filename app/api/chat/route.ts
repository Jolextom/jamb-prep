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

type TutorBucket =
  | "algorithmic"
  | "factual"
  | "rule_based_language"
  | "inference";

interface ChatMessage {
  role: "user" | "assistant" | string;
  content: string;
}

interface SimilarCandidate {
  q?: string;
  yr?: string;
  topic?: string;
  sub_topic?: string;
  o?: Record<string, string>;
  a?: string;
}

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

function toSseStreamFromText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload =
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n` +
    "data: [DONE]\n\n";

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function normalizeSimilarityText(value: unknown): string {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tryDatabaseChallenge(
  context: Record<string, unknown>,
  userQuery: string,
  messages: ChatMessage[],
): string | null {
  const q = userQuery.toLowerCase();

  const asksForChallenge =
    /(challenge|quiz|test|give me a question|ask me|practice question|try this)/.test(
      q,
    ) ||
    (/(give|ask|test|practice|challenge)/.test(q) &&
      /question|me|another/.test(q));

  if (!asksForChallenge) return null;

  const similarCandidates = Array.isArray(context.similarCandidates)
    ? (context.similarCandidates as SimilarCandidate[])
    : [];

  if (similarCandidates.length === 0) {
    return null;
  }

  // Extract question texts already mentioned in chat
  const discussedQuestionTexts = new Set<string>();
  messages.forEach((msg) => {
    const normalized = String(msg.content || "")
      .toLowerCase()
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalized.length > 20) {
      discussedQuestionTexts.add(normalized.slice(0, 150));
    }
  });

  // Find first candidate not yet discussed
  const contextTopic = normalizeSimilarityText(context.topic || "").toLowerCase();
  const contextSubTopic = normalizeSimilarityText(context.sub_topic || "").toLowerCase();
  const contextQuestion = normalizeSimilarityText(context.q || context.question || "").toLowerCase();
  const contextTokens = new Set(
    contextQuestion
      .split(/\s+/)
      .filter((w) => w.length >= 4),
  );

  const rankedCandidates = similarCandidates
    .map((cand) => {
      const qNorm = String(cand.q || "")
        .toLowerCase()
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150);

      const isDiscussed = discussedQuestionTexts.has(qNorm);
      const hasFullOptions =
        Boolean(cand.o?.a) &&
        Boolean(cand.o?.b) &&
        Boolean(cand.o?.c) &&
        Boolean(cand.o?.d);

      const candTopic = normalizeSimilarityText(cand.topic || "").toLowerCase();
      const candSubTopic = normalizeSimilarityText(cand.sub_topic || "").toLowerCase();
      const candQuestion = normalizeSimilarityText(cand.q || "").toLowerCase();
      const candTokens = new Set(
        candQuestion
          .split(/\s+/)
          .filter((w) => w.length >= 4),
      );

      let overlap = 0;
      contextTokens.forEach((token) => {
        if (candTokens.has(token)) overlap += 1;
      });

      const union = new Set([...contextTokens, ...candTokens]).size || 1;
      const jaccard = overlap / union;

      let rank = jaccard * 100;
      if (contextTopic && candTopic === contextTopic) rank += 18;
      if (contextSubTopic && candSubTopic === contextSubTopic) rank += 16;

      return { cand, isDiscussed, hasFullOptions, rank };
    })
    .filter((entry) => !entry.isDiscussed && entry.hasFullOptions)
    .sort((a, b) => b.rank - a.rank);

  const uniqueCandidate = rankedCandidates[0]?.cand;

  if (!uniqueCandidate) {
    return null; // No more unasked questions; let AI generate one
  }

  const qText = normalizeSimilarityText(uniqueCandidate.q || "");
  const options = [
    uniqueCandidate.o?.a,
    uniqueCandidate.o?.b,
    uniqueCandidate.o?.c,
    uniqueCandidate.o?.d,
  ]
    .filter((opt) => opt)
    .map((opt) => normalizeSimilarityText(String(opt || "")));

  if (options.length < 4) {
    return null; // Incomplete options; skip and let AI generate
  }

  let optionsText = "";
  const optLetters = ["A", "B", "C", "D"];
  options.forEach((opt, i) => {
    optionsText += `${optLetters[i]}. ${opt}\n`;
  });

  const year = uniqueCandidate.yr ? ` [${uniqueCandidate.yr}]` : "";
  const topic = normalizeSimilarityText(uniqueCandidate.topic || "");
  const subTopic = normalizeSimilarityText(uniqueCandidate.sub_topic || "");
  const categoryTail = topic
    ? ` | ${topic}${subTopic ? ` > ${subTopic}` : ""}`
    : "";

  return (
    `[!TIP] Challenge Question${year}${categoryTail}\n\n` +
    `${qText}\n\n` +
    `${optionsText}\n` +
    `Pick A, B, C, or D.`
  );
}

function tryBuildSimilarityReply(
  context: Record<string, unknown>,
  userQuery: string,
  messages: ChatMessage[],
): string | null {
  const similarCandidates = Array.isArray(context.similarCandidates)
    ? (context.similarCandidates as SimilarCandidate[])
    : [];

  const stats =
    context.similarStats && typeof context.similarStats === "object"
      ? (context.similarStats as Record<string, unknown>)
      : {};

  const exactCount = Number(stats.exactCount || 0);
  const similarCount = Number(
    stats.similarCandidateCount || similarCandidates.length,
  );
  const bankSize = Number(stats.bankSize || 0);
  const source = String(stats.source || "session_subset");

  const q = userQuery.toLowerCase();
  const trail = messages
    .slice(-8)
    .map((m) => String(m.content || "").toLowerCase())
    .join(" ");

  const asksExactCount =
    /how many|number of/.test(q) &&
    /(exact|same)/.test(q) &&
    /question/.test(q);

  const asksSimilarCount =
    ((/how many|number of/.test(q) || /any more|more/.test(q)) &&
      /(similar|related|like this)/.test(q) &&
      /question/.test(q)) ||
    (/similar questions?/.test(q) && /any more|more/.test(q));

  const asksList =
    ((/(list|show|give)/.test(q) &&
      /(questions|them|those|out)/.test(q) &&
      (/(similar|exact|like this|main)/.test(q) ||
        /(similar|exact|like this|main)/.test(trail))) ||
      (/main similar questions?/.test(q)) ||
      (/similar questions?/.test(q) && /show|list/.test(q)));

  if (!asksExactCount && !asksSimilarCount && !asksList) {
    return null;
  }

  if (asksExactCount) {
    const bankInfo = bankSize > 0 ? ` in the current loaded bank (${bankSize} questions)` : "";
    const sourceInfo =
      source === "full_subject_bank"
        ? "subject-wide"
        : "session-only";
    return `Exact-match check (${sourceInfo})${bankInfo}: I found ${exactCount} more question(s) with the same wording. I found ${similarCount} close similar question(s) available for comparison.`;
  }

  if (asksSimilarCount) {
    const sourceInfo =
      source === "full_subject_bank"
        ? "from the full loaded subject bank"
        : "from your current session subset";
    return `I found ${similarCount} close similar question(s) ${sourceInfo}. Exact same-wording matches: ${exactCount}.`;
  }

  if (asksList) {
    if (similarCandidates.length === 0) {
      return "I could not find grounded similar questions in the current context. Try asking from a subject with a loaded full bank or open another question first.";
    }

    const lines = similarCandidates.slice(0, 8).map((item, idx) => {
      const text = normalizeSimilarityText(item.q).slice(0, 140);
      const year = item.yr ? ` [${item.yr}]` : "";
      const topic = normalizeSimilarityText(item.topic || "");
      const subTopic = normalizeSimilarityText(item.sub_topic || "");
      const tail = topic
        ? ` (${topic}${subTopic ? ` > ${subTopic}` : ""})`
        : "";
      return `${idx + 1}. ${text}${year}${tail}`;
    });

    return `Here are the nearest grounded similar questions from the loaded bank:\n${lines.join("\n")}`;
  }

  return null;
}

function tryDatabaseMetadataReply(
  context: Record<string, unknown>,
  userQuery: string,
): string | null {
  const similarCandidates = Array.isArray(context.similarCandidates)
    ? (context.similarCandidates as SimilarCandidate[])
    : [];

  if (similarCandidates.length === 0) return null;

  const q = userQuery.toLowerCase();
  const asksYear =
    /(which year|what year|year(s)? are|year(s)? did|in what year)/.test(q);
  const asksJambSource =
    /(are.*jamb|is.*jamb|actual jamb|from the jamb|from jamb|jamb database)/.test(q);

  if (!asksYear && !asksJambSource) return null;

  const topItems = similarCandidates.slice(0, 6);
  const lines = topItems.map((item, idx) => {
    const text = normalizeSimilarityText(item.q).slice(0, 110);
    const year = item.yr ? item.yr : "year not shown";
    const topic = normalizeSimilarityText(item.topic || "");
    const subTopic = normalizeSimilarityText(item.sub_topic || "");
    const tail = topic ? ` | ${topic}${subTopic ? ` > ${subTopic}` : ""}` : "";
    return `${idx + 1}. ${year}: ${text}${tail}`;
  });

  const jambAnswer = asksJambSource
    ? "Yes. These are grounded from the loaded JAMB question bank, not invented by the AI."
    : "";

  const yearAnswer = asksYear
    ? `The visible years for the current similar questions are:\n${lines.join("\n")}`
    : "";

  return [jambAnswer, yearAnswer].filter(Boolean).join("\n\n");
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
    let epochRaw = await redis.get(epochKey);
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

  const metadataReply = tryDatabaseMetadataReply(context, userQuery);
  if (metadataReply) {
    return new NextResponse(toSseStreamFromText(metadataReply), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Try database-first challenge: use real JAMB questions
  const databaseChallenge = tryDatabaseChallenge(
    context,
    userQuery,
    messages as ChatMessage[],
  );

  if (databaseChallenge) {
    return new NextResponse(toSseStreamFromText(databaseChallenge), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Check if user is asking for a challenge but we ran out of JAMB questions
  const q = String(userQuery || "").toLowerCase();
  const asksForChallenge =
    /(challenge|quiz|test|give me a question|ask me|practice question|try this)/.test(
      q,
    ) ||
    (/(give|ask|test|practice|challenge)/.test(q) &&
      /question|me|another/.test(q));

  const isChallengeSought = asksForChallenge;
  const deterministicSimilarityReply = tryBuildSimilarityReply(
    context,
    userQuery,
    messages as ChatMessage[],
  );

  if (deterministicSimilarityReply) {
    return new NextResponse(toSseStreamFromText(deterministicSimilarityReply), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const bucket = classifyTutorBucket(context, userQuery);
  const bucketInstruction = buildBucketInstruction(bucket);

  const challengeInstruction = isChallengeSought
    ? `CHALLENGE MODE (fallback): Only if you've exhausted the database questions, generate a new, original quiz question on the topic: "${String(context.topic || "General")}". Format it exactly like this:\n[!TIP] Challenge Question\n\nQUESTION TEXT (realistic JAMB-style)\n\nA. option text\nB. option text\nC. option text\nD. option text\n\nMake it test specific knowledge. Do not repeat the current question.`
    : "";

  const systemPrompt = `Elite JAMB Coach DNA:
- Acc: 99.9% | Speed: 2x | Tone: Expert Mentor.
- Context: ${questionContext}
- Rules: 
  1. Truth Guardrail: If "sol" in context contradicts "a", trust "sol". 
  2. Tone: Tactical mentor. Bold key terms. Max 2 short paragraphs unless user asks for deeper detail.
  3. Cost Discipline: Keep output concise, avoid repetition, and avoid unnecessary examples.
  4. Scope: ${isChallengeSought ? "Prioritize real JAMB questions from database. Only generate new questions if the database is exhausted." : "Answer the current question only; do not create extra practice questions unless user asks."}
  5. Mode: ${bucketInstruction}${challengeInstruction ? `\n  6. ${challengeInstruction}` : ""}`;

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
