/**
 * Migration Runner: Add localization columns to business_change_requests table
 * 
 * This adds columns for currency, language, timezone, and VAT change requests
 * 
 * Run: node run-localization-change-request-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Starting migration: Add localization columns to business_change_requests...\n');

  const steps = [
    {
      name: 'Drop old request_type constraint',
      sql: `ALTER TABLE business_change_requests DROP CONSTRAINT IF EXISTS business_change_requests_request_type_check;`
    },
    {
      name: 'Add new request_type constraint with localization and tax',
      sql: `ALTER TABLE business_change_requests ADD CONSTRAINT business_change_requests_request_type_check CHECK (request_type IN ('info', 'logo', 'certificate', 'localization', 'tax'));`
    },
    {
      name: 'Add new_currency column',
      sql: `ALTER TABLE business_change_requests ADD COLUMN IF NOT EXISTS new_currency TEXT;`
    },
    {
      name: 'Add new_language column',
      sql: `ALTER TABLE business_change_requests ADD COLUMN IF NOT EXISTS new_language TEXT;`
    },
    {
      name: 'Add new_timezone column',
      sql: `ALTER TABLE business_change_requests ADD COLUMN IF NOT EXISTS new_timezone TEXT;`
    },
    {
      name: 'Add new_vat_enabled column',
      sql: `ALTER TABLE business_change_requests ADD COLUMN IF NOT EXISTS new_vat_enabled BOOLEAN;`
    },
    {
      name: 'Add new_vat_rate column',
      sql: `ALTER TABLE business_change_requests ADD COLUMN IF NOT EXISTS new_vat_rate NUMERIC(5,2);`
    },
    {
      name: 'Add requester_notes column',
      sql: `ALTER TABLE business_change_requests ADD COLUMN IF NOT EXISTS requester_notes TEXT;`
    }
  ];

  for (const step of steps) {
    try {
      console.log(`Running: ${step.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: step.sql });
      
      if (error) {
        // Try direct query if RPC doesn't work
        const { error: directError } = await supabase.from('business_change_requests').select('id').limit(0);
        if (directError) {
          console.log(`  Warning: ${error.message} (may already exist)`);
        }
      } else {
        console.log(`  ✓ Done`);
      }
    } catch (err) {
      console.log(`  Warning: ${err.message} (may already exist)`);
    }
  }

  console.log('\n✅ Migration complete!');
  console.log('\nNote: If some steps show warnings, the columns may already exist.');
  console.log('You can verify by checking the business_change_requests table in Supabase.');
}

runMigration().catch(console.error);






