import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface StatsRow extends RowDataPacket {
  total_members: number;
  total_xp: number;
  avg_level: number;
  max_level: number;
}

interface SettingsRow extends RowDataPacket {
  enabled: boolean;
  text_xp_enabled: boolean;
  voice_xp_enabled: boolean;
}

interface DiscordGuild {
  id: string;
  name: string;
  approximate_member_count?: number;
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

    // Get actual guild member count from Discord API
    let totalMembers = 0;
    const botToken = process.env.DISCORD_TOKEN;
    if (botToken) {
      try {
        const guildRes = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`,
          {
            headers: { Authorization: `Bot ${botToken}` },
          }
        );
        if (guildRes.ok) {
          const guildData: DiscordGuild = await guildRes.json();
          totalMembers = guildData.approximate_member_count ?? 0;
        }
      } catch (e) {
        console.error("Error fetching guild from Discord:", e);
      }
    }

    // Get XP user stats
    const [userStats] = await pool.query<StatsRow[]>(
      `SELECT
        COUNT(*) as total_members,
        COALESCE(SUM(xp), 0) as total_xp,
        COALESCE(AVG(level), 0) as avg_level,
        COALESCE(MAX(level), 0) as max_level
       FROM xp_users
       WHERE guild_id = ?`,
      [guildId]
    );

    // Get XP settings
    const [settings] = await pool.query<SettingsRow[]>(
      `SELECT enabled, text_xp_enabled, voice_xp_enabled FROM xp_settings WHERE guild_id = ?`,
      [guildId]
    );

    // Get today's activity (users who earned XP today)
    const [todayActivity] = await pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(DISTINCT CASE WHEN DATE(last_text_xp_at) = CURDATE() THEN user_id END) as text_active,
        COUNT(DISTINCT CASE WHEN DATE(last_voice_xp_at) = CURDATE() THEN user_id END) as voice_active
       FROM xp_users
       WHERE guild_id = ?`,
      [guildId]
    );

    // Get top 5 users
    const [topUsers] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, xp, level FROM xp_users WHERE guild_id = ? ORDER BY xp DESC LIMIT 5`,
      [guildId]
    );

    const stats = userStats[0] ?? { total_members: 0, total_xp: 0, avg_level: 0, max_level: 0 };
    const xpSettings = settings[0] ?? { enabled: false, text_xp_enabled: false, voice_xp_enabled: false };
    const activity = todayActivity[0] ?? { text_active: 0, voice_active: 0 };

    return NextResponse.json({
      totalMembers: totalMembers,
      membersWithXp: Number(stats.total_members),
      totalXp: Number(stats.total_xp),
      avgLevel: Math.round(Number(stats.avg_level) * 10) / 10,
      maxLevel: Number(stats.max_level),
      xpEnabled: xpSettings.enabled,
      textXpEnabled: xpSettings.text_xp_enabled,
      voiceXpEnabled: xpSettings.voice_xp_enabled,
      todayTextActive: Number(activity.text_active),
      todayVoiceActive: Number(activity.voice_active),
      topUsers: topUsers.map((u) => ({
        userId: u.user_id,
        xp: u.xp,
        level: u.level,
      })),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
