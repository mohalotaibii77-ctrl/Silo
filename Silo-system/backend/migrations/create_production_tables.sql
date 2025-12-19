-- Migration: Create tables for composite item production
-- Simplified approach: Production Templates + Production History

-- ==================== PRODUCTION TEMPLATES ====================
-- Templates define which composite item to produce with default settings

CREATE TABLE IF NOT EXISTS production_templates (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- The composite item this template produces
    composite_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    
    -- Template info
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100),
    default_batch_count INTEGER NOT NULL DEFAULT 1 CHECK (default_batch_count > 0),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Audit
    created_by INTEGER REFERENCES business_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PRODUCTION HISTORY ====================
-- Tracks actual production runs

CREATE TABLE IF NOT EXISTS composite_item_productions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- What was produced
    composite_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    template_id INTEGER REFERENCES production_templates(id) ON DELETE SET NULL,
    
    -- Production details
    batch_count INTEGER NOT NULL CHECK (batch_count > 0),
    total_yield DECIMAL(10, 3) NOT NULL,
    yield_unit VARCHAR(20) NOT NULL,
    
    -- Cost tracking
    total_cost DECIMAL(10, 3) NOT NULL DEFAULT 0,
    cost_per_batch DECIMAL(10, 3) NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Notes and audit
    notes TEXT,
    created_by INTEGER REFERENCES business_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PRODUCTION CONSUMED ITEMS ====================
-- Tracks which raw items were consumed in each production

CREATE TABLE IF NOT EXISTS production_consumed_items (
    id SERIAL PRIMARY KEY,
    production_id INTEGER NOT NULL REFERENCES composite_item_productions(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    
    -- Quantity consumed
    quantity_consumed DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    
    -- Cost at time of production
    unit_cost DECIMAL(10, 4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 3) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_templates_business_id ON production_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_templates_composite_item_id ON production_templates(composite_item_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON production_templates(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_productions_business_id ON composite_item_productions(business_id);
CREATE INDEX IF NOT EXISTS idx_productions_composite_item_id ON composite_item_productions(composite_item_id);
CREATE INDEX IF NOT EXISTS idx_productions_template_id ON composite_item_productions(template_id);
CREATE INDEX IF NOT EXISTS idx_productions_date ON composite_item_productions(production_date);

CREATE INDEX IF NOT EXISTS idx_production_consumed_production_id ON production_consumed_items(production_id);

-- ==================== RLS POLICIES ====================

ALTER TABLE production_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE composite_item_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_consumed_items ENABLE ROW LEVEL SECURITY;

-- Templates policies
DROP POLICY IF EXISTS templates_select_policy ON production_templates;
DROP POLICY IF EXISTS templates_insert_policy ON production_templates;
DROP POLICY IF EXISTS templates_update_policy ON production_templates;
DROP POLICY IF EXISTS templates_delete_policy ON production_templates;

CREATE POLICY templates_select_policy ON production_templates FOR SELECT USING (true);
CREATE POLICY templates_insert_policy ON production_templates FOR INSERT WITH CHECK (true);
CREATE POLICY templates_update_policy ON production_templates FOR UPDATE USING (true);
CREATE POLICY templates_delete_policy ON production_templates FOR DELETE USING (true);

-- Productions policies
DROP POLICY IF EXISTS productions_select_policy ON composite_item_productions;
DROP POLICY IF EXISTS productions_insert_policy ON composite_item_productions;
DROP POLICY IF EXISTS productions_update_policy ON composite_item_productions;
DROP POLICY IF EXISTS productions_delete_policy ON composite_item_productions;

CREATE POLICY productions_select_policy ON composite_item_productions FOR SELECT USING (true);
CREATE POLICY productions_insert_policy ON composite_item_productions FOR INSERT WITH CHECK (true);
CREATE POLICY productions_update_policy ON composite_item_productions FOR UPDATE USING (true);
CREATE POLICY productions_delete_policy ON composite_item_productions FOR DELETE USING (true);

-- Consumed items policies
DROP POLICY IF EXISTS consumed_select_policy ON production_consumed_items;
DROP POLICY IF EXISTS consumed_insert_policy ON production_consumed_items;

CREATE POLICY consumed_select_policy ON production_consumed_items FOR SELECT USING (true);
CREATE POLICY consumed_insert_policy ON production_consumed_items FOR INSERT WITH CHECK (true);

-- ==================== GRANTS ====================

GRANT ALL ON production_templates TO authenticated;
GRANT ALL ON production_templates TO service_role;
GRANT ALL ON production_templates TO anon;
GRANT USAGE, SELECT ON SEQUENCE production_templates_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE production_templates_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE production_templates_id_seq TO anon;

GRANT ALL ON composite_item_productions TO authenticated;
GRANT ALL ON composite_item_productions TO service_role;
GRANT ALL ON composite_item_productions TO anon;
GRANT USAGE, SELECT ON SEQUENCE composite_item_productions_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE composite_item_productions_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE composite_item_productions_id_seq TO anon;

GRANT ALL ON production_consumed_items TO authenticated;
GRANT ALL ON production_consumed_items TO service_role;
GRANT ALL ON production_consumed_items TO anon;
GRANT USAGE, SELECT ON SEQUENCE production_consumed_items_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE production_consumed_items_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE production_consumed_items_id_seq TO anon;

-- ==================== COMMENTS ====================

COMMENT ON TABLE production_templates IS 'Templates for producing composite items - quick access to common productions';
COMMENT ON TABLE composite_item_productions IS 'History of production runs';
COMMENT ON TABLE production_consumed_items IS 'Raw items consumed in each production';
