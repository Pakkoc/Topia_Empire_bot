import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createContainer } from "@topia/infra";
import { z } from "zod";

// ========== Schema ==========

const updateSettingsSchema = z.object({
  managerRoleId: z.string().nullable().optional(),
  approvalChannelId: z.string().nullable().optional(),
  entryFee: z.string().optional(),
  rankRewards: z.record(z.string(), z.number().min(0).max(100)).optional(),
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
    db(); // Initialize pool
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
      approvalChannelId: settings.approvalChannelId,
      entryFee: settings.entryFee.toString(),
      rankRewards: settings.rankRewards,
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

    // Convert string keys to number keys for rankRewards
    let parsedRankRewards: Record<number, number> | undefined;
    if (data.rankRewards) {
      parsedRankRewards = Object.fromEntries(
        Object.entries(data.rankRewards).map(([k, v]) => [parseInt(k, 10), v])
      );

      // 순위 비율 합계 검증
      const total = Object.values(parsedRankRewards).reduce((sum, v) => sum + v, 0);
      if (total !== 100) {
        return NextResponse.json(
          { error: `순위 비율의 합계는 100%여야 합니다. 현재: ${total}%` },
          { status: 400 }
        );
      }
    }

    db(); // Initialize pool
    const container = createContainer();

    const result = await container.gameService.saveSettings(guildId, {
      managerRoleId: data.managerRoleId,
      approvalChannelId: data.approvalChannelId,
      entryFee: data.entryFee ? BigInt(data.entryFee) : undefined,
      rankRewards: parsedRankRewards,
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
      approvalChannelId: settings.approvalChannelId,
      entryFee: settings.entryFee.toString(),
      rankRewards: settings.rankRewards,
    });
  } catch (error) {
    console.error("[API] Failed to update game settings:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
