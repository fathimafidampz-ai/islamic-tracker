import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jylcyinyaqdeknrlanef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bGN5aW55YXFkZWtucmxhbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTY3NDEsImV4cCI6MjA5NjgzMjc0MX0.nDs1HSi-qatLOSbYb1zwnU2diyo_MWP-ZCEJuUat41s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Calling get_admin_dashboard_data...");
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_dashboard_data');
  if (rpcError) {
    console.error("RPC ERROR:", rpcError);
  } else {
    console.log("RPC returned", rpcData?.length, "rows:");
    console.log(JSON.stringify(rpcData, null, 2));
  }

  console.log("\nDirect query on worship_records:");
  const { data: records, error: recordsError } = await supabase.from('worship_records').select('*');
  if (recordsError) {
    console.error("RECORDS ERROR:", recordsError);
  } else {
    console.log("worship_records:", records);
  }

  console.log("\nDirect query on task_completions:");
  const { data: completions, error: completionsError } = await supabase.from('task_completions').select('*');
  if (completionsError) {
    console.error("COMPLETIONS ERROR:", completionsError);
  } else {
    console.log("task_completions count:", completions?.length);
    console.log("First few completions:", completions?.slice(0, 5));
  }
}

run();
