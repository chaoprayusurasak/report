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

async function testInvoke() {
  const functionUrl = `${supabaseUrl}/functions/v1/line-notify`;
  console.log(`Invoking Edge Function at: ${functionUrl}`);
  
  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        reportId: '4aff6249-909a-4d8b-bbe4-0caac166e292',
        status: 'เสร็จสิ้น'
      })
    });

    console.log(`Status: ${res.status}`);
    console.log(`Response headers:`, Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log(`Response body:`, text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testInvoke();
