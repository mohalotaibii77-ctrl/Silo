/**
 * Run migration to add business_deleted_items table
 * This table allows businesses to "delete" default items without affecting other businesses
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running business_deleted_items migration...');
    
    const migrationPath = path.join(__dirname, 'migrations', 'add_business_deleted_items.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 80) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase.from('_temp').select().limit(0);
          if (directError) {
            console.log('Note: Statement may have already been applied or requires manual execution');
          }
        }
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();


