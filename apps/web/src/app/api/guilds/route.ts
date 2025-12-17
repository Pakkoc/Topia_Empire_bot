import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscordGuild, hasManageGuildPermission } from "@/types/discord";
import type { RowDataPacket } from "mysql2";

interface GuildRow extends RowDataPacket {
  id: string;
  left_at: Date | null;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch user's guilds from Discord API
    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${session.user.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Discord API error:", error);
      return NextResponse.json(
        { error: "Failed to fetch guilds" },
        { status: response.status }
      );
    }

    const allGuilds: DiscordGuild[] = await response.json();

    // Filter guilds where user has manage permission
    const manageableGuilds = allGuilds.filter((guild) =>
      hasManageGuildPermission(guild.permissions)
    );

    // Check which guilds have the bot joined from database
    let botJoinedGuildIds: Set<string> = new Set();

    try {
      const pool = db();
      const guildIds = manageableGuilds.map((g) => g.id);

      if (guildIds.length > 0) {
        const [rows] = await pool.query<GuildRow[]>(
          `SELECT id FROM guilds WHERE id IN (?) AND left_at IS NULL`,
          [guildIds]
        );
        botJoinedGuildIds = new Set(rows.map((row) => row.id));
      }
    } catch (dbError) {
      // If database connection fails, log and continue with empty set
      console.error("Database error (continuing without bot status):", dbError);
    }

    const guildsWithBotStatus = manageableGuilds.map((guild) => ({
      ...guild,
      botJoined: botJoinedGuildIds.has(guild.id),
    }));

    return NextResponse.json(guildsWithBotStatus);
  } catch (error) {
    console.error("Error fetching guilds:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
