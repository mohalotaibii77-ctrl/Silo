/**
 * Run the inventory transactions table migration
 * This creates the audit log table for tracking all inventory movements
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running inventory transactions migration...');
  
  const migrationPath = path.join(__dirname, 'migrations', 'create_inventory_transactions_table.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).catch(async (err) => {
    // If RPC doesn't exist, try direct query
    console.log('Trying direct query...');
    const statements = sql.split(';').filter(s => s.trim());
    const errors = [];
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error: stmtError } = await supabase.rpc('exec_sql', { query: statement + ';' });
        if (stmtError) {
          console.error('Statement error:', stmtError);
          errors.push(stmtError);
        }
      }
    }
    
    // Return error if any statements failed
    if (errors.length > 0) {
      return { error: `${errors.length} statement(s) failed during migration` };
    }
    return { error: null };
  });
  
  if (error) {
    console.error('Migration error:', error);
    console.log('\nPlease run the migration SQL directly in Supabase SQL Editor:');
    console.log('File: migrations/create_inventory_transactions_table.sql');
    process.exit(1);
  }
  
  console.log('Migration completed successfully!');
}

runMigration().catch(console.error);
