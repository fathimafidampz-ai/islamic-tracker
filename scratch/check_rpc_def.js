import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jylcyinyaqdeknrlanef.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bGN5aW55YXFkZWtucmxhbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTY3NDEsImV4cCI6MjA5NjgzMjc0MX0.nDs1HSi-qatLOSbYb1zwnU2diyo_MWP-ZCEJuUat41s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_admin_dashboard_data');
  console.log("RPC call result:", error || data?.length + " rows");

  // Let's query information_schema orpg_proc to get the function source code
  const { data: procData, error: procError } = await supabase
    .from('pg_proc')
    .select('prosrc')
    .eq('proname', 'get_admin_dashboard_data');
    
  if (procError) {
    console.error("SQL PROC ERROR:", procError);
  } else {
    console.log("PROC CODE:", procData);
  }
}

run();
