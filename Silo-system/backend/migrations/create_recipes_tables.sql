-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    yield_quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
    yield_unit VARCHAR(50) NOT NULL DEFAULT 'portion',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recipe_ingredients table (junction table between recipes and items)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity DECIMAL(10, 3) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recipe_id, item_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_business_id ON recipes(business_id);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item_id ON recipe_ingredients(item_id);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS policies for recipes (business can only see their own recipes)
CREATE POLICY recipes_select_policy ON recipes FOR SELECT USING (true);
CREATE POLICY recipes_insert_policy ON recipes FOR INSERT WITH CHECK (true);
CREATE POLICY recipes_update_policy ON recipes FOR UPDATE USING (true);
CREATE POLICY recipes_delete_policy ON recipes FOR DELETE USING (true);

-- RLS policies for recipe_ingredients
CREATE POLICY recipe_ingredients_select_policy ON recipe_ingredients FOR SELECT USING (true);
CREATE POLICY recipe_ingredients_insert_policy ON recipe_ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY recipe_ingredients_update_policy ON recipe_ingredients FOR UPDATE USING (true);
CREATE POLICY recipe_ingredients_delete_policy ON recipe_ingredients FOR DELETE USING (true);







