import fs from 'fs';
import path from 'path';

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
  console.log("Checking Supabase reports...");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/reports?select=*&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (res.ok) {
      const reports = await res.json();
      reports.forEach(r => {
        console.log(`ID: ${r.id}`);
        console.log(`  Name: ${r.reporter_name}`);
        console.log(`  Line ID: ${r.reporter_line_id}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Ref ID: ${r.reference_id}`);
        console.log(`  Description: ${r.description}`);
        console.log(`  Rating: ${r.rating}`);
        console.log("---");
      });
    } else {
      console.error("Error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

checkDb();
