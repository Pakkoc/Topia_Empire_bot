import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createContainer } from "@topia/infra";
import { z } from "zod";

// ========== Schema ==========

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  teamCount: z.number().min(2).max(10),
});

// ========== GET: 카테고리 목록 조회 ==========

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
    const result = await container.gameService.getCategories(guildId);

    if (!result.success) {
      console.error("[API] Game categories error:", result.error);
      return NextResponse.json(
        { error: result.error.type },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("[API] Failed to fetch game categories:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ========== POST: 카테고리 생성 ==========

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
    const parseResult = createCategorySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "유효하지 않은 요청입니다" },
        { status: 400 }
      );
    }

    const { name, teamCount } = parseResult.data;
    db(); // Initialize pool
    const container = createContainer();

    const result = await container.gameService.createCategory({ guildId, name, teamCount });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.type },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to create game category:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
