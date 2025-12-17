import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // NextAuth 설정 후 인증 로직 추가 예정
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
