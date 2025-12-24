# 관리자 / 전속 디자이너 월급

> 참조: `00_money_sys.md` 🔟 관리자 / 전속 디자이너 월급

## 개요

관리자 및 전속 인력에게 월간 루비를 지급하는 시스템

## 현재 상태

- [ ] DB 테이블: `staff_salaries`, `salary_payments`
- [ ] Service: 월급 지급 메서드
- [ ] Web: 월급 관리 페이지

## 수치/규칙

| 직군 | 월 지급 |
|------|---------|
| 관리자 | **10 ~ 20 루비** |
| 전속 디자이너 | **20 ~ 30 루비** |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/43_staff_roles.sql
CREATE TABLE staff_roles (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role_type ENUM('admin', 'designer', 'moderator', 'other') NOT NULL,
    role_id VARCHAR(20) NULL,
    monthly_salary_min INT NOT NULL,
    monthly_salary_max INT NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/44_staff_members.sql
CREATE TABLE staff_members (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    staff_role_id INT NOT NULL,
    custom_salary INT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_guild_user (guild_id, user_id),
    INDEX idx_active (guild_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/45_salary_payments.sql
CREATE TABLE salary_payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    staff_role_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    amount INT NOT NULL,
    payment_month DATE NOT NULL,
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_by VARCHAR(20) NOT NULL,
    note TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_month (guild_id, user_id, payment_month),
    INDEX idx_month (guild_id, payment_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core 서비스

```typescript
// 스태프 목록 조회
async getStaffMembers(guildId: string): Promise<Result<StaffMember[], Error>>

// 스태프 등록
async addStaffMember(
  guildId: string,
  userId: string,
  roleId: number,
  customSalary?: number
): Promise<Result<StaffMember, Error>>

// 월급 지급
async paySalary(
  guildId: string,
  userId: string,
  amount: number,
  adminId: string,
  note?: string
): Promise<Result<SalaryPayment, Error>>

// 월급 일괄 지급
async payAllSalaries(
  guildId: string,
  month: Date,
  adminId: string
): Promise<Result<SalaryPayment[], Error>>

// 지급 내역 조회
async getSalaryHistory(
  guildId: string,
  userId?: string,
  month?: Date
): Promise<Result<SalaryPayment[], Error>>
```

### 3. 월급 지급 흐름

1. 관리자가 매월 월급 지급 실행
2. 활성 스태프 목록 조회
3. 각 스태프별 월급 금액 결정 (커스텀 or 기본값)
4. 루비 지급
5. 지급 기록 저장

### 4. Web 관리

**스태프 관리:**
- 직군 설정 (이름, 월급 범위)
- 스태프 등록/해제
- 개인별 커스텀 월급 설정

**월급 지급:**
- 월별 지급 현황
- 개별 지급 / 일괄 지급
- 지급 내역 조회

### 5. 알림

- 월급 지급 시 DM 알림 (선택)
- 미지급 스태프 알림 (관리자용)
