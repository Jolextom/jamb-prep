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
  count: number;         // AI requests count
  sessionCount: number;  // Usage starts count
  history: { type: 'chat' | 'session', name: string, time: string, detail: string }[];
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

  let data: RateData = { date: new Date().toISOString().slice(0, 10), count: 0, sessionCount: 0, history: [] };
  let isReadOnly = false;
  let isRedis = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);

  // Try Redis first
  const redisData = await redisGet();
  if (redisData) {
    data = { ...data, ...redisData };
  } else if (fs.existsSync(RATE_FILE)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(RATE_FILE, "utf-8"));
      data = { ...data, ...fileData };
    } catch (e) {
      console.error("Error reading rate file:", e);
    }
  }

  if (reset === "1") {
    if (isRedis) {
      await redisSet({ ...data, count: 0, sessionCount: 0, history: [] });
    } else {
      try {
        fs.writeFileSync(RATE_FILE, JSON.stringify({ ...data, count: 0, sessionCount: 0, history: [] }, null, 2));
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
          .stat-box { margin: 20px 0; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; text-align: center; }
          .stat-val { font-size: 28px; font-weight: 800; color: #003366; }
          .stat-lab { font-size: 10px; font-weight: bold; color: #64748b; margin-top: 4px; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; margin-right: 8px; }
          .badge-warn { background: #fff7ed; color: #9a3412; border: 1px solid #ffedd5; }
          .badge-chat { background: #dcfce7; color: #166534; }
          .badge-session { background: #e0f2fe; color: #0369a1; }
          .history-item { border-bottom: 1px solid #eee; padding: 12px 0; font-size: 13px; }
          .history-item:last-child { border-bottom: none; }
          .name { font-weight: 700; color: #003366; }
          .time { font-size: 11px; opacity: 0.6; }
          .detail { color: #555; margin-top: 4px; font-style: italic; font-size: 12px; }
          .btn-reset { display: block; width: 100%; text-align: center; background: #ef4444; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 20px; border: none; cursor: pointer; box-sizing: border-box; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>JAMB AI Usage Monitor 2026</h1>
          <div style="font-size: 11px; opacity: 0.7;">Date: ${data.date}</div>
          <div style="display: flex; gap: 20px;">
            <div class="stat-box">
              <div class="stat-val">${data.count || 0}</div>
              <div class="stat-lab">AI CHATS</div>
            </div>
            <div class="stat-box">
              <div class="stat-val">${data.sessionCount || 0}</div>
              <div class="stat-lab">SESSIONS</div>
            </div>
          </div>
          
          ${isRedis ? '<div class="badge" style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;">✓ Cloud Priority: Upstash Redis Active</div>' : ''}
          ${searchParams.get('err') === 'readonly' && !isRedis ? '<div class="badge badge-warn">⚠️ Ephemeral Storage (Vercel): Data will reset on server restart</div>' : ''}

          <a href="/api/admin?key=${key}&reset=1" class="btn-reset" onclick="return confirm('Reset count to zero?')">Reset Daily Limit</a>
          
          <h2>Recent Activity (Last 100)</h2>
          ${data.history && data.history.length > 0 ? data.history.map((h: any) => `
            <div class="history-item">
              <span class="badge ${h.type === 'session' ? 'badge-session' : 'badge-chat'}">${h.type}</span>
              <span class="name">${h.name}</span> <span class="time">at ${h.time}</span>
              <div class="detail">${h.detail}</div>
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

export async function POST(req: NextRequest) {
  try {
    const { type, name, detail } = await req.json();
    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

    let data: RateData = { date: today, count: 0, sessionCount: 0, history: [] };
    
    const redisData = await redisGet();
    if (redisData) {
      data = { ...data, ...redisData };
    } else if (fs.existsSync(RATE_FILE)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(RATE_FILE, "utf-8"));
        data = { ...data, ...fileData };
      } catch {}
    }

    // Reset if new day
    if (data.date !== today) {
      data = { date: today, count: 0, sessionCount: 0, history: [] };
    }

    if (type === 'chat') data.count++;
    if (type === 'session') data.sessionCount++;

    data.history = [{ type, name: name || "Unknown", time, detail: detail || "" }, ...(data.history || [])].slice(0, 100);

    if (!!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)) {
      await redisSet(data);
    } else {
      try {
        fs.writeFileSync(RATE_FILE, JSON.stringify(data, null, 2));
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to track" }, { status: 500 });
  }
}
