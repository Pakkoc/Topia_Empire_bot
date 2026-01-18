import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { updateCurrencySettingsSchema, DEFAULT_CURRENCY_SETTINGS } from "@/types/currency";
import type { RowDataPacket } from "mysql2";

interface CurrencySettingsRow extends RowDataPacket {
  guild_id: string;
  enabled: number;
  topy_name: string;
  ruby_name: string;
  topy_manager_enabled: number;
  ruby_manager_enabled: number;
  text_earn_enabled: number;
  text_earn_min: number;
  text_earn_max: number;
  text_min_length: number;
  text_cooldown_seconds: number;
  text_max_per_cooldown: number;
  text_daily_limit: number;
  voice_earn_enabled: number;
  voice_earn_min: number;
  voice_earn_max: number;
  voice_cooldown_seconds: number;
  voice_daily_limit: number;
  min_transfer_topy: number;
  min_transfer_ruby: number;
  transfer_fee_topy_percent: string;
  transfer_fee_ruby_percent: string;
  shop_fee_topy_percent: string;
  shop_fee_ruby_percent: string;
  shop_channel_id: string | null;
  shop_message_id: string | null;
  monthly_tax_enabled: number;
  monthly_tax_percent: string;
  currency_log_channel_id: string | null;
  item_manager_role_id: string | null;
  item_log_channel_id: string | null;
  bank_name: string | null;
  bank_panel_channel_id: string | null;
  bank_panel_message_id: string | null;
  treasury_manager_role_id: string | null;
}

