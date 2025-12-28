-- 역할선택권에 고정 역할 추가
-- 고정 역할: 효과 지속일이 붙는 메인 역할 (예: VIP 30일)
-- 고정 역할이 만료되면 교환 가능한 역할도 함께 제거됨

ALTER TABLE role_tickets
ADD COLUMN fixed_role_id VARCHAR(20) NULL AFTER remove_previous_role;
