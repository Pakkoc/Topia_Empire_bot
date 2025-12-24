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
}

function rowToSettings(row: CurrencySettingsRow) {
  return {
    guildId: row.guild_id,
    enabled: row.enabled === 1,
    topyName: row.topy_name ?? '토피',
    rubyName: row.ruby_name ?? '루비',
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

    return NextResponse.json(rowToSettings(rows[0]!));
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