function rowToSettings(row: CurrencySettingsRow) {
  return {
    guildId: row.guild_id,
    enabled: row.enabled === 1,
    topyName: row.topy_name ?? '토피',
    rubyName: row.ruby_name ?? '루비',
    topyManagerEnabled: row.topy_manager_enabled !== 0,
    rubyManagerEnabled: row.ruby_manager_enabled !== 0,
    textEarnEnabled: row.text_earn_enabled === 1,
    textEarnMin: row.text_earn_min,
    textEarnMax: row.text_earn_max,
    textMinLength: row.text_min_length,
    textCooldownSeconds: row.text_cooldown_seconds,
    textMaxPerCooldown: row.text_max_per_cooldown,
    textDailyLimit: row.text_daily_limit,
    voiceEarnEnabled: row.voice_earn_enabled === 1,
    voiceEarnMin: row.voice_earn_min,
    voiceEarnMax: row.voice_earn_max,
    voiceCooldownSeconds: row.voice_cooldown_seconds,
    voiceDailyLimit: row.voice_daily_limit,
    minTransferTopy: row.min_transfer_topy ?? 100,
    minTransferRuby: row.min_transfer_ruby ?? 1,
    transferFeeTopyPercent: parseFloat(row.transfer_fee_topy_percent) || 1.2,
    transferFeeRubyPercent: parseFloat(row.transfer_fee_ruby_percent) || 0,
    shopFeeTopyPercent: parseFloat(row.shop_fee_topy_percent) || 0,
    shopFeeRubyPercent: parseFloat(row.shop_fee_ruby_percent) || 0,
    shopChannelId: row.shop_channel_id ?? null,
    shopMessageId: row.shop_message_id ?? null,
    monthlyTaxEnabled: row.monthly_tax_enabled === 1,
    monthlyTaxPercent: parseFloat(row.monthly_tax_percent) || 3.3,
    currencyLogChannelId: row.currency_log_channel_id ?? null,
    itemManagerRoleId: row.item_manager_role_id ?? null,
    itemLogChannelId: row.item_log_channel_id ?? null,
    bankName: row.bank_name ?? '디토뱅크',
    bankPanelChannelId: row.bank_panel_channel_id ?? null,
    bankPanelMessageId: row.bank_panel_message_id ?? null,
    treasuryManagerRoleId: row.treasury_manager_role_id ?? null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const pool = db();
    const [rows] = await pool.query<CurrencySettingsRow[]>(
      `SELECT * FROM currency_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ guildId, ...DEFAULT_CURRENCY_SETTINGS });
    }

    const settings = rowToSettings(rows[0]!);
    console.log("[API] Currency settings response:", { shopChannelId: settings.shopChannelId, shopMessageId: settings.shopMessageId });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching currency settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const body = await request.json();
    const validatedData = updateCurrencySettingsSchema.parse(body);

    const pool = db();

    const fieldMap: Record<string, string> = {
      enabled: "enabled",
      topyName: "topy_name",
      rubyName: "ruby_name",
      topyManagerEnabled: "topy_manager_enabled",
      rubyManagerEnabled: "ruby_manager_enabled",
      textEarnEnabled: "text_earn_enabled",
      textEarnMin: "text_earn_min",
      textEarnMax: "text_earn_max",
      textMinLength: "text_min_length",
      textCooldownSeconds: "text_cooldown_seconds",
      textMaxPerCooldown: "text_max_per_cooldown",
      textDailyLimit: "text_daily_limit",
      voiceEarnEnabled: "voice_earn_enabled",
      voiceEarnMin: "voice_earn_min",
      voiceEarnMax: "voice_earn_max",
      voiceCooldownSeconds: "voice_cooldown_seconds",
      voiceDailyLimit: "voice_daily_limit",
      minTransferTopy: "min_transfer_topy",
      minTransferRuby: "min_transfer_ruby",
      transferFeeTopyPercent: "transfer_fee_topy_percent",
      transferFeeRubyPercent: "transfer_fee_ruby_percent",
      shopFeeTopyPercent: "shop_fee_topy_percent",
      shopFeeRubyPercent: "shop_fee_ruby_percent",
      monthlyTaxEnabled: "monthly_tax_enabled",
      monthlyTaxPercent: "monthly_tax_percent",
      currencyLogChannelId: "currency_log_channel_id",
      itemManagerRoleId: "item_manager_role_id",
      itemLogChannelId: "item_log_channel_id",
      bankName: "bank_name",
      treasuryManagerRoleId: "treasury_manager_role_id",
    };

    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in validatedData) {
        updates.push(`${dbField} = ?`);
        const val = validatedData[key as keyof typeof validatedData];
        values.push(typeof val === 'boolean' ? (val ? 1 : 0) : (val ?? null));
      }
    }

    if (updates.length > 0) {
      const insertFields = Object.values(fieldMap).join(", ");
      const insertPlaceholders = Object.keys(fieldMap).map(() => "?").join(", ");
      const insertValues = Object.keys(fieldMap).map((key) => {
        const val = validatedData[key as keyof typeof validatedData]
          ?? DEFAULT_CURRENCY_SETTINGS[key as keyof typeof DEFAULT_CURRENCY_SETTINGS]
          ?? null;
        return typeof val === 'boolean' ? (val ? 1 : 0) : val;
      });

      await pool.query(
        `INSERT INTO currency_settings (guild_id, ${insertFields})
         VALUES (?, ${insertPlaceholders})
         ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
        [guildId, ...insertValues, ...values]
      );
    }

    const [rows] = await pool.query<CurrencySettingsRow[]>(
      `SELECT * FROM currency_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ guildId, ...DEFAULT_CURRENCY_SETTINGS });
    }

    const changedFields = Object.keys(validatedData).join(', ');
    notifyBotSettingsChanged({
      guildId,
      type: 'currency-settings',
      action: '수정',
      details: `변경된 필드: ${changedFields}`,
    });

    // 화폐 이름 변경 시 상점 패널 메시지 업데이트
    const hasCurrencyNameChange = 'topyName' in validatedData || 'rubyName' in validatedData;
    console.log("[API] Currency name change detected:", hasCurrencyNameChange, Object.keys(validatedData));

    if (hasCurrencyNameChange) {
      try {
        const botApiUrl = process.env["BOT_API_URL"] || "http://localhost:3001";
        console.log("[API] Calling shop panel refresh:", `${botApiUrl}/api/shop/panel/refresh`);
        const response = await fetch(`${botApiUrl}/api/shop/panel/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guildId }),
        });
        const result = await response.json();
        console.log("[API] Shop panel refresh result:", result);
      } catch (err) {
        // 패널 업데이트 실패는 무시 (설정 저장은 성공했으므로)
        console.error("[API] Failed to refresh shop panel:", err);
      }
    }

    return NextResponse.json(rowToSettings(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating currency settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
