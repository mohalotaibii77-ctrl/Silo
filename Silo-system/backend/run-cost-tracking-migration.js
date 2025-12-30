/**
 * Run cost tracking migration
 * Execute with: node run-cost-tracking-migration.js
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
  console.log('Running migration: add_cost_tracking_columns');
  console.log('=' .repeat(50));
  
  try {
    // 1. Add cost snapshot columns to order_items
    console.log('\n1. Adding cost snapshot columns to order_items...');
    
    const orderItemsColumns = [
      { name: 'unit_cost_at_sale', sql: 'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost_at_sale DECIMAL(12, 4) DEFAULT 0;' },
      { name: 'total_cost', sql: 'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 4) DEFAULT 0;' },
      { name: 'profit', sql: 'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit DECIMAL(12, 4) DEFAULT 0;' },
      { name: 'profit_margin', sql: 'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(6, 2) DEFAULT 0;' },
    ];

    for (const col of orderItemsColumns) {
      const { error } = await supabase.rpc('exec_sql', { sql: col.sql });
      if (error) {
        console.log(`  Note: ${col.name} might already exist or RPC unavailable`);
      } else {
        console.log(`  ✓ ${col.name} added`);
      }
    }

    // 2. Add inventory tracking columns to items
    console.log('\n2. Adding inventory tracking columns to items...');
    
    const itemsColumns = [
      { name: 'total_stock_quantity', sql: 'ALTER TABLE items ADD COLUMN IF NOT EXISTS total_stock_quantity DECIMAL(15, 4) DEFAULT 0;' },
      { name: 'total_stock_value', sql: 'ALTER TABLE items ADD COLUMN IF NOT EXISTS total_stock_value DECIMAL(15, 4) DEFAULT 0;' },
      { name: 'last_purchase_cost', sql: 'ALTER TABLE items ADD COLUMN IF NOT EXISTS last_purchase_cost DECIMAL(12, 4) DEFAULT 0;' },
      { name: 'last_purchase_date', sql: 'ALTER TABLE items ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMP WITH TIME ZONE;' },
    ];

    for (const col of itemsColumns) {
      const { error } = await supabase.rpc('exec_sql', { sql: col.sql });
      if (error) {
        console.log(`  Note: ${col.name} might already exist or RPC unavailable`);
      } else {
        console.log(`  ✓ ${col.name} added`);
      }
    }

    // 3. Add cost_updated_at to products
    console.log('\n3. Adding cost tracking columns to products...');
    
    const { error: prodError } = await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP WITH TIME ZONE;'
    });
    if (prodError) {
      console.log('  Note: cost_updated_at might already exist or RPC unavailable');
    } else {
      console.log('  ✓ cost_updated_at added');
    }

    // Verify columns were added
    console.log('\n4. Verifying migration...');
    
    // Check order_items
    const { data: testOrderItems, error: orderError } = await supabase
      .from('order_items')
      .select('id, unit_cost_at_sale, total_cost, profit, profit_margin')
      .limit(1);
    
    if (orderError && orderError.message.includes('column')) {
      console.log('  ⚠️ order_items columns not fully applied');
    } else {
      console.log('  ✓ order_items cost columns OK');
    }

    // Check items
    const { data: testItems, error: itemsError } = await supabase
      .from('items')
      .select('id, total_stock_quantity, total_stock_value, last_purchase_cost')
      .limit(1);
    
    if (itemsError && itemsError.message.includes('column')) {
      console.log('  ⚠️ items columns not fully applied');
    } else {
      console.log('  ✓ items inventory tracking columns OK');
    }

    console.log('\n' + '=' .repeat(50));
    console.log('Migration complete!');
    console.log('\nIf columns were not added via RPC, please run this SQL in Supabase Dashboard:');
    console.log('(Go to SQL Editor in your Supabase project)\n');
    console.log(`
-- ORDER ITEMS COST SNAPSHOT
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost_at_sale DECIMAL(12, 4) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 4) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit DECIMAL(12, 4) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(6, 2) DEFAULT 0;

-- ITEMS INVENTORY TRACKING
ALTER TABLE items ADD COLUMN IF NOT EXISTS total_stock_quantity DECIMAL(15, 4) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS total_stock_value DECIMAL(15, 4) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_purchase_cost DECIMAL(12, 4) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMP WITH TIME ZONE;

-- PRODUCTS COST TRACKING
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP WITH TIME ZONE;
    `);

  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigration();








