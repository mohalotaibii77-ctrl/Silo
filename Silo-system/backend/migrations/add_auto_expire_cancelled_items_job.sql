-- ==================== ENABLE PG_CRON EXTENSION ====================
-- pg_cron allows scheduling of PostgreSQL functions to run automatically

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ==================== AUTO-EXPIRE FUNCTION ====================
-- This function automatically marks cancelled order items as waste 
-- if they haven't been processed within 24 hours

CREATE OR REPLACE FUNCTION auto_expire_cancelled_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count INTEGER := 0;
    item_record RECORD;
    twenty_four_hours_ago TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate 24 hours ago
    twenty_four_hours_ago := NOW() - INTERVAL '24 hours';
    
    -- Find and process all expired cancelled items
    FOR item_record IN 
        SELECT 
            coi.id,
            coi.item_id,
            coi.quantity,
            coi.product_name,
            coi.unit,
            coi.order_id,
            o.business_id,
            o.branch_id
        FROM cancelled_order_items coi
        JOIN orders o ON o.id = coi.order_id
        WHERE coi.decision IS NULL
        AND coi.created_at < twenty_four_hours_ago
    LOOP
        -- Update the cancelled item as waste (auto-expired)
        UPDATE cancelled_order_items
        SET 
            decision = 'waste',
            decided_at = NOW()
            -- decided_by is NULL to indicate auto-expired
        WHERE id = item_record.id;
        
        -- Deduct from inventory stock
        UPDATE inventory_stock
        SET 
            quantity = GREATEST(0, quantity - item_record.quantity),
            updated_at = NOW()
        WHERE business_id = item_record.business_id
        AND item_id = item_record.item_id
        AND (branch_id = item_record.branch_id OR (branch_id IS NULL AND item_record.branch_id IS NULL));
        
        -- Log to inventory movements
        INSERT INTO inventory_movements (
            business_id,
            branch_id,
            item_id,
            movement_type,
            reference_type,
            reference_id,
            quantity,
            notes,
            created_at
        ) VALUES (
            item_record.business_id,
            item_record.branch_id,
            item_record.item_id,
            'sale_cancel_waste',
            'order',
            item_record.order_id,
            -item_record.quantity,
            'Auto-expired as waste after 24 hours (no kitchen decision)',
            NOW()
        );
        
        -- Log to order timeline
        INSERT INTO order_timeline (
            order_id,
            event_type,
            event_data,
            created_at
        ) VALUES (
            item_record.order_id,
            'ingredient_wasted',
            jsonb_build_object(
                'item_id', item_record.item_id,
                'item_name', COALESCE(item_record.product_name, 'Item ' || item_record.item_id),
                'quantity', item_record.quantity,
                'unit', COALESCE(item_record.unit, 'units'),
                'reason', 'Auto-expired as waste after 24 hours (no kitchen decision)',
                'auto_expired', true
            ),
            NOW()
        );
        
        expired_count := expired_count + 1;
    END LOOP;
    
    -- Return result as JSON
    RETURN jsonb_build_object(
        'success', true,
        'expired_count', expired_count,
        'executed_at', NOW()
    );
END;
$$;

-- ==================== SCHEDULE THE JOB ====================
-- Run every hour to check for expired items

-- First, remove existing job if it exists (for re-running migration)
SELECT cron.unschedule('auto-expire-cancelled-items') 
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-expire-cancelled-items'
);

-- Schedule the job to run every hour
SELECT cron.schedule(
    'auto-expire-cancelled-items',           -- job name
    '0 * * * *',                              -- every hour at minute 0
    $$SELECT auto_expire_cancelled_items()$$  -- the function to run
);

-- ==================== GRANT PERMISSIONS ====================

GRANT EXECUTE ON FUNCTION auto_expire_cancelled_items() TO service_role;
GRANT EXECUTE ON FUNCTION auto_expire_cancelled_items() TO authenticated;

-- ==================== COMMENTS ====================

COMMENT ON FUNCTION auto_expire_cancelled_items() IS 
'Automatically marks cancelled order items as waste if kitchen has not made a decision within 24 hours. 
Runs every hour via pg_cron scheduled job.';

