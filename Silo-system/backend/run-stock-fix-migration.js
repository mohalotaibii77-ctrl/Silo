/**
 * Fix duplicate inventory_stock records and add proper unique constraints
 * Run with: node run-stock-fix-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔧 Fixing duplicate inventory_stock records...\n');

  // Step 1: Check for duplicates with NULL branch_id
  console.log('Step 1: Checking for duplicates with NULL branch_id...');
  const { data: nullDuplicates, error: err1 } = await supabase
    .from('inventory_stock')
    .select('business_id, item_id')
    .is('branch_id', null);

  if (err1) {
    console.error('Error checking duplicates:', err1);
    return;
  }

  // Group and count
  const nullCounts = {};
  nullDuplicates?.forEach(row => {
    const key = `${row.business_id}-${row.item_id}`;
    nullCounts[key] = (nullCounts[key] || 0) + 1;
  });

  const nullDups = Object.entries(nullCounts).filter(([_, count]) => count > 1);
  console.log(`  Found ${nullDups.length} items with duplicate records (NULL branch)\n`);

  // Step 2: Fix each duplicate
  for (const [key, count] of nullDups) {
    const [businessId, itemId] = key.split('-').map(Number);
    console.log(`  Fixing duplicates for business=${businessId}, item=${itemId} (${count} records)...`);

    // Get all duplicate records
    const { data: records, error: fetchErr } = await supabase
      .from('inventory_stock')
      .select('*')
      .eq('business_id', businessId)
      .eq('item_id', itemId)
      .is('branch_id', null)
      .order('id', { ascending: true });

    if (fetchErr || !records || records.length < 2) {
      console.log(`    Skipping - could not fetch records`);
      continue;
    }

    // Keep the first record (oldest), merge quantities from others
    const keepRecord = records[0];
    const deleteRecords = records.slice(1);

    // Sum up quantities
    let totalQty = keepRecord.quantity || 0;
    let totalReserved = keepRecord.reserved_quantity || 0;
    let totalHeld = keepRecord.held_quantity || 0;
    
    deleteRecords.forEach(r => {
      totalQty += (r.quantity || 0);
      totalReserved += (r.reserved_quantity || 0);
      totalHeld += (r.held_quantity || 0);
    });

    // Update the kept record with merged values
    const { error: updateErr } = await supabase
      .from('inventory_stock')
      .update({
        quantity: totalQty,
        reserved_quantity: totalReserved,
        held_quantity: totalHeld,
        updated_at: new Date().toISOString()
      })
      .eq('id', keepRecord.id);

    if (updateErr) {
      console.log(`    Error updating: ${updateErr.message}`);
      continue;
    }

    // Delete the duplicate records
    const deleteIds = deleteRecords.map(r => r.id);
    const { error: deleteErr } = await supabase
      .from('inventory_stock')
      .delete()
      .in('id', deleteIds);

    if (deleteErr) {
      console.log(`    Error deleting duplicates: ${deleteErr.message}`);
    } else {
      console.log(`    ✓ Merged ${count} records into one (qty: ${totalQty.toFixed(2)})`);
    }
  }

  // Step 3: Check for duplicates WITH branch_id
  console.log('\nStep 2: Checking for duplicates with branch_id...');
  const { data: branchDuplicates, error: err2 } = await supabase
    .from('inventory_stock')
    .select('business_id, branch_id, item_id')
    .not('branch_id', 'is', null);

  if (err2) {
    console.error('Error checking branch duplicates:', err2);
    return;
  }

  const branchCounts = {};
  branchDuplicates?.forEach(row => {
    const key = `${row.business_id}-${row.branch_id}-${row.item_id}`;
    branchCounts[key] = (branchCounts[key] || 0) + 1;
  });

  const branchDups = Object.entries(branchCounts).filter(([_, count]) => count > 1);
  console.log(`  Found ${branchDups.length} items with duplicate records (with branch)\n`);

  // Fix branch duplicates similarly
  for (const [key, count] of branchDups) {
    const [businessId, branchId, itemId] = key.split('-').map(Number);
    console.log(`  Fixing duplicates for business=${businessId}, branch=${branchId}, item=${itemId}...`);

    const { data: records, error: fetchErr } = await supabase
      .from('inventory_stock')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('item_id', itemId)
      .order('id', { ascending: true });

    if (fetchErr || !records || records.length < 2) continue;

    const keepRecord = records[0];
    const deleteRecords = records.slice(1);

    let totalQty = keepRecord.quantity || 0;
    let totalReserved = keepRecord.reserved_quantity || 0;
    let totalHeld = keepRecord.held_quantity || 0;
    
    deleteRecords.forEach(r => {
      totalQty += (r.quantity || 0);
      totalReserved += (r.reserved_quantity || 0);
      totalHeld += (r.held_quantity || 0);
    });

    await supabase
      .from('inventory_stock')
      .update({
        quantity: totalQty,
        reserved_quantity: totalReserved,
        held_quantity: totalHeld,
        updated_at: new Date().toISOString()
      })
      .eq('id', keepRecord.id);

    const deleteIds = deleteRecords.map(r => r.id);
    await supabase
      .from('inventory_stock')
      .delete()
      .in('id', deleteIds);

    console.log(`    ✓ Merged ${count} records into one`);
  }

  // Final verification
  console.log('\n✅ Migration complete!');
  console.log('Note: You should also run the SQL migration to add unique constraints:');
  console.log('  migrations/fix_inventory_stock_unique_constraint.sql');
}

runMigration().catch(console.error);

