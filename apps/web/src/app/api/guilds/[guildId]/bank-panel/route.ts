import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

// ========== Schema ==========

const createPanelSchema = z.object({
  channelId: z.string().min(1, "채널 ID가 필요합니다"),
});

// ========== Row Interface ==========

interface CurrencySettingsRow extends RowDataPacket {
  bank_panel_channel_id: string | null;
  bank_panel_message_id: string | null;
  bank_name: string;
}

// ========== GET: 은행 패널 설정 조회 ==========

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const pool = db();

    const [rows] = await pool.query<CurrencySettingsRow[]>(
      `SELECT bank_panel_channel_id, bank_panel_message_id, bank_name
       FROM currency_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        channelId: null,
        messageId: null,
        bankName: "디토뱅크",
      });
    }

    return NextResponse.json({
      channelId: rows[0]!.bank_panel_channel_id,
      messageId: rows[0]!.bank_panel_message_id,
      bankName: rows[0]!.bank_name || "디토뱅크",
    });
  } catch (error) {
    console.error("[API] Failed to get bank panel settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ========== POST: 은행 패널 생성 ==========

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const body = await request.json();

    // Validate request body
    const parseResult = createPanelSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "유효하지 않은 요청입니다" },
        { status: 400 }
      );
    }

    const { channelId } = parseResult.data;

    // Call bot API to create panel
    const botApiUrl = process.env["BOT_API_URL"] || "http://localhost:3001";
    const response = await fetch(`${botApiUrl}/api/bank/panel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        guildId,
        channelId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "패널 생성에 실패했습니다" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      messageId: data.messageId,
      channelId,
    });
  } catch (error) {
    console.error("[API] Failed to create bank panel:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ========== DELETE: 은행 패널 삭제 ==========

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;

    // Call bot API to delete panel
    const botApiUrl = process.env["BOT_API_URL"] || "http://localhost:3001";
    const response = await fetch(`${botApiUrl}/api/bank/panel`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ guildId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "패널 삭제에 실패했습니다" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete bank panel:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
