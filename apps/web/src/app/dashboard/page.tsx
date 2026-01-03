"use client";

import { useGuilds } from "@/hooks/queries/use-guilds";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { getBotInviteUrl } from "@/lib/discord";

function getGuildIconUrl(guildId: string, icon: string | null) {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: guilds, isLoading, error } = useGuilds();

  return (
    <main className="min-h-screen bg-black overflow-hidden">
      {/* Aurora Background Effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-1/3 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2 opacity-25"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)",
          }}
        />
        <div
          className="absolute right-0 bottom-0 h-[600px] w-[600px] opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at bottom right, rgba(59, 130, 246, 0.3) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-12 py-4">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="Nexus" width={140} height={48} className="h-12 w-auto" />
          </Link>

          <div className="flex items-center gap-4">
            {session?.user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm">
                      {session.user.name?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-white">{session.user.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-white/50 hover:text-white hover:bg-white/5"
                >
                  <Icon icon="solar:logout-2-linear" className="w-4 h-4 mr-2" />
                  로그아웃
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-12 py-12">
        {/* Page Header */}
        <div className="mb-10 animate-fade-up">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">서버 선택</h1>
          <p className="text-white/50">
            관리할 디스코드 서버를 선택하세요
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-white/5 rounded-2xl border border-white/5 p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-white/10" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-32 rounded-lg bg-white/10" />
                    <div className="h-4 w-20 rounded-lg bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:danger-triangle-linear" className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 font-medium mb-2">서버 목록을 불러오는데 실패했습니다</p>
            <p className="text-white/40 text-sm mb-6">잠시 후 다시 시도해주세요</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Icon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
              다시 시도
            </Button>
          </div>
        )}

        {/* Empty State */}
        {guilds && guilds.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center animate-fade-up">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon icon="solar:server-2-linear" className="w-10 h-10 text-indigo-400" />
            </div>
            <p className="text-white font-medium text-lg mb-2">관리 권한이 있는 서버가 없습니다</p>
            <p className="text-white/40 text-sm">
              서버 관리 또는 관리자 권한이 필요합니다
            </p>
          </div>
        )}

        {/* Guild Grid */}
        {guilds && guilds.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild, index) => (
              <Link
                key={guild.id}
                href={`/dashboard/${guild.id}`}
                className="group animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-indigo-500/30 p-5 transition-all duration-300">
                  {/* Hover Glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 rounded-2xl transition-all duration-300" />

                  <div className="relative flex items-center gap-4">
                    <Avatar className="h-14 w-14 rounded-xl">
                      <AvatarImage src={getGuildIconUrl(guild.id, guild.icon) ?? undefined} />
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg font-semibold">
                        {guild.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {guild.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {guild.owner && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-xs font-medium">
                            <Icon icon="solar:crown-linear" className="w-3 h-3" />
                            소유자
                          </span>
                        )}
                        {guild.botJoined ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-xs font-medium">
                            <Icon icon="solar:check-circle-linear" className="w-3 h-3" />
                            봇 활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white/50 text-xs font-medium">
                            <Icon icon="solar:close-circle-linear" className="w-3 h-3" />
                            봇 미설치
                          </span>
                        )}
                      </div>
                    </div>

                    <Icon
                      icon="solar:arrow-right-linear"
                      className="w-5 h-5 text-white/30 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Bot Invite Section */}
        <div className="mt-12 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-sm rounded-2xl border border-indigo-500/20 p-8">
            {/* Background Glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />

            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Icon icon="solar:add-circle-linear" className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">봇이 서버에 없나요?</h3>
                  <p className="text-white/50 text-sm">
                    봇을 서버에 초대하여 모든 기능을 사용하세요
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
              >
                <a href={getBotInviteUrl()} target="_blank" rel="noopener noreferrer">
                  <Icon icon="ic:baseline-discord" className="w-5 h-5 mr-2" />
                  봇 초대하기
                  <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
