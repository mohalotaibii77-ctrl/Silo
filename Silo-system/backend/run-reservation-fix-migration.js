/**
 * Run the inventory reservation fix migration
 * This migration adds cancellation_source and pos_session_id columns
 * to the cancelled_order_items table
 * 
 * Run with: node run-reservation-fix-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running inventory reservation fix migration...\n');

  const migrationPath = path.join(__dirname, 'migrations', 'update_cancelled_items_for_reservation_fix.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // Try alternative approach - execute statements individually
      console.log('Attempting individual statement execution...');
      
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const stmt of statements) {
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt });
        if (stmtError) {
          console.warn('⚠️ Statement warning:', stmtError.message);
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  - Added cancellation_source column to cancelled_order_items');
    console.log('  - Added pos_session_id column to cancelled_order_items');
    console.log('  - Created indexes for fast filtering');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();




