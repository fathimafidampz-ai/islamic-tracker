import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jylcyinyaqdeknrlanef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bGN5aW55YXFkZWtucmxhbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTY3NDEsImV4cCI6MjA5NjgzMjc0MX0.nDs1HSi-qatLOSbYb1zwnU2diyo_MWP-ZCEJuUat41s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Test insert with a random user UUID to see the error
  console.log("Testing insert into worship_records...");
  const fakeUserId = 'd3b07384-d113-4e4e-9c7a-111111111111'; // valid UUID format
  const { data, error } = await supabase.from('worship_records').insert({
    user_id: fakeUserId,
    record_date: '2026-06-19'
  }).select();

  if (error) {
    console.error("INSERT ERROR CODE:", error.code);
    console.error("INSERT ERROR MESSAGE:", error.message);
    console.error("INSERT ERROR DETAILS:", error.details);
  } else {
    console.log("Insert success!", data);
    // Cleanup
    await supabase.from('worship_records').delete().eq('user_id', fakeUserId);
  }
}

run();
