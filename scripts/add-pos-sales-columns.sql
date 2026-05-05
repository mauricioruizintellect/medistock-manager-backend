ALTER TABLE sales
  ADD COLUMN payment_method ENUM('cash', 'card', 'transfer') NOT NULL DEFAULT 'cash' AFTER total_amount,
  ADD COLUMN discount_type ENUM('percentage', 'amount') NULL AFTER discount_amount,
  ADD COLUMN discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER discount_type;
