import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jylcyinyaqdeknrlanef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bGN5aW55YXFkZWtucmxhbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTY3NDEsImV4cCI6MjA5NjgzMjc0MX0.nDs1HSi-qatLOSbYb1zwnU2diyo_MWP-ZCEJuUat41s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = `test_${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log("Signing up temporary user...");
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error("Sign up error:", signUpError);
    return;
  }

  const userId = signUpData.user.id;
  console.log("Logged in user ID:", userId);

  // 1. Insert a record
  const todayStr = '2026-06-19';
  const { data: insertRec, error: recError } = await supabase.from('worship_records').insert({
    user_id: userId,
    record_date: todayStr
  }).select().single();

  if (recError) {
    console.error("Record insert error:", recError);
    return;
  }
  console.log("Inserted Record ID:", insertRec.id);

  // 2. Insert a completion
  const { data: insertComp, error: compError } = await supabase.from('task_completions').insert({
    worship_record_id: insertRec.id,
    task_id: 'fajr_fard',
    is_completed: true,
    count_reached: 0
  }).select();

  if (compError) {
    console.error("Completion insert error:", compError);
  } else {
    console.log("Inserted Completion:", insertComp);
  }

  // 3. Now simulate Analytics.jsx fetch
  console.log("Simulating Analytics fetch...");
  const { data: rData, error: rFetchError } = await supabase.from('worship_records').select('*').eq('user_id', userId);
  if (rFetchError) console.error("Rec Fetch Error:", rFetchError);
  
  if (rData && rData.length > 0) {
    const recordIds = rData.map(r => r.id);
    const { data: cData, error: cFetchError } = await supabase.from('task_completions').select('*').in('worship_record_id', recordIds);
    if (cFetchError) console.error("Comp Fetch Error:", cFetchError);
    console.log("Simulated Fetch completions:", cData);
  }

  // Clean up
  console.log("Cleaning up...");
  await supabase.from('worship_records').delete().eq('user_id', userId);
}

run();
