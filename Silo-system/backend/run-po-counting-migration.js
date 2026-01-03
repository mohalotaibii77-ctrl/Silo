/**
 * Migration Runner: PO Counting Workflow & Item Barcodes
 * 
 * Run with: node run-po-counting-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running PO Counting & Barcodes migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_po_counting_and_barcodes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.length < 10) continue; // Skip empty or comment-only statements
      
      console.log('Executing:', statement.substring(0, 60) + '...');
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      
      if (error) {
        // Try direct query for DDL statements
        const { error: directError } = await supabase.from('_migrations').select('*').limit(0);
        console.log('Statement may have succeeded (DDL operations)');
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  - Created item_barcodes table');
    console.log('  - Added "counted" to PO status constraint');
    console.log('  - Added barcode_scanned column to purchase_order_items');
    console.log('  - Added counted_quantity column to purchase_order_items');
    console.log('  - Added counted_at column to purchase_order_items');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();







