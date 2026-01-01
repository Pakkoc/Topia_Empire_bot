import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

// ========== Schema ==========

const createPanelSchema = z.object({
  channelId: z.string().min(1, "채널 ID가 필요합니다"),
});

// ========== POST: 토피 상점 패널 생성 ==========

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
    const response = await fetch(`${botApiUrl}/api/shop/topy/panel`, {
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
    });
  } catch (error) {
    console.error("[API] Failed to create topy shop panel:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
