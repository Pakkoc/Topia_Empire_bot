import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createContainer } from "@topia/infra";
import { z } from "zod";

// ========== Schema ==========

const updateSettingsSchema = z.object({
  managerRoleId: z.string().nullable().optional(),
  entryFee: z.string().optional(),
  rank1Percent: z.number().min(0).max(100).optional(),
  rank2Percent: z.number().min(0).max(100).optional(),
  rank3Percent: z.number().min(0).max(100).optional(),
  rank4Percent: z.number().min(0).max(100).optional(),
});

// ========== GET: 내전 설정 조회 ==========

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
      entryFee: settings.entryFee.toString(),
      rank1Percent: settings.rank1Percent,
      rank2Percent: settings.rank2Percent,
      rank3Percent: settings.rank3Percent,
      rank4Percent: settings.rank4Percent,
    });
  } catch (error) {
    console.error("[API] Failed to fetch game settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ========== PATCH: 내전 설정 업데이트 ==========

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

    // 순위 비율 합계 검증 (4개 모두 제공된 경우)
    if (
      data.rank1Percent !== undefined &&
      data.rank2Percent !== undefined &&
      data.rank3Percent !== undefined &&
      data.rank4Percent !== undefined
    ) {
      const total = data.rank1Percent + data.rank2Percent + data.rank3Percent + data.rank4Percent;
      if (total !== 100) {
        return NextResponse.json(
          { error: `순위 비율의 합계는 100%여야 합니다. 현재: ${total}%` },
          { status: 400 }
        );
      }
    }

    const container = createContainer();

    const result = await container.gameService.saveSettings(guildId, {
      managerRoleId: data.managerRoleId,
      entryFee: data.entryFee ? BigInt(data.entryFee) : undefined,
      rank1Percent: data.rank1Percent,
      rank2Percent: data.rank2Percent,
      rank3Percent: data.rank3Percent,
      rank4Percent: data.rank4Percent,
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
      entryFee: settings.entryFee.toString(),
      rank1Percent: settings.rank1Percent,
      rank2Percent: settings.rank2Percent,
      rank3Percent: settings.rank3Percent,
      rank4Percent: settings.rank4Percent,
    });
  } catch (error) {
    console.error("[API] Failed to update game settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
