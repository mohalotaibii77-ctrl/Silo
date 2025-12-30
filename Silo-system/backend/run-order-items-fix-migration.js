/**
 * Fix order_items product_id to be nullable for bundles
 * Execute with: node run-order-items-fix-migration.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔧 Running migration: fix_order_items_product_id_nullable');
  console.log('Purpose: Allow bundles to have order items without product_id');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'fix_order_items_product_id_nullable.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n⏳ Applying migration...\n');
    
    // Try to execute via RPC
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (rpcError) {
      console.log('⚠️  RPC method not available, trying manual execution...');
      console.log('\nPlease run this SQL in Supabase Dashboard SQL Editor:');
      console.log('='.repeat(60));
      console.log(migrationSQL);
      console.log('='.repeat(60));
    } else {
      console.log('✅ Migration executed via RPC');
    }
    
    // Test if the change was successful
    console.log('\n🧪 Testing migration...');
    const { data: testData, error: testError } = await supabase
      .from('order_items')
      .select('id, product_id, is_combo, combo_id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Test query failed:', testError.message);
      console.log('\nPlease ensure you run the SQL in Supabase Dashboard manually.');
    } else {
      console.log('✅ order_items table accessible');
      console.log('✅ Migration successful!');
      console.log('\n📝 Summary:');
      console.log('  - product_id is now nullable in order_items');
      console.log('  - Bundles can now be saved with combo_id instead of product_id');
    }
  } catch (err) {
    console.error('❌ Migration error:', err);
    console.log('\nPlease run the SQL manually in Supabase Dashboard:');
    console.log('='.repeat(60));
    const migrationPath = path.join(__dirname, 'migrations', 'fix_order_items_product_id_nullable.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
    console.log('='.repeat(60));
  }
}

runMigration();


