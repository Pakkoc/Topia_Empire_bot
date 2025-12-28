import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createContainer } from "@topia/infra";
import { z } from "zod";

// ========== Schema ==========

const updateSettingsSchema = z.object({
  managerRoleId: z.string().nullable().optional(),
  betFeePercent: z.number().min(0).max(100).optional(),
  minBet: z.string().optional(),
  maxBet: z.string().optional(),
});

// ========== GET: 게임센터 설정 조회 ==========

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const container = createContainer();
    const result = await container.gameService.getSettings(guildId);

    if (!result.success) {
      console.error("[API] Game settings error:", result.error);
      return NextResponse.json(
        { error: result.error.type },
        { status: 400 }
      );
    }

    const settings = result.data;
    return NextResponse.json({
      guildId: settings.guildId,
      channelId: settings.channelId,
      messageId: settings.messageId,
      managerRoleId: settings.managerRoleId,
      betFeePercent: settings.betFeePercent,
      minBet: settings.minBet.toString(),
      maxBet: settings.maxBet.toString(),
    });
  } catch (error) {
    console.error("[API] Failed to fetch game settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ========== PATCH: 게임센터 설정 업데이트 ==========

export async function PATCH(
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
    const parseResult = updateSettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "유효하지 않은 요청입니다" },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const container = createContainer();

    const result = await container.gameService.saveSettings(guildId, {
      managerRoleId: data.managerRoleId,
      betFeePercent: data.betFeePercent,
      minBet: data.minBet ? BigInt(data.minBet) : undefined,
      maxBet: data.maxBet ? BigInt(data.maxBet) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.type },
        { status: 400 }
      );
    }

    const settings = result.data;
    return NextResponse.json({
      guildId: settings.guildId,
      channelId: settings.channelId,
      messageId: settings.messageId,
      managerRoleId: settings.managerRoleId,
      betFeePercent: settings.betFeePercent,
      minBet: settings.minBet.toString(),
      maxBet: settings.maxBet.toString(),
    });
  } catch (error) {
    console.error("[API] Failed to update game settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
