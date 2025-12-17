import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createXpExclusionSchema } from "@/types/xp";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ExclusionRow extends RowDataPacket {
  id: number;
  guild_id: string;
  target_type: "channel" | "role";
  target_id: string;
  created_at: Date;
}

function rowToExclusion(row: ExclusionRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    targetType: row.target_type,
    targetId: row.target_id,
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
    const [rows] = await pool.query<ExclusionRow[]>(
      `SELECT * FROM xp_exclusions WHERE guild_id = ? ORDER BY created_at DESC`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToExclusion));
  } catch (error) {
    console.error("Error fetching exclusions:", error);
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
    const validatedData = createXpExclusionSchema.parse(body);

    const pool = db();

    // Check for duplicates
    const [existing] = await pool.query<ExclusionRow[]>(
      `SELECT id FROM xp_exclusions WHERE guild_id = ? AND target_type = ? AND target_id = ?`,
      [guildId, validatedData.targetType, validatedData.targetId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Exclusion already exists" },
        { status: 409 }
      );
    }

    // Insert new exclusion
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO xp_exclusions (guild_id, target_type, target_id) VALUES (?, ?, ?)`,
      [guildId, validatedData.targetType, validatedData.targetId]
    );

    const newExclusion = {
      id: result.insertId,
      guildId,
      targetType: validatedData.targetType,
      targetId: validatedData.targetId,
    };

    return NextResponse.json(newExclusion, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating exclusion:", error);
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
      `DELETE FROM xp_exclusions WHERE id = ? AND guild_id = ?`,
      [parseInt(id), guildId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Exclusion not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting exclusion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
