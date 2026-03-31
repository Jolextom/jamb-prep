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
  history: { type: 'chat' | 'session' | 'feedback', name: string, time: string, detail: any }[];
  reports?: { id: number, subject: string, type: string, comment: string, time: string, name: string }[];
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

  let data: RateData = { date: new Date().toISOString().slice(0, 10), count: 0, sessionCount: 0, history: [], reports: [] };
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
      await redisSet({ ...data, count: 0, sessionCount: 0, history: [], reports: [] });
    } else {
      try {
        fs.writeFileSync(RATE_FILE, JSON.stringify({ ...data, count: 0, sessionCount: 0, history: [], reports: [] }, null, 2));
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
        <title>JAMB Prep Admin 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #003366;
            --success: #059669;
            --danger: #ef4444;
            --warning: #f59e0b;
            --bg: #f8fafc;
            --text: #0f172a;
            --muted: #64748b;
          }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Outfit', sans-serif; 
            padding: 20px; 
            background: var(--bg); 
            color: var(--text); 
            margin: 0; 
            -webkit-font-smoothing: antialiased;
          }
          .container { max-width: 1000px; margin: 0 auto; }
          
          /* Header Styling */
          .header { 
            display: flex; 
            align-items: center; 
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 20px;
            background: white;
            border-radius: 20px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .logo-group { display: flex; align-items: center; gap: 15px; }
          .logo-circle { 
            width: 45px; 
            height: 45px; 
            background: var(--primary); 
            color: white; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-weight: 900; 
            font-size: 10px;
            box-shadow: 0 4px 12px rgba(0, 51, 102, 0.3);
          }
          .logo-text h1 { margin: 0; font-size: 18px; font-weight: 900; color: var(--primary); }
          .logo-text p { margin: 0; font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

          /* KPI Section */
          .kpi-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
          }
          .kpi-card { 
            background: white; 
            padding: 24px; 
            border-radius: 20px; 
            border: 1px solid #e2e8f0; 
            display: flex; 
            flex-direction: column;
            gap: 8px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
          .kpi-val { font-size: 36px; font-weight: 900; color: var(--primary); line-height: 1; }
          .kpi-lab { font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
          .kpi-icon { font-size: 24px; margin-bottom: 5px; }

          /* Content Sections */
          .section-card { 
            background: white; 
            border-radius: 24px; 
            border: 1px solid #e2e8f0; 
            overflow: hidden; 
            margin-bottom: 30px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
          }
          .section-header { 
            padding: 20px 24px; 
            background: #fff; 
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .section-title { margin: 0; font-size: 16px; font-weight: 800; color: var(--text); display: flex; align-items: center; gap: 10px; }
          .section-body { padding: 4px; }

          /* History Items */
          .item { 
            display: flex; 
            align-items: flex-start; 
            padding: 16px 20px; 
            border-bottom: 1px solid #f1f5f9; 
            gap: 16px;
            transition: background 0.2s;
          }
          .item:hover { background: #f8fafc; }
          .item:last-child { border-bottom: none; }
          .icon-box { 
            width: 40px; 
            height: 40px; 
            border-radius: 12px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            flex-shrink: 0; 
            font-size: 18px;
          }
          .icon-chat { background: #eff6ff; color: #3b82f6; }
          .icon-session { background: #fffbeb; color: #f59e0b; }
          .icon-feedback { background: #ecfdf5; color: #10b981; }
          .icon-report { background: #fef2f2; color: #ef4444; }

          .content { flex: 1; min-width: 0; }
          .top-line { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
          .item-name { font-weight: 700; font-size: 14px; color: var(--text); }
          .item-time { font-size: 12px; color: var(--muted); font-weight: 500; }
          .item-detail { font-size: 13px; color: #475569; font-weight: 500; line-height: 1.5; }
          .badge { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }

          /* Utils */
          .btn-reset { 
            padding: 10px 20px; 
            border-radius: 12px; 
            background: var(--danger); 
            color: white; 
            text-decoration: none; 
            font-weight: 800; 
            font-size: 13px;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
          }
          .btn-reset:hover { background: #dc2626; transform: scale(1.05); }
          .empty { padding: 40px; text-align: center; color: var(--muted); font-weight: 500; font-size: 14px; }
          
          @media (max-width: 600px) {
            .header { flex-direction: column; gap: 20px; text-align: center; }
            .logo-group { flex-direction: column; gap: 10px; }
            .stats-grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <div class="logo-group">
              <div class="logo-circle">JAMB</div>
              <div class="logo-text">
                <h1>Admin Dashboard</h1>
                <p>UTME 2026 AI Oversight</p>
              </div>
            </div>
            <div style="display: flex; gap: 12px;">
              <a href="/api/admin?key=${key}&reset=1" class="btn-reset" onclick="return confirm('Reset all daily metrics?')">Reset Day</a>
            </div>
          </header>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-val">${data.count || 0}</div>
              <div class="kpi-lab">AI Requests</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${data.sessionCount || 0}</div>
              <div class="kpi-lab">Total Sessions</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${data.reports?.length || 0}</div>
              <div class="kpi-lab">Data Reports</div>
            </div>
            <div class="kpi-card" style="border-color: #10b98122; background: #ecfdf544;">
              <div class="kpi-val" style="color: var(--success);">${data.history?.filter(h => h.type === 'feedback').length || 0}</div>
              <div class="kpi-lab">Feedbacks</div>
            </div>
          </div>

          <!-- Question Reports Section -->
          <div class="section-card" style="border-top: 4px solid var(--danger);">
            <div class="section-header">
              <h2 class="section-title">Question Reports</h2>
              <span class="badge" style="background: #fef2f2; color: var(--danger);">${data.reports?.length || 0} Issues</span>
            </div>
            <div class="section-body">
              ${data.reports && data.reports.length > 0 ? data.reports.map((r: any) => `
                <div class="item">
                  <div class="content">
                    <div class="top-line">
                      <span class="item-name">${r.name || 'Student'} flaged #${r.id} (${r.subject || 'Unknown'})</span>
                      <span class="item-time">${r.time || ''}</span>
                    </div>
                    <div class="item-detail">
                      <span style="display: block; font-weight: 800; font-size: 11px; margin-bottom: 4px; color: var(--danger);">${r.type}</span>
                      "${r.comment || 'No comment'}"
                    </div>
                  </div>
                </div>
              `).join('') : '<div class="empty">Question bank looks clean! No pending reports.</div>'}
            </div>
          </div>

          <!-- Student Feedback Section -->
          <div class="section-card" style="border-top: 4px solid var(--success);">
            <div class="section-header">
              <h2 class="section-title">Student Feedback</h2>
              <span class="badge" style="background: #ecfdf5; color: var(--success);">${data.history?.filter(h => h.type === 'feedback').length || 0} New</span>
            </div>
            <div class="section-body">
              ${data.history && data.history.filter(h => h.type === 'feedback').length > 0 ? data.history.filter(h => h.type === 'feedback').map((f: any) => `
                <div class="item">
                  <div class="content">
                    <div class="top-line">
                      <span class="item-name">${f.name || 'Anonymous'}</span>
                      <span class="item-time">${f.time || ''}</span>
                    </div>
                    <div class="item-detail">
                       <span style="display: block; font-weight: 800; font-size: 11px; margin-bottom: 4px; color: var(--success);">${(f.detail as any)?.type || 'General'}</span>
                       "${(f.detail as any)?.comment || ''}"
                    </div>
                  </div>
                </div>
              `).join('') : '<div class="empty">No feedback yet. Your students are working hard!</div>'}
            </div>
          </div>

          <!-- Live Activity Feed -->
          <div class="section-card" style="border-top: 4px solid var(--primary);">
            <div class="section-header">
              <h2 class="section-title">Live Activity Feed</h2>
              <span class="item-time">Last 100 entries</span>
            </div>
            <div class="section-body">
              ${data.history && data.history.length > 0 ? data.history.filter(h => h.type !== 'feedback').map((h: any) => `
                <div class="item">
                  <div class="content">
                    <div class="top-line">
                      <span class="item-name">${h.name || 'Candidate'}</span>
                      <span class="item-time">${h.time || ''}</span>
                    </div>
                    <div class="item-detail" style="font-family: monospace; font-size: 12px; color: var(--muted);">
                      ${h.type === 'session' ? 'Started a new JAMB Prep session' : (h.detail || 'Asked AI for help')}
                    </div>
                  </div>
                </div>
              `).join('') : '<div class="empty">Dashboard is live! Waiting for students to connect...</div>'}
            </div>
          </div>

          <footer style="text-align: center; padding: 40px; color: var(--muted); font-size: 13px; font-weight: 600;">
            <p>JAMB Prep Cloud Admin — V2.1 Premium Redesign</p>
            <p style="opacity: 0.5;">Active Date: ${data.date} | Redis Storage: ${isRedis ? 'CONNECTED' : 'LOCAL'}</p>
          </footer>
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

    let data: RateData = { date: today, count: 0, sessionCount: 0, history: [], reports: [] };
    
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
      data = { date: today, count: 0, sessionCount: 0, history: [], reports: [] };
    }

    if (type === 'report') {
      data.reports = [{ ...detail, time, name: name || "Student" }, ...(data.reports || [])].slice(0, 50);
    } else {
      if (type === 'chat') data.count = (data.count || 0) + 1;
      if (type === 'session') data.sessionCount = (data.sessionCount || 0) + 1;
      data.history = [{ type, name: name || "Unknown", time, detail: detail || "" }, ...(data.history || [])].slice(0, 100);
    }

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
