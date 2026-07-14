import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve('.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

async function checkDb() {
  console.log("Checking Supabase tables via REST API...");

  try {
    const reportsRes = await fetch(`${supabaseUrl}/rest/v1/reports?select=id,created_at,reporter_name,description,rating&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (reportsRes.ok) {
      const reports = await reportsRes.json();
      console.log("Latest reports in DB:", reports);
    } else {
      console.error("Error reading reports:", reportsRes.status, await reportsRes.text());
    }

    const sessionsRes = await fetch(`${supabaseUrl}/rest/v1/user_sessions?select=*&limit=5`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (sessionsRes.ok) {
      const sessions = await sessionsRes.json();
      console.log("Active sessions in DB:", sessions);
    } else {
      console.error("Error reading user_sessions:", sessionsRes.status, await sessionsRes.text());
    }

  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

checkDb();
