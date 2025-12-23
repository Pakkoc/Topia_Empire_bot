import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createCurrencyMultiplierSchema } from "@/types/currency";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface MultiplierRow extends RowDataPacket {
  id: number;
  guild_id: string;
  target_type: "channel" | "role";
  target_id: string;
  multiplier: string;
}

function rowToMultiplier(row: MultiplierRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    targetType: row.target_type,
    targetId: row.target_id,
    multiplier: parseFloat(row.multiplier),
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
      `SELECT * FROM currency_multipliers WHERE guild_id = ?`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToMultiplier));
  } catch (error) {
    console.error("Error fetching currency multipliers:", error);
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
    const validatedData = createCurrencyMultiplierSchema.parse(body);

    const pool = db();

    // Check if already exists
    const [existing] = await pool.query<MultiplierRow[]>(
      `SELECT * FROM currency_multipliers WHERE guild_id = ? AND target_type = ? AND target_id = ?`,
      [guildId, validatedData.targetType, validatedData.targetId]
    );

    if (existing.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE currency_multipliers SET multiplier = ? WHERE id = ?`,
        [validatedData.multiplier, existing[0]!.id]
      );

      notifyBotSettingsChanged({
        guildId,
        type: 'currency-multiplier',
        action: '수정',
        details: `${validatedData.targetType}: x${validatedData.multiplier}`,
      });

      return NextResponse.json({
        id: existing[0]!.id,
        guildId,
        ...validatedData,
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO currency_multipliers (guild_id, target_type, target_id, multiplier)
       VALUES (?, ?, ?, ?)`,
      [guildId, validatedData.targetType, validatedData.targetId, validatedData.multiplier]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-multiplier',
      action: '추가',
      details: `${validatedData.targetType}: x${validatedData.multiplier}`,
    });

    return NextResponse.json({
      id: result.insertId,
      guildId,
      ...validatedData,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating currency multiplier:", error);
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
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { multiplier } = body;

    if (multiplier === undefined) {
      return NextResponse.json({ error: "multiplier is required" }, { status: 400 });
    }

    const pool = db();
    await pool.query(
      `UPDATE currency_multipliers SET multiplier = ? WHERE id = ? AND guild_id = ?`,
      [multiplier, id, guildId]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-multiplier',
      action: '수정',
      details: `배율: x${multiplier}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating currency multiplier:", error);
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
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    const pool = db();
    await pool.query(
      `DELETE FROM currency_multipliers WHERE id = ? AND guild_id = ?`,
      [id, guildId]
    );

    notifyBotSettingsChanged({
      guildId,
      type: 'currency-multiplier',
      action: '삭제',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting currency multiplier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
