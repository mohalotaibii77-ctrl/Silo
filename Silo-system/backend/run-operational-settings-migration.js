// Run the operational settings migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '047_operational_settings.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running operational settings migration...');
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try running directly if RPC fails
      console.log('RPC failed, trying direct execution...');
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.from('_migrations').select('*').limit(0);
          // We can't run raw SQL directly, so we need to use the Supabase dashboard or CLI
        }
      }
      
      console.error('Migration error:', error);
      console.log('\n⚠️  Please run this migration manually in the Supabase SQL editor:');
      console.log(sql);
      return;
    }

    console.log('✅ Operational settings migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    console.log('\n⚠️  Please run the migration manually in the Supabase SQL editor.');
    console.log('Migration file:', path.join(__dirname, 'migrations', '047_operational_settings.sql'));
  }
}

runMigration();





