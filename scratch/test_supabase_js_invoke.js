import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testJsInvoke() {
  console.log("Invoking via supabase.functions.invoke...");
  try {
    const { data, error } = await supabase.functions.invoke('line-notify', {
      body: { 
        reportId: '4aff6249-909a-4d8b-bbe4-0caac166e292', 
        status: 'เสร็จสิ้น' 
      }
    });

    console.log("Result:");
    console.log("Data:", data);
    console.log("Error:", error);
  } catch (err) {
    console.error("Exception:", err);
  }
}

testJsInvoke();
