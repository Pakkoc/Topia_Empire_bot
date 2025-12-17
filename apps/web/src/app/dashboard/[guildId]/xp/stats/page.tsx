"use client";

import { useParams } from "next/navigation";
import { useGuildStats, useMembers } from "@/hooks/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart3, MessageSquare, Mic2, Trophy, Users, TrendingUp, Loader2 } from "lucide-react";

export default function XpStatsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);
  const { data: membersData, isLoading: membersLoading } = useMembers(guildId, {
    limit: 10,
    sortBy: "xp",
    sortOrder: "desc",
  });

  const isLoading = statsLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse border-slate-700 bg-slate-800/50">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 rounded bg-slate-700" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 rounded bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">XP 통계</h1>
        <p className="text-slate-400">서버의 XP 및 활동 통계를 확인합니다.</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              총 멤버
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              {stats?.totalMembers.toLocaleString() ?? 0}
            </p>
            <p className="text-sm text-slate-400">
              XP 보유: {stats?.membersWithXp.toLocaleString() ?? 0}명 · 평균 레벨: Lv. {stats?.avgLevel ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              총 XP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              {stats?.totalXp.toLocaleString() ?? 0}
            </p>
            <p className="text-sm text-slate-400">
              최고 레벨: Lv. {stats?.maxLevel ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              XP 시스템 상태
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats?.xpEnabled ? (
                <Badge className="bg-green-600">XP 활성</Badge>
              ) : (
                <Badge variant="outline" className="text-slate-400">XP 비활성</Badge>
              )}
              {stats?.textXpEnabled && (
                <Badge variant="secondary">텍스트</Badge>
              )}
              {stats?.voiceXpEnabled && (
                <Badge variant="secondary">음성</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              텍스트 활동
            </CardTitle>
            <CardDescription>채팅 메시지 기반 XP 획득 통계</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">오늘 활동 멤버</span>
                <span className="font-medium text-white">
                  {stats?.todayTextActive.toLocaleString() ?? 0}명
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">텍스트 XP</span>
                <span className="font-medium text-white">
                  {stats?.textXpEnabled ? (
                    <Badge className="bg-green-600">활성화</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400">비활성화</Badge>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mic2 className="h-5 w-5 text-green-500" />
              음성 활동
            </CardTitle>
            <CardDescription>음성 채널 기반 XP 획득 통계</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">오늘 활동 멤버</span>
                <span className="font-medium text-white">
                  {stats?.todayVoiceActive.toLocaleString() ?? 0}명
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">음성 XP</span>
                <span className="font-medium text-white">
                  {stats?.voiceXpEnabled ? (
                    <Badge className="bg-green-600">활성화</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400">비활성화</Badge>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            리더보드
          </CardTitle>
          <CardDescription>XP 상위 멤버</CardDescription>
        </CardHeader>
        <CardContent>
          {membersData && membersData.members.length > 0 ? (
            <div className="space-y-3">
              {membersData.members.map((member, index) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-4 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      index === 0
                        ? "bg-amber-500 text-black"
                        : index === 1
                        ? "bg-slate-400 text-black"
                        : index === 2
                        ? "bg-amber-700 text-white"
                        : "bg-slate-700 text-white"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar ?? undefined} />
                    <AvatarFallback className="bg-indigo-600 text-white">
                      {member.displayName?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-medium text-white">
                      {member.displayName ?? member.username ?? member.userId}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm text-slate-400">레벨</p>
                      <p className="font-bold text-indigo-400">{member.level}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">XP</p>
                      <p className="font-bold text-green-400">
                        {member.xp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">아직 데이터가 없습니다.</p>
              <p className="text-sm text-slate-500">
                멤버들이 활동하면 리더보드가 표시됩니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-950/20">
        <CardContent className="flex items-start gap-4 py-6">
          <Badge className="bg-blue-600">안내</Badge>
          <div>
            <p className="text-slate-300">
              통계 데이터는 봇이 서버에서 XP를 수집하면서 업데이트됩니다.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              XP 시스템을 활성화하고 멤버들이 채팅/음성 활동을 하면 데이터가 쌓입니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
