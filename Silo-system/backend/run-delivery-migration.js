/**
 * Run delivery partners migration
 * Execute with: node run-delivery-migration.js
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
  console.log('Running migration: create_delivery_partners_table');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'create_delivery_partners_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing SQL migration...');
    
    // Try to execute via RPC
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql });
    
    if (rpcError) {
      console.log('RPC exec_sql not available. Please run the following SQL in Supabase Dashboard:');
      console.log('\n' + '='.repeat(60));
      console.log(sql);
      console.log('='.repeat(60) + '\n');
      
      // Test if table already exists
      const { data, error: testError } = await supabase
        .from('delivery_partners')
        .select('id')
        .limit(1);
      
      if (!testError) {
        console.log('✓ delivery_partners table already exists!');
      } else if (testError.code === '42P01') {
        console.log('✗ Table does not exist yet. Please run the SQL above in Supabase SQL Editor.');
      } else {
        console.log('Table check result:', testError.message);
      }
    } else {
      console.log('✓ Migration executed successfully via RPC');
    }

    // Verify table exists
    const { data: testData, error: verifyError } = await supabase
      .from('delivery_partners')
      .select('id')
      .limit(1);
    
    if (!verifyError) {
      console.log('✓ delivery_partners table is ready!');
    }

    console.log('\nMigration check complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigration();









