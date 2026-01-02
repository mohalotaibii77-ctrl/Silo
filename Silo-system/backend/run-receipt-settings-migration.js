/**
 * Migration runner for receipt_settings table
 * Run with: node run-receipt-settings-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running receipt_settings migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_receipt_settings_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('Trying alternative execution method...');
      const { error: altError } = await supabase.from('receipt_settings').select('id').limit(1);
      
      if (altError && altError.code === '42P01') {
        // Table doesn't exist, need to create it manually via Supabase dashboard
        console.log('\n⚠️  Please run this migration manually in your Supabase SQL Editor:');
        console.log('----------------------------------------');
        console.log(sql);
        console.log('----------------------------------------');
      } else if (!altError) {
        console.log('✅ Table already exists!');
      } else {
        throw altError;
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }
    
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();





