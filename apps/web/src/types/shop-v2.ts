import { z } from "zod";

// ========== Shop Item V2 ==========

// Role option response schema
export const roleOptionResponseSchema = z.object({
  id: z.number(),
  roleId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number(),
});

export type RoleOptionResponse = z.infer<typeof roleOptionResponseSchema>;

// Role ticket response schema (included in shop item)
export const roleTicketResponseSchema = z.object({
  id: z.number(),
  consumeQuantity: z.number(),
  removePreviousRole: z.boolean(),
  fixedRoleId: z.string().nullable(), // 고정 역할 ID
  effectDurationSeconds: z.number().nullable(),
  roleOptions: z.array(roleOptionResponseSchema),
});

export type RoleTicketResponse = z.infer<typeof roleTicketResponseSchema>;

export const shopItemV2Schema = z.object({
  id: z.number(),
  guildId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  price: z.number().min(0),
  currencyType: z.enum(["topy", "ruby"]),
  durationDays: z.number(),
  stock: z.number().nullable(),
  maxPerUser: z.number().nullable(),
  enabled: z.boolean(),
  createdAt: z.string(),
  // Optional role ticket info
  roleTicket: roleTicketResponseSchema.optional(),
});

export type ShopItemV2 = z.infer<typeof shopItemV2Schema>;

// Role option for inline creation
export const inlineRoleOptionSchema = z.object({
  name: z.string().min(1).max(100),
  roleId: z.string(),
  description: z.string().max(500).optional(),
});

export type InlineRoleOption = z.infer<typeof inlineRoleOptionSchema>;

// Inline role ticket for unified creation
export const inlineRoleTicketSchema = z.object({
  consumeQuantity: z.number().min(0),
  removePreviousRole: z.boolean(),
  fixedRoleId: z.string().nullable().optional(), // 고정 역할 ID
  effectDurationSeconds: z.number().nullable().optional(),
  roleOptions: z.array(inlineRoleOptionSchema),
});

export type InlineRoleTicket = z.infer<typeof inlineRoleTicketSchema>;

export const createShopItemV2Schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0),
  currencyType: z.enum(["topy", "ruby"]),
  durationDays: z.number().min(0).optional(),
  stock: z.number().min(0).optional(),
  maxPerUser: z.number().min(1).optional(),
  enabled: z.boolean().optional(),
  // Optional role ticket for unified creation
  roleTicket: inlineRoleTicketSchema.optional(),
});

export type CreateShopItemV2 = z.infer<typeof createShopItemV2Schema>;

export const updateShopItemV2Schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.number().min(0).optional(),
  currencyType: z.enum(["topy", "ruby"]).optional(),
  durationDays: z.number().min(0).optional(),
  stock: z.number().nullable().optional(),
  maxPerUser: z.number().nullable().optional(),
  enabled: z.boolean().optional(),
  // Optional: update or create role ticket, null = remove role ticket
  roleTicket: inlineRoleTicketSchema.nullable().optional(),
});

export type UpdateShopItemV2 = z.infer<typeof updateShopItemV2Schema>;

// ========== Role Ticket ==========

export const roleTicketSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  shopItemId: z.number(),
  consumeQuantity: z.number(),
  removePreviousRole: z.boolean(),
  fixedRoleId: z.string().nullable(), // 고정 역할 ID
  effectDurationSeconds: z.number().nullable(),
  enabled: z.boolean(),
  createdAt: z.string(),
  shopItem: shopItemV2Schema.optional(),
  roleOptions: z.array(z.lazy(() => ticketRoleOptionSchema)).optional(),
});

export type RoleTicket = z.infer<typeof roleTicketSchema>;

export const createRoleTicketSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  shopItemId: z.number(),
  consumeQuantity: z.number().min(0).optional(),
  removePreviousRole: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export type CreateRoleTicket = z.infer<typeof createRoleTicketSchema>;

export const updateRoleTicketSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  consumeQuantity: z.number().min(0).optional(),
  removePreviousRole: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export type UpdateRoleTicket = z.infer<typeof updateRoleTicketSchema>;

// ========== Ticket Role Option ==========

export const ticketRoleOptionSchema = z.object({
  id: z.number(),
  ticketId: z.number(),
  roleId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  displayOrder: z.number(),
  createdAt: z.string(),
});

export type TicketRoleOption = z.infer<typeof ticketRoleOptionSchema>;

export const createTicketRoleOptionSchema = z.object({
  roleId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().optional(),
});

export type CreateTicketRoleOption = z.infer<typeof createTicketRoleOptionSchema>;

export const updateTicketRoleOptionSchema = z.object({
  roleId: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  displayOrder: z.number().optional(),
});

export type UpdateTicketRoleOption = z.infer<typeof updateTicketRoleOptionSchema>;

// ========== User Item V2 ==========

export const userItemV2Schema = z.object({
  id: z.string(), // bigint as string
  guildId: z.string(),
  userId: z.string(),
  shopItemId: z.number(),
  quantity: z.number(),
  expiresAt: z.string().nullable(),
  currentRoleId: z.string().nullable(),
  currentRoleAppliedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserItemV2 = z.infer<typeof userItemV2Schema>;
