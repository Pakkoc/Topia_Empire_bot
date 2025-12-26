import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";

interface CurrencyManagerRow extends RowDataPacket {
  id: number;
  guild_id: string;
  user_id: string;
  created_at: Date;
}

const addManagerSchema = z.object({
  userId: z.string().min(1),
});

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
    const [rows] = await pool.query<CurrencyManagerRow[]>(
      "SELECT * FROM currency_managers WHERE guild_id = ? ORDER BY created_at ASC",
      [guildId]
    );

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        guildId: row.guild_id,
        userId: row.user_id,
        createdAt: row.created_at.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Error fetching currency managers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { userId } = addManagerSchema.parse(body);

    const pool = db();

    // Check if already exists
    const [existing] = await pool.query<CurrencyManagerRow[]>(
      "SELECT * FROM currency_managers WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "User is already a currency manager" },
        { status: 409 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO currency_managers (guild_id, user_id) VALUES (?, ?)",
      [guildId, userId]
    );

    const [rows] = await pool.query<CurrencyManagerRow[]>(
      "SELECT * FROM currency_managers WHERE id = ?",
      [result.insertId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to add currency manager" },
        { status: 500 }
      );
    }

    // Notify bot
    notifyBotSettingsChanged({
      guildId,
      type: "currency-manager",
      action: "추가",
      details: `유저 ID: ${userId}`,
    });

    return NextResponse.json(
      {
        id: rows[0]!.id,
        guildId: rows[0]!.guild_id,
        userId: rows[0]!.user_id,
        createdAt: rows[0]!.created_at.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error adding currency manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { userId } = addManagerSchema.parse(body);

    const pool = db();
    await pool.execute(
      "DELETE FROM currency_managers WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    );

    // Notify bot
    notifyBotSettingsChanged({
      guildId,
      type: "currency-manager",
      action: "삭제",
      details: `유저 ID: ${userId}`,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error removing currency manager:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
