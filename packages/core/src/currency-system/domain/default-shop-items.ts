import type { ShopItemType, ShopItemCurrencyType } from './shop-item';

/**
 * 디폴트 상점 아이템 정의
 * - 가격은 0으로 설정 (사용자가 웹에서 직접 설정)
 * - enabled는 false로 설정 (사용자가 직접 활성화)
 */
export interface DefaultShopItemDefinition {
  name: string;
  description: string;
  itemType: ShopItemType;
  currencyType: ShopItemCurrencyType;
  durationDays: number;  // 0=영구, 양수=기간제
  isRoleItem: boolean;   // true=역할지급형, false=인벤토리형
}

/**
 * 디폴트 상점 아이템 목록
 */
export const DEFAULT_SHOP_ITEMS: DefaultShopItemDefinition[] = [
  // === 인벤토리형 (소모성) ===
  {
    name: '경고차감권',
    description: '경고 1회를 차감합니다. 티켓 문의를 통해 사용하세요. (특수한 경우 사용 불가)',
    itemType: 'warning_reduction',
    currencyType: 'topy',
    durationDays: 0,  // 영구
    isRoleItem: false,
  },
  {
    name: '세금감면권',
    description: '월말 세금 징수 시 자동으로 1개 소모되어 세금을 감면받습니다. (감면 비율은 관리자 설정에 따름)',
    itemType: 'tax_exemption',
    currencyType: 'topy',
    durationDays: 0,
    isRoleItem: false,
  },
  {
    name: '이체수수료감면권',
    description: '이체 시 수수료를 면제받습니다. 이체 시 사용 여부를 선택할 수 있습니다.',
    itemType: 'transfer_fee_reduction',
    currencyType: 'topy',
    durationDays: 0,
    isRoleItem: false,
  },

  // === 역할지급형 (기간제) ===
  {
    name: '활동부스트권',
    description: '활동 보상 배율이 적용됩니다. (XP/화폐 설정에서 배율 조정)',
    itemType: 'activity_boost',
    currencyType: 'topy',
    durationDays: 30,
    isRoleItem: true,
  },
  {
    name: '프리미엄잠수방',
    description: '프리미엄 잠수방 채널에 접근할 수 있습니다.',
    itemType: 'premium_afk',
    currencyType: 'topy',
    durationDays: 30,
    isRoleItem: true,
  },
  {
    name: 'VIP라운지입장권',
    description: 'VIP 라운지 채널에 접근할 수 있습니다.',
    itemType: 'vip_lounge',
    currencyType: 'ruby',
    durationDays: 30,
    isRoleItem: true,
  },
  {
    name: '금고 등급',
    description: '금고 기능을 이용할 수 있습니다. (금고 한도, 월 이자율 설정 가능)',
    itemType: 'dito_silver',
    currencyType: 'ruby',
    durationDays: 30,
    isRoleItem: true,
  },
  {
    name: '색상선택권(기본)',
    description: '닉네임 색상을 1회 변경할 수 있습니다. 변경된 색상은 영구 유지됩니다.',
    itemType: 'color_basic',
    currencyType: 'topy',
    durationDays: 0,  // 영구 (1회 사용 후 역할 영구 유지)
    isRoleItem: false,  // 인벤토리형 (1회 소모 후 역할 교환)
  },
  {
    name: '색상선택권(프리미엄)',
    description: '기간 내 닉네임 색상을 자유롭게 변경할 수 있습니다.',
    itemType: 'color_premium',
    currencyType: 'ruby',
    durationDays: 30,
    isRoleItem: true,
  },

  // === 역할선택권 (즉시구매) ===
  {
    name: '역할선택권',
    description: '원하는 역할을 선택하여 즉시 구매할 수 있습니다. 역할별로 가격이 다릅니다.',
    itemType: 'role_ticket',
    currencyType: 'both',  // 토피/루비 모두 가능
    durationDays: 0,  // 즉시 부여 (영구)
    isRoleItem: true,
  },
];

/**
 * 시스템 아이템 타입인지 확인 (custom이 아닌 모든 타입)
 */
export function isSystemItemType(itemType: ShopItemType): boolean {
  return itemType !== 'custom';
}

/**
 * 아이템 타입별 한글 라벨
 */
export const ITEM_TYPE_LABELS: Record<ShopItemType, string> = {
  custom: '일반',
  warning_reduction: '경고차감권',
  tax_exemption: '세금감면권',
  transfer_fee_reduction: '이체수수료감면권',
  activity_boost: '활동부스트권',
  premium_afk: '프리미엄잠수방',
  vip_lounge: 'VIP라운지입장권',
  dito_silver: '금고 등급',
  dito_gold: '금고 등급',  // 기존 데이터 호환용
  color_basic: '색상선택권(기본)',
  color_premium: '색상선택권(프리미엄)',
  role_ticket: '역할선택권',
};
