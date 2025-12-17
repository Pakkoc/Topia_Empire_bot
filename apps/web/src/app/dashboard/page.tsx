"use client";

import { useGuilds } from "@/hooks/queries/use-guilds";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { getBotInviteUrl } from "@/lib/discord";

function getGuildIconUrl(guildId: string, icon: string | null) {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: guilds, isLoading, error } = useGuilds();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-white">
            Topia Empire
          </Link>
          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback>
                      {session.user.name?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-slate-300">{session.user.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-slate-400 hover:text-white"
                >
                  로그아웃
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">서버 선택</h1>
          <p className="mt-2 text-slate-400">
            관리할 디스코드 서버를 선택하세요.
          </p>
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-slate-700" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 rounded bg-slate-700" />
                      <div className="h-3 w-20 rounded bg-slate-700" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card className="border-red-900/50 bg-red-950/20">
            <CardContent className="py-8 text-center">
              <p className="text-red-400">서버 목록을 불러오는데 실패했습니다.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                다시 시도
              </Button>
            </CardContent>
          </Card>
        )}

        {guilds && guilds.length === 0 && (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">
                관리 권한이 있는 서버가 없습니다.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                서버 관리 또는 관리자 권한이 필요합니다.
              </p>
            </CardContent>
          </Card>
        )}

        {guilds && guilds.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <Link key={guild.id} href={`/dashboard/${guild.id}`}>
                <Card className="group cursor-pointer border-slate-700 bg-slate-800/50 transition-all hover:border-indigo-500/50 hover:bg-slate-800">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={getGuildIconUrl(guild.id, guild.icon) ?? undefined} />
                        <AvatarFallback className="bg-indigo-600 text-white">
                          {guild.name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <CardTitle className="truncate text-lg text-white group-hover:text-indigo-400">
                          {guild.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          {guild.owner && (
                            <Badge variant="secondary" className="text-xs">
                              소유자
                            </Badge>
                          )}
                          {guild.botJoined ? (
                            <Badge className="bg-green-600 text-xs">봇 활성</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-slate-400">
                              봇 미설치
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Bot Invite Section */}
        <div className="mt-12">
          <Card className="border-indigo-500/30 bg-indigo-950/20">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <h3 className="font-semibold text-white">봇이 서버에 없나요?</h3>
                <p className="text-sm text-slate-400">
                  봇을 서버에 초대하여 모든 기능을 사용하세요.
                </p>
              </div>
              <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                <a href={getBotInviteUrl()} target="_blank" rel="noopener noreferrer">
                  봇 초대하기
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
