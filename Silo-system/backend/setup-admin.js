/**
 * Setup Admin User Script
 * Run with: node setup-admin.js
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAdmin() {
  const email = 'admin@syloco.com';
  const password = '123';
  const passwordHash = await bcrypt.hash(password, 12);

  console.log('Setting up admin user...');
  console.log('Email:', email);
  console.log('Password:', password);

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    // Update existing user
    const { error } = await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash,
        role: 'super_admin',
        status: 'active'
      })
      .eq('email', email);

    if (error) {
      console.error('Error updating user:', error);
    } else {
      console.log('✅ Admin user updated successfully!');
    }
  } else {
    // Create new user
    const { error } = await supabase
      .from('users')
      .insert({
        email: email,
        password_hash: passwordHash,
        first_name: 'Super',
        last_name: 'Admin',
        role: 'super_admin',
        status: 'active'
      });

    if (error) {
      console.error('Error creating user:', error);
    } else {
      console.log('✅ Admin user created successfully!');
    }
  }

  console.log('\n📝 Login credentials:');
  console.log('   Email: admin@syloco.com');
  console.log('   Password: 123');
}

setupAdmin().catch(console.error);

