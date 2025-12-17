import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
}

// Channel types
const CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  GUILD_STAGE_VOICE: 13,
  GUILD_FORUM: 15,
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { guildId } = await params;

  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "text", "voice", "category", or null for all

  try {
    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Bot token not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Discord API error:", error);
      return NextResponse.json(
        { error: "Failed to fetch channels" },
        { status: response.status }
      );
    }

    const allChannels: DiscordChannel[] = await response.json();

    // Filter by type if specified
    let filteredChannels = allChannels;
    if (type === "text") {
      filteredChannels = allChannels.filter(
        (ch) =>
          ch.type === CHANNEL_TYPE.GUILD_TEXT ||
          ch.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT ||
          ch.type === CHANNEL_TYPE.GUILD_FORUM
      );
    } else if (type === "voice") {
      filteredChannels = allChannels.filter(
        (ch) =>
          ch.type === CHANNEL_TYPE.GUILD_VOICE ||
          ch.type === CHANNEL_TYPE.GUILD_STAGE_VOICE
      );
    } else if (type === "category") {
      filteredChannels = allChannels.filter(
        (ch) => ch.type === CHANNEL_TYPE.GUILD_CATEGORY
      );
    }

    // Sort by position
    filteredChannels.sort((a, b) => a.position - b.position);

    // Transform to cleaner format
    const channels = filteredChannels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: ch.parent_id,
    }));

    return NextResponse.json(channels);
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
