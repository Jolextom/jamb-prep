import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const dynamic = 'force-dynamic';

const RATE_FILE = path.join(process.cwd(), "rate_limit.json");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "jamb_secret_2025";

interface RateData {
  date: string;
  count: number;
  history: any[];
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const reset = searchParams.get("reset");

  if (key !== ADMIN_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let data: RateData = { date: new Date().toISOString().slice(0, 10), count: 0, history: [] };
  let isReadOnly = false;
  let isRedis = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);

  // Try Redis first
  const redisData = await redisGet();
  if (redisData) {
    data = redisData;
  } else if (fs.existsSync(RATE_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(RATE_FILE, "utf-8"));
    } catch (e) {
      console.error("Error reading rate file:", e);
    }
  }

  if (reset === "1") {
    data.count = 0;
    if (isRedis) {
      await redisSet(data);
    } else {
      try {
        fs.writeFileSync(RATE_FILE, JSON.stringify(data, null, 2));
      } catch (e) {
        isReadOnly = true;
      }
    }
    // Redirect back to admin dashboard to clear the reset param
    const errParam = isReadOnly ? '&err=readonly' : '';
    return new NextResponse(null, {
      status: 302,
      headers: { Location: `/api/admin?key=${key}${errParam}` },
    });
  }

  // Simple HTML Dashboard for easy viewing on mobile/web
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>JAMB AI Admin 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; background: #f0f7ff; color: #003366; }
          .card { background: white; padding: 20px; border-radius: 12px; border: 1px solid #c8d8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          h1 { margin-top: 0; font-size: 20px; border-bottom: 2px solid #003366; padding-bottom: 10px; }
          .stat { font-size: 32px; font-weight: 800; margin: 20px 0; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
          .badge-warn { background: #fff7ed; color: #9a3412; border: 1px solid #ffedd5; }
          .history-item { border-bottom: 1px solid #eee; padding: 10px 0; font-size: 13px; }
          .history-item:last-child { border-bottom: none; }
          .name { font-weight: 700; color: #0055a5; }
          .time { font-size: 11px; opacity: 0.6; }
          .question { color: #555; margin-top: 4px; font-style: italic; }
          .btn-reset { display: inline-block; background: #cc0000; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-bottom: 20px; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>JAMB AI Usage Monitor 2026</h1>
          <div style="font-size: 11px; opacity: 0.7;">Date: ${data.date}</div>
          <div class="stat">${data.count} / 200 requests</div>
          
          ${isRedis ? '<div class="badge" style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;">✓ Cloud Priority: Upstash Redis Active</div>' : ''}
          ${searchParams.get('err') === 'readonly' && !isRedis ? '<div class="badge badge-warn">⚠️ Ephemeral Storage (Vercel): Data will reset on server restart</div>' : ''}

          <a href="/api/admin?key=${key}&reset=1" class="btn-reset" onclick="return confirm('Reset count to zero?')">Reset Daily Limit</a>
          
          <h2>Recent Activity (Last 100)</h2>
          ${data.history && data.history.length > 0 ? data.history.map((h: any) => `
            <div class="history-item">
              <span class="name">${h.name}</span> <span class="time">at ${h.time}</span>
              <div class="question">${h.question}</div>
            </div>
          `).join('') : '<div style="color: #888;">No history yet today.</div>'}
        </div>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
