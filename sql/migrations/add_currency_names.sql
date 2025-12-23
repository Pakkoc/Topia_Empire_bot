-- 화폐 이름 커스터마이징 컬럼 추가
-- 실행: mysql -u root -p topia_empire < sql/migrations/add_currency_names.sql

ALTER TABLE currency_settings
ADD COLUMN topy_name VARCHAR(20) NOT NULL DEFAULT '토피' AFTER enabled,
ADD COLUMN ruby_name VARCHAR(20) NOT NULL DEFAULT '루비' AFTER topy_name;
