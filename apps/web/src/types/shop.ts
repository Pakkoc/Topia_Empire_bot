import { z } from "zod";

// Item Types
export const itemTypeSchema = z.enum([
  "role",
  "color",
  "premium_room",
  "random_box",
  "warning_remove",
  "tax_exempt",
  "bank_silver",
  "bank_gold",
  "custom",
]);

export type ItemType = z.infer<typeof itemTypeSchema>;

// Shop Item
export const shopItemSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  price: z.number().min(0),
  currencyType: z.enum(["topy", "ruby"]),
  itemType: itemTypeSchema,
  durationDays: z.number().nullable(),
  roleId: z.string().nullable(),
  stock: z.number().nullable(),
  maxPerUser: z.number().nullable(),
  enabled: z.boolean(),
  createdAt: z.string(),
});

export type ShopItem = z.infer<typeof shopItemSchema>;

// Create Shop Item
export const createShopItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0),
  currencyType: z.enum(["topy", "ruby"]),
  itemType: itemTypeSchema,
  durationDays: z.number().optional(),
  roleId: z.string().optional(),
  stock: z.number().optional(),
  maxPerUser: z.number().optional(),
});

export type CreateShopItem = z.infer<typeof createShopItemSchema>;

// Update Shop Item
export const updateShopItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.number().min(0).optional(),
  currencyType: z.enum(["topy", "ruby"]).optional(),
  itemType: itemTypeSchema.optional(),
  durationDays: z.number().nullable().optional(),
  roleId: z.string().nullable().optional(),
  stock: z.number().nullable().optional(),
  maxPerUser: z.number().nullable().optional(),
  enabled: z.boolean().optional(),
});

export type UpdateShopItem = z.infer<typeof updateShopItemSchema>;

// User Item
export const userItemSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  userId: z.string(),
  itemType: z.string(),
  quantity: z.number(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserItem = z.infer<typeof userItemSchema>;

// Purchase History
export const purchaseHistorySchema = z.object({
  id: z.number(),
  guildId: z.string(),
  userId: z.string(),
  itemId: z.number(),
  itemName: z.string(),
  price: z.number(),
  fee: z.number(),
  currencyType: z.enum(["topy", "ruby"]),
  purchasedAt: z.string(),
});

export type PurchaseHistory = z.infer<typeof purchaseHistorySchema>;

// Item Type Labels
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  role: "역할 부여",
  color: "색상 변경권",
  premium_room: "프리미엄 잠수방",
  random_box: "랜덤박스",
  warning_remove: "경고 차감",
  tax_exempt: "세금 면제권",
  bank_silver: "디토뱅크 실버",
  bank_gold: "디토뱅크 골드",
  custom: "커스텀",
};
