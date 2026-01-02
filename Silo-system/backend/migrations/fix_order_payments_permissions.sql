-- Fix permissions for order_payments table
-- This allows the authenticated role to insert payment records

-- Grant INSERT permission on order_payments
GRANT INSERT ON order_payments TO authenticated;
GRANT SELECT ON order_payments TO authenticated;
GRANT UPDATE ON order_payments TO authenticated;

-- Also ensure the service role has full access
GRANT ALL ON order_payments TO service_role;

-- If RLS is enabled, we need a policy to allow inserts
-- First check if RLS is enabled
DO $$
BEGIN
  -- Create policy for inserting payments (if it doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_payments'
    AND policyname = 'Allow insert for authenticated users'
  ) THEN
    CREATE POLICY "Allow insert for authenticated users"
    ON order_payments
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;

  -- Create policy for selecting payments (if it doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_payments'
    AND policyname = 'Allow select for authenticated users'
  ) THEN
    CREATE POLICY "Allow select for authenticated users"
    ON order_payments
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
