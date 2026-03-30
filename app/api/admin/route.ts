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

  // Premium HTML Dashboard for beautiful viewing on mobile/web
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>JAMB AI Admin 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; padding: 40px 20px; background: #f8fafc; color: #0f172a; margin: 0; }
          .container { max-width: 800px; margin: 0 auto; }
          .card { background: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          h1 { margin-top: 0; font-size: 24px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 8px; color: #0f172a; }
          .date-row { font-size: 13px; color: #64748b; font-weight: 500; margin-bottom: 24px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .stat-box { background: #f1f5f9; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; transition: transform 0.2s; }
          .stat-box:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .stat-val { font-size: 40px; font-weight: 800; color: #3b82f6; line-height: 1; }
          .stat-lab { font-size: 11px; font-weight: 800; color: #64748b; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
          .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.5px; }
          .badge-warn { background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2; }
          .badge-success { background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; }
          .badge-chat { background: #dbeafe; color: #1e40af; }
          .badge-session { background: #fef3c7; color: #92400e; }
          .history-item { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 12px; background: #ffffff; transition: box-shadow 0.2s; overflow: hidden; }
          .history-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
          .history-header { display: flex; align-items: center; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
          .history-badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-right: 12px; letter-spacing: 0.5px; }
          .name { font-weight: 700; color: #0f172a; font-size: 14px; }
          .time { font-size: 12px; color: #94a3b8; font-weight: 500; margin-left: auto; }
          .detail { padding: 16px; color: #334155; font-size: 14px; line-height: 1.5; font-weight: 500; font-style: italic; }
          .btn-reset { display: block; width: 100%; text-align: center; background: #ef4444; color: white; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 10px; margin-bottom: 32px; border: none; cursor: pointer; transition: background 0.2s; font-size: 14px; }
          .btn-reset:hover { background: #dc2626; }
          h2 { font-size: 18px; font-weight: 800; margin-bottom: 16px; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>JAMB AI Usage Monitor 2026</h1>
            <div class="date-row">Session Date: ${data.date}</div>
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-val">${data.count || 0}</div>
                <div class="stat-lab">AI CHATS</div>
              </div>
              <div class="stat-box">
                <div class="stat-val">${data.sessionCount || 0}</div>
                <div class="stat-lab">SESSIONS</div>
              </div>
            </div>
            
            ${isRedis ? '<div class="badge badge-success">✓ Cloud Priority: Upstash Redis Active</div>' : ''}
            ${searchParams.get('err') === 'readonly' && !isRedis ? '<div class="badge badge-warn">⚠️ Ephemeral Storage (Vercel): Data will reset on server restart</div>' : ''}

            <a href="/api/admin?key=${key}&reset=1" class="btn-reset" onclick="return confirm('Reset count to zero?')">Reset Daily Limit</a>
            
            <h2>Recent Activity (Last 100)</h2>
            <div class="history-list">
              ${data.history && data.history.length > 0 ? data.history.map((h: any) => `
                <div class="history-item">
                  <div class="history-header">
                    <span class="history-badge ${h.type === 'session' ? 'badge-session' : 'badge-chat'}">${h.type || 'chat'}</span>
                    <span class="name">${h.name || 'Unknown'}</span>
                    <span class="time">at ${h.time || ''}</span>
                  </div>
                  <div class="detail">${h.detail || h.question || ''}</div>
                </div>
              `).join('') : '<div style="color: #94a3b8; font-weight: 500;">No history yet today.</div>'}
            </div>
          </div>
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

    if (type === 'chat') data.count = (data.count || 0) + 1;
    if (type === 'session') data.sessionCount = (data.sessionCount || 0) + 1;

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
