import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createXpHotTimeSchema } from "@/types/xp";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface HotTimeRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: "text" | "voice" | "all";
  start_time: string;
  end_time: string;
  multiplier: number;
  enabled: boolean;
  created_at: Date;
}

function rowToHotTime(row: HotTimeRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    type: row.type,
    startTime: row.start_time,
    endTime: row.end_time,
    multiplier: Number(row.multiplier),
    enabled: row.enabled,
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
    const [rows] = await pool.query<HotTimeRow[]>(
      `SELECT * FROM xp_hot_times WHERE guild_id = ? ORDER BY start_time`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToHotTime));
  } catch (error) {
    console.error("Error fetching hot times:", error);
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
    const validatedData = createXpHotTimeSchema.parse(body);

    const pool = db();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO xp_hot_times (guild_id, type, start_time, end_time, multiplier, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        validatedData.type,
        validatedData.startTime,
        validatedData.endTime,
        validatedData.multiplier,
        validatedData.enabled ?? true,
      ]
    );

    const newHotTime = {
      id: result.insertId,
      guildId,
      ...validatedData,
      enabled: validatedData.enabled ?? true,
    };

    return NextResponse.json(newHotTime, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating hot time:", error);
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
    const validatedData = createXpHotTimeSchema.partial().parse(body);

    const pool = db();

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (validatedData.type !== undefined) {
      updates.push("type = ?");
      values.push(validatedData.type);
    }
    if (validatedData.startTime !== undefined) {
      updates.push("start_time = ?");
      values.push(validatedData.startTime);
    }
    if (validatedData.endTime !== undefined) {
      updates.push("end_time = ?");
      values.push(validatedData.endTime);
    }
    if (validatedData.multiplier !== undefined) {
      updates.push("multiplier = ?");
      values.push(validatedData.multiplier);
    }
    if (validatedData.enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(validatedData.enabled);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(parseInt(id), guildId);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE xp_hot_times SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Hot time not found" }, { status: 404 });
    }

    // Fetch and return updated hot time
    const [rows] = await pool.query<HotTimeRow[]>(
      `SELECT * FROM xp_hot_times WHERE id = ?`,
      [parseInt(id)]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Hot time not found" }, { status: 404 });
    }

    return NextResponse.json(rowToHotTime(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating hot time:", error);
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
      `DELETE FROM xp_hot_times WHERE id = ? AND guild_id = ?`,
      [parseInt(id), guildId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Hot time not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hot time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
