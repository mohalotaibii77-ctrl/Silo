import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Supabase client for public operations (respects RLS)
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

// Supabase admin client (bypasses RLS - use carefully)
console.log('Service role key (last 10 chars):', env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10));
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('businesses').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist, which is fine for initial setup
      console.error('Database connection error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Database connection failed:', err);
    return false;
  }
}

