import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createContainer } from "@topia/infra";
import { z } from "zod";

// ========== Schema ==========

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  teamCount: z.number().min(2).max(10).optional(),
  enabled: z.boolean().optional(),
});

// ========== PATCH: 카테고리 수정 ==========

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; categoryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId, categoryId } = await params;
    const body = await request.json();

    // Validate request body
    const parseResult = updateCategorySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "유효하지 않은 요청입니다" },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    db(); // Initialize pool
    const container = createContainer();

    const result = await container.gameService.updateCategory(
      parseInt(categoryId, 10),
      data
    );

    if (!result.success) {
      if (result.error.type === "CATEGORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "카테고리를 찾을 수 없습니다" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: result.error.type },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("[API] Failed to update game category:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ========== DELETE: 카테고리 삭제 ==========

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; categoryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { categoryId } = await params;
    db(); // Initialize pool
    const container = createContainer();

    const result = await container.gameService.deleteCategory(parseInt(categoryId, 10));

    if (!result.success) {
      if (result.error.type === "CATEGORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "카테고리를 찾을 수 없습니다" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: result.error.type },
        { status: 400 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[API] Failed to delete game category:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
