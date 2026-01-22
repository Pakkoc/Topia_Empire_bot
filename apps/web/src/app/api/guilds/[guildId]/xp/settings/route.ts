import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { updateXpSettingsSchema } from "@/types/xp";
import type { RowDataPacket } from "mysql2";

interface XpSettingsRow extends RowDataPacket {
  guild_id: string;
  enabled: boolean;
  text_xp_enabled: boolean;
  text_xp_min: number;
  text_xp_max: number;
  text_cooldown_seconds: number;
  text_max_per_cooldown: number;
  voice_xp_enabled: boolean;
  voice_xp_min: number;
  voice_xp_max: number;
  voice_cooldown_seconds: number;
  voice_max_per_cooldown: number;
  text_level_up_notification_enabled: boolean;
  text_level_up_channel_id: string | null;
  text_level_up_message: string | null;
  voice_level_up_notification_enabled: boolean;
  voice_level_up_channel_id: string | null;
  voice_level_up_message: string | null;
}

function rowToSettings(row: XpSettingsRow) {
  return {
    guildId: row.guild_id,
    enabled: row.enabled,
    textXpEnabled: row.text_xp_enabled,
    textXpMin: row.text_xp_min,
    textXpMax: row.text_xp_max,
    textCooldownSeconds: row.text_cooldown_seconds,
    textMaxPerCooldown: row.text_max_per_cooldown,
    voiceXpEnabled: row.voice_xp_enabled,
    voiceXpMin: row.voice_xp_min,
    voiceXpMax: row.voice_xp_max,
    voiceCooldownSeconds: row.voice_cooldown_seconds,
    voiceMaxPerCooldown: row.voice_max_per_cooldown,
    textLevelUpNotificationEnabled: row.text_level_up_notification_enabled,
    textLevelUpChannelId: row.text_level_up_channel_id,
    textLevelUpMessage: row.text_level_up_message,
    voiceLevelUpNotificationEnabled: row.voice_level_up_notification_enabled,
    voiceLevelUpChannelId: row.voice_level_up_channel_id,
    voiceLevelUpMessage: row.voice_level_up_message,
  };
}

const DEFAULT_SETTINGS = {
  enabled: true,
  textXpEnabled: true,
  textXpMin: 15,
  textXpMax: 25,
  textCooldownSeconds: 60,
  textMaxPerCooldown: 1,
  voiceXpEnabled: true,
  voiceXpMin: 10,
  voiceXpMax: 20,
  voiceCooldownSeconds: 60,
  voiceMaxPerCooldown: 1,
  textLevelUpNotificationEnabled: true,
  textLevelUpChannelId: null,
  textLevelUpMessage: null,
  voiceLevelUpNotificationEnabled: true,
  voiceLevelUpChannelId: null,
  voiceLevelUpMessage: null,
};

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
    const [rows] = await pool.query<XpSettingsRow[]>(
      `SELECT * FROM xp_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      // Return defaults if no settings exist
      return NextResponse.json({ guildId, ...DEFAULT_SETTINGS });
    }

    return NextResponse.json(rowToSettings(rows[0]!));
  } catch (error) {
    console.error("Error fetching XP settings:", error);
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
    const validatedData = updateXpSettingsSchema.parse(body);

    const pool = db();

    // Build update fields dynamically
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    const fieldMap: Record<string, string> = {
      enabled: "enabled",
      textXpEnabled: "text_xp_enabled",
      textXpMin: "text_xp_min",
      textXpMax: "text_xp_max",
      textCooldownSeconds: "text_cooldown_seconds",
      textMaxPerCooldown: "text_max_per_cooldown",
      voiceXpEnabled: "voice_xp_enabled",
      voiceXpMin: "voice_xp_min",
      voiceXpMax: "voice_xp_max",
      voiceCooldownSeconds: "voice_cooldown_seconds",
      voiceMaxPerCooldown: "voice_max_per_cooldown",
      textLevelUpNotificationEnabled: "text_level_up_notification_enabled",
      textLevelUpChannelId: "text_level_up_channel_id",
      textLevelUpMessage: "text_level_up_message",
      voiceLevelUpNotificationEnabled: "voice_level_up_notification_enabled",
      voiceLevelUpChannelId: "voice_level_up_channel_id",
      voiceLevelUpMessage: "voice_level_up_message",
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in validatedData) {
        updates.push(`${dbField} = ?`);
        values.push(validatedData[key as keyof typeof validatedData] ?? null);
      }
    }

    if (updates.length > 0) {
      // Upsert: Insert if not exists, update if exists
      const insertFields = Object.values(fieldMap).join(", ");
      const insertPlaceholders = Object.keys(fieldMap).map(() => "?").join(", ");
      const insertValues = Object.keys(fieldMap).map(
        (key) => validatedData[key as keyof typeof validatedData] ?? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] ?? null
      );

      await pool.query(
        `INSERT INTO xp_settings (guild_id, ${insertFields})
         VALUES (?, ${insertPlaceholders})
         ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
        [guildId, ...insertValues, ...values]
      );
    }

    // Fetch and return updated settings
    const [rows] = await pool.query<XpSettingsRow[]>(
      `SELECT * FROM xp_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ guildId, ...DEFAULT_SETTINGS });
    }

    // 봇에 설정 변경 알림 (비동기, 대기 안함)
    const changedFields = Object.keys(validatedData).join(', ');
    notifyBotSettingsChanged({
      guildId,
      type: 'xp-settings',
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
    console.error("Error updating XP settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
