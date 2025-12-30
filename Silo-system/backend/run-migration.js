/**
 * Run migration script
 * Execute with: node run-migration.js
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
  console.log('Running migration: add_removable_and_modifiers');
  
  try {
    // Add removable column to product_ingredients
    console.log('Adding removable column to product_ingredients...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS removable BOOLEAN DEFAULT false;`
    });
    if (error1) {
      console.log('Note: removable column might already exist or RPC not available, trying direct approach...');
    }

    // Create product_modifiers table
    console.log('Creating product_modifiers table...');
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS product_modifiers (
          id SERIAL PRIMARY KEY,
          product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          item_id INT REFERENCES items(id) ON DELETE SET NULL,
          name VARCHAR(255) NOT NULL,
          name_ar VARCHAR(255),
          removable BOOLEAN DEFAULT false,
          addable BOOLEAN DEFAULT true,
          extra_price DECIMAL(10, 3) DEFAULT 0,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    if (error2) {
      console.log('Note: product_modifiers table might already exist or RPC not available');
    }

    // Test if tables exist by trying to select from them
    const { data: testIngredients, error: testError1 } = await supabase
      .from('product_ingredients')
      .select('id, removable')
      .limit(1);
    
    if (testError1) {
      console.error('product_ingredients table issue:', testError1.message);
    } else {
      console.log('✓ product_ingredients table OK');
    }

    const { data: testModifiers, error: testError2 } = await supabase
      .from('product_modifiers')
      .select('id')
      .limit(1);
    
    if (testError2) {
      console.error('product_modifiers table issue:', testError2.message);
      console.log('\n⚠️  Please run this SQL in Supabase Dashboard SQL Editor:');
      console.log(`
CREATE TABLE IF NOT EXISTS product_modifiers (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_id INT REFERENCES items(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  removable BOOLEAN DEFAULT false,
  addable BOOLEAN DEFAULT true,
  extra_price DECIMAL(10, 3) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS removable BOOLEAN DEFAULT false;
      `);
    } else {
      console.log('✓ product_modifiers table OK');
    }

    console.log('\nMigration check complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigration();








