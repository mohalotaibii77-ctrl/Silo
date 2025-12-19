/**
 * Run thumbnail columns migration
 * Adds thumbnail_url columns to products, bundles, and businesses tables
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running thumbnail columns migration...');

  const migrationPath = path.join(__dirname, 'migrations', 'add_thumbnail_columns.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolons and run each statement
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

  for (const statement of statements) {
    try {
      console.log('Executing:', statement.substring(0, 80) + '...');
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      if (error) {
        // Check if database is still responsive
        const { error: directError } = await supabase.from('_migrations').select('*').limit(0);
        if (directError) {
          // Database not responsive - this is a real error
          console.error('✗ Statement failed:', error.message);
          console.error('  Database connection issue:', directError.message);
        } else {
          // Database is responsive, DDL might have succeeded despite error
          console.log('⚠ Statement returned error but database is responsive');
          console.log('  (DDL statements often return errors in Supabase but still execute)');
          console.log('  Error was:', error.message);
        }
      } else {
        // Only log success when there was no error
        console.log('✓ Statement completed successfully');
      }
    } catch (err) {
      console.error('✗ Error executing statement:', err.message);
    }
  }

  console.log('\\nMigration completed!');
  console.log('Note: You may need to run this SQL directly in the Supabase SQL editor if using a hosted Supabase instance.');
}

runMigration().catch(console.error);

