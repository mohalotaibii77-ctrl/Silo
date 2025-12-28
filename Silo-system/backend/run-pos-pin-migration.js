/**
 * Migration runner for POS PIN feature
 * Adds pos_pin and pos_pin_hash columns to business_users table
 */

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
  console.log('Running POS PIN migration...');
  
  const migrationPath = path.join(__dirname, 'migrations', 'add_pos_pin_to_users.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by semicolons and filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 80) + '...');
    const { error } = await supabase.rpc('exec_sql', { sql: statement });
    if (error) {
      // Ignore "already exists" errors
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('  -> Already exists, skipping');
      } else {
        console.error('Error:', error.message);
      }
    } else {
      console.log('  -> Success');
    }
  }
  
  console.log('Migration completed!');
}

runMigration().catch(console.error);


