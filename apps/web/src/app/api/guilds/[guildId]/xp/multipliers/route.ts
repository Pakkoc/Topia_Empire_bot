import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createXpMultiplierSchema, updateXpMultiplierSchema } from "@/types/xp";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface MultiplierRow extends RowDataPacket {
  id: number;
  guild_id: string;
  target_type: "channel" | "role";
  target_id: string;
  multiplier: number;
  created_at: Date;
}

function rowToMultiplier(row: MultiplierRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    targetType: row.target_type,
    targetId: row.target_id,
    multiplier: Number(row.multiplier),
    createdAt: row.created_at,
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
    const [rows] = await pool.query<MultiplierRow[]>(
      `SELECT * FROM xp_multipliers WHERE guild_id = ? ORDER BY target_type, created_at DESC`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToMultiplier));
  } catch (error) {
    console.error("Error fetching multipliers:", error);
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
    const validatedData = createXpMultiplierSchema.parse(body);

    const pool = db();

    // Check for duplicates
    const [existing] = await pool.query<MultiplierRow[]>(
      `SELECT id FROM xp_multipliers WHERE guild_id = ? AND target_type = ? AND target_id = ?`,
      [guildId, validatedData.targetType, validatedData.targetId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Multiplier already exists for this target" },
        { status: 409 }
      );
    }

    // Insert new multiplier
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO xp_multipliers (guild_id, target_type, target_id, multiplier) VALUES (?, ?, ?, ?)`,
      [guildId, validatedData.targetType, validatedData.targetId, validatedData.multiplier]
    );

    const newMultiplier = {
      id: result.insertId,
      guildId,
      targetType: validatedData.targetType,
      targetId: validatedData.targetId,
      multiplier: validatedData.multiplier,
    };

    notifyBotSettingsChanged({
      guildId,
      type: 'xp-multiplier',
      action: '추가',
      details: `${validatedData.targetType === 'channel' ? '채널' : '역할'} 배율: ${validatedData.multiplier}x`,
    });

    return NextResponse.json(newMultiplier, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating multiplier:", error);
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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validatedData = updateXpMultiplierSchema.parse(body);

    const pool = db();
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE xp_multipliers SET multiplier = ? WHERE id = ? AND guild_id = ?`,
      [validatedData.multiplier, parseInt(id), guildId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Multiplier not found" }, { status: 404 });
    }

    notifyBotSettingsChanged({
      guildId,
      type: 'xp-multiplier',
      action: '수정',
      details: `배율: ${validatedData.multiplier}x`,
    });

    return NextResponse.json({ success: true, multiplier: validatedData.multiplier });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating multiplier:", error);
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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const pool = db();
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM xp_multipliers WHERE id = ? AND guild_id = ?`,
      [parseInt(id), guildId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Multiplier not found" }, { status: 404 });
    }

    notifyBotSettingsChanged({
      guildId,
      type: 'xp-multiplier',
      action: '삭제',
      details: `ID: ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting multiplier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
