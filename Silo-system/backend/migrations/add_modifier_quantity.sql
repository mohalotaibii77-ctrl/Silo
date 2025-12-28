-- Add quantity column to product_modifiers table for add-on quantities
ALTER TABLE product_modifiers 
ADD COLUMN IF NOT EXISTS quantity DECIMAL(10, 3) DEFAULT 1;







