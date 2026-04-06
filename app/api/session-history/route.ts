import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

interface HistoryItem {
  type: "chat" | "session" | "feedback";
  name: string;
  time: string;
  detail: string;
  createdAt?: string;
}

interface PerformanceItem {
  name: string;
  mode: "EXAM" | "PRACTICE";
  status?: "COMPLETED" | "INCOMPLETE";
  score: number;
  jambScore: number;
  breakdown: string[];
  subjects: string[];
  time: string;
  date: string;
  totalQuestions?: number;
  answeredCount?: number;
  candidateId?: string;
  clientSessionId?: string;
  pid?: string;
}

interface RateData {
  history?: HistoryItem[];
  performances?: PerformanceItem[];
}

function normalizeUserKey(name: string) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
}

function parsePerformanceTime(item: Pick<PerformanceItem, "date" | "time">) {
  const ts = Date.parse(`${item.date || ""} ${item.time || ""}`.trim());
  return Number.isNaN(ts) ? 0 : ts;
}

function shouldReplacePerformance(current: PerformanceItem, candidate: PerformanceItem) {
  const currentStatus = current.status || "COMPLETED";
  const candidateStatus = candidate.status || "COMPLETED";

  // If a session moved from incomplete to completed, keep the completed record.
  if (currentStatus !== "COMPLETED" && candidateStatus === "COMPLETED") return true;
  if (currentStatus === "COMPLETED" && candidateStatus !== "COMPLETED") return false;

  return parsePerformanceTime(candidate) >= parsePerformanceTime(current);
}

async function readRateData(): Promise<RateData> {
  const hasRedis = !!(
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  );

  if (!hasRedis) {
    throw new Error("Session history requires Redis configuration.");
  }

  try {
    const data = await redis.get("jamb_rate_limit");
    return (data as RateData) || {};
  } catch (err) {
    console.error("Session history Redis read error:", err);
    throw new Error("Redis read failed for session history.");
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") || "").trim();
  const candidateId = (searchParams.get("cid") || "").trim();
  const summaryOnly = searchParams.get("summaryOnly") === "1";

  const emptyResult = {
    name,
    summary: {
      totalItems: 0,
      sessionResults: 0,
      sessionStarts: 0,
      examResults: 0,
      practiceResults: 0,
    },
    items: [],
  };

  if (!name || !candidateId) {
    return NextResponse.json(emptyResult);
  }

  let data: RateData;
  try {
    data = await readRateData();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Session history backend unavailable.",
      },
      { status: 503 },
    );
  }

  const normalizedName = normalizeUserKey(name);

  const filteredPerformances = (data.performances || [])
    .filter((p) => {
      if (normalizeUserKey(p.name || "") !== normalizedName) return false;
      return (p.candidateId || "") === candidateId;
    });

  const dedupedPerformances: PerformanceItem[] = [];
  const bySessionId = new Map<string, PerformanceItem>();

  for (const p of filteredPerformances) {
    const sessionId = (p.clientSessionId || "").trim();
    if (!sessionId) {
      dedupedPerformances.push(p);
      continue;
    }

    const existing = bySessionId.get(sessionId);
    if (!existing || shouldReplacePerformance(existing, p)) {
      bySessionId.set(sessionId, p);
    }
  }

  const performances = [...Array.from(bySessionId.values()), ...dedupedPerformances]
    .sort((a, b) => parsePerformanceTime(b) - parsePerformanceTime(a))
    .slice(0, 30)
    .map((p) => {
      const total = typeof p.totalQuestions === "number" ? p.totalQuestions : 0;
      const answered =
        typeof p.answeredCount === "number" ? p.answeredCount : 0;
      const scoreLine = total > 0 ? `${p.score}/${total}` : `${p.score}`;
      const status = p.status || "COMPLETED";
      const meta = [
        `Status: ${status}`,
        `Mode: ${p.mode}`,
        `Score: ${scoreLine}`,
        `JAMB: ${p.jambScore}`,
        `Answered: ${answered}`,
      ].join(" | ");

      return {
        kind: "session_result",
        sessionId: p.clientSessionId || "",
        status,
        title:
          status === "INCOMPLETE"
            ? `${p.mode} Session (Incomplete)`
            : `${p.mode} Session`,
        summary: meta,
        subjects: Array.isArray(p.subjects) ? p.subjects : [],
        timestamp: `${p.date || ""} ${p.time || ""}`.trim(),
      };
    });

  const items = [...performances]
    .sort((a, b) => {
      const aTime = Date.parse(a.timestamp);
      const bTime = Date.parse(b.timestamp);
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return bTime - aTime;
    })
    .slice(0, 40);

  const summary = {
    totalItems: items.length,
    sessionResults: performances.length,
    sessionStarts: 0,
    examResults: performances.filter((p) => p.title.startsWith("EXAM")).length,
    practiceResults: performances.filter((p) => p.title.startsWith("PRACTICE"))
      .length,
  };

  if (summaryOnly) {
    return NextResponse.json({
      name,
      summary,
      items: [],
    });
  }

  return NextResponse.json({
    name,
    summary,
    items,
  });
}
