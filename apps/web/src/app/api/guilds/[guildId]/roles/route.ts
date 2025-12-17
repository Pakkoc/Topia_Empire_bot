import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  hoist: boolean;
}

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
  const excludeManaged = searchParams.get("excludeManaged") === "true";
  const excludeEveryone = searchParams.get("excludeEveryone") === "true";

  try {
    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Bot token not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
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
        { error: "Failed to fetch roles" },
        { status: response.status }
      );
    }

    let allRoles: DiscordRole[] = await response.json();

    // Filter out managed roles (bot roles, integration roles)
    if (excludeManaged) {
      allRoles = allRoles.filter((role) => !role.managed);
    }

    // Filter out @everyone role
    if (excludeEveryone) {
      allRoles = allRoles.filter((role) => role.id !== guildId);
    }

    // Sort by position (highest first)
    allRoles.sort((a, b) => b.position - a.position);

    // Transform to cleaner format
    const roles = allRoles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      managed: role.managed,
      mentionable: role.mentionable,
      hoist: role.hoist,
    }));

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
