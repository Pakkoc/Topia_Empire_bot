import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getPool } from "@topia/infra";
import type { RowDataPacket } from "mysql2/promise";

// ========== Row Interface ==========

interface ShopPanelSettingsRow extends RowDataPacket {
  guild_id: string;
  currency_type: 'topy' | 'ruby';
  channel_id: string | null;
  message_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ========== GET: 상점 패널 설정 조회 ==========

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
    const pool = getPool();

    const [rows] = await pool.execute<ShopPanelSettingsRow[]>(
      'SELECT * FROM shop_panel_settings WHERE guild_id = ? ORDER BY currency_type ASC',
      [guildId]
    );

    const settings = rows.map(row => ({
      guildId: row.guild_id,
      currencyType: row.currency_type,
      channelId: row.channel_id,
      messageId: row.message_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[API] Failed to get shop panel settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
