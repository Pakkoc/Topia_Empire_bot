-- 상점 수수료 설정 컬럼 추가
ALTER TABLE currency_settings
ADD COLUMN shop_fee_topy_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER transfer_fee_ruby_percent,
ADD COLUMN shop_fee_ruby_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER shop_fee_topy_percent;
