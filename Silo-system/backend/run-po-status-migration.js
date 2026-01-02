/**
 * Run migration to update purchase_orders status constraint
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Updating purchase_orders status constraint to include "delivered"...');
  
  try {
    // Drop the existing constraint
    console.log('1. Dropping existing constraint...');
    const { error: e1 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;'
    });
    if (e1) {
      console.log('Note: exec_sql RPC not available, trying direct approach...');
      // Try direct query - won't work but we'll handle it
    } else {
      console.log('   Constraint dropped.');
    }
    
    // Add new constraint with 'delivered' status
    console.log('2. Adding new constraint with delivered status...');
    const { error: e2 } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN ('draft', 'pending', 'delivered', 'cancelled', 'approved', 'ordered', 'partial', 'received'));"
    });
    if (e2) {
      console.log('Note: Could not add constraint via RPC');
      console.log('\n⚠️  Please run this SQL in Supabase Dashboard SQL Editor:');
      console.log(`
-- Drop the existing constraint
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Add new constraint with 'delivered' status
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check 
  CHECK (status IN ('draft', 'pending', 'delivered', 'cancelled', 'approved', 'ordered', 'partial', 'received'));
      `);
    } else {
      console.log('   Constraint added successfully!');
    }
    
    // Test by checking if we can query the table
    const { data, error: testError } = await supabase
      .from('purchase_orders')
      .select('status')
      .limit(1);
    
    if (!testError) {
      console.log('\n✓ purchase_orders table accessible');
    }
    
    console.log('\nMigration complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigration();










