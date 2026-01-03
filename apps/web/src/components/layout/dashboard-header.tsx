"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@iconify/react";

export function DashboardHeader() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl px-6">
      <Link href="/dashboard" className="flex items-center">
        <Image src="/logo.png" alt="Nexus" width={120} height={40} className="h-10 w-auto" />
      </Link>

      <div className="flex items-center gap-4">
        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 px-3 py-2 h-auto rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={session.user.image ?? undefined} />
                  <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm">
                    {session.user.name?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-white">{session.user.name}</span>
                  <span className="text-[10px] text-white/40">관리자</span>
                </div>
                <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-white/40 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-slate-900/95 backdrop-blur-xl border-white/10 p-2"
            >
              <div className="px-3 py-2 mb-2">
                <p className="text-sm font-medium text-white">{session.user.name}</p>
                <p className="text-xs text-white/40">{session.user.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 cursor-pointer">
                <Icon icon="solar:user-linear" className="h-4 w-4" />
                프로필
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 cursor-pointer">
                <Icon icon="solar:settings-linear" className="h-4 w-4" />
                설정
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10 my-2" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
              >
                <Icon icon="solar:logout-2-linear" className="h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
