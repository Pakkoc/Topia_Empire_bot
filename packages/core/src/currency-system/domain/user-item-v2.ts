/**
 * 유저 인벤토리 V2
 */
export interface UserItemV2 {
  id: bigint;
  guildId: string;
  userId: string;
  shopItemId: number;
  quantity: number;
  expiresAt: Date | null; // 기간제 만료 시각 (아이템 보유 기간)
  currentRoleId: string | null; // 현재 적용 중인 역할 (기간제용)
  currentRoleAppliedAt: Date | null; // 역할 적용 시각
  fixedRoleId: string | null; // 현재 적용 중인 고정 역할
  roleExpiresAt: Date | null; // 역할 효과 만료 시각
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 아이템이 만료되었는지 확인
 */
export function isItemV2Expired(item: UserItemV2, now: Date): boolean {
  return item.expiresAt !== null && item.expiresAt < now;
}

/**
 * 현재 적용 중인 역할이 있는지 확인
 */
export function hasActiveRole(item: UserItemV2): boolean {
  return item.currentRoleId !== null;
}

/**
 * 아이템 사용 가능 여부 (수량 또는 기간)
 */
export function canUseItem(item: UserItemV2, now: Date): boolean {
  // 만료된 경우 사용 불가
  if (isItemV2Expired(item, now)) {
    return false;
  }
  // 수량이 있거나, 만료되지 않은 기간제인 경우 사용 가능
  return item.quantity > 0 || item.expiresAt !== null;
}

/**
 * 역할 효과가 만료되었는지 확인
 */
export function isRoleExpired(item: UserItemV2, now: Date): boolean {
  return item.roleExpiresAt !== null && item.roleExpiresAt < now;
}

/**
 * 역할 효과가 활성 상태인지 확인
 */
export function hasActiveRoleEffect(item: UserItemV2, now: Date): boolean {
  return item.currentRoleId !== null && !isRoleExpired(item, now);
}
