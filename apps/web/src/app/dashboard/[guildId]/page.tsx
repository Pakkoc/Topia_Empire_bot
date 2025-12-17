"use client";

import { useParams } from "next/navigation";
import { useGuilds, useGuildStats } from "@/hooks/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BarChart3, MessageSquare, Mic2, Settings, Trophy, Users, Zap, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { getBotInviteUrl } from "@/lib/discord";

export default function GuildDashboardPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { data: guilds, isLoading: guildsLoading } = useGuilds();
  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);

  const guild = guilds?.find((g) => g.id === guildId);
  const isLoading = guildsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse border-slate-700 bg-slate-800/50">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 rounded bg-slate-700" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      title: "XP 시스템",
      description: "텍스트 및 음성 XP 설정 관리",
      href: `/dashboard/${guildId}/xp/text`,
      icon: Zap,
      color: "text-yellow-500",
    },
    {
      title: "레벨 보상",
      description: "레벨업 시 지급할 역할 설정",
      href: `/dashboard/${guildId}/xp/rewards`,
      icon: Trophy,
      color: "text-amber-500",
    },
    {
      title: "통계",
      description: "서버 활동 및 XP 통계 확인",
      href: `/dashboard/${guildId}/xp/stats`,
      icon: BarChart3,
      color: "text-blue-500",
    },
    {
      title: "멤버 관리",
      description: "서버 멤버 XP 및 레벨 관리",
      href: `/dashboard/${guildId}/members`,
      icon: Users,
      color: "text-green-500",
    },
    {
      title: "설정",
      description: "봇 기본 설정 및 권한 관리",
      href: `/dashboard/${guildId}/settings`,
      icon: Settings,
      color: "text-slate-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-slate-400">
          {guild?.name ?? "서버"} 관리 대시보드
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              총 멤버
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {stats?.totalMembers.toLocaleString() ?? 0}
            </p>
            {stats?.membersWithXp !== undefined && stats.membersWithXp > 0 && (
              <p className="text-sm text-slate-400">
                XP 보유: {stats.membersWithXp.toLocaleString()}명
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              오늘 텍스트 활동
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {stats?.todayTextActive.toLocaleString() ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-400">명</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Mic2 className="h-4 w-4" />
              오늘 음성 활동
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {stats?.todayVoiceActive.toLocaleString() ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-400">명</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              XP 시스템
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.xpEnabled ? (
              <Badge className="bg-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                활성
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-400">
                <XCircle className="mr-1 h-3 w-3" />
                비활성
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      {stats && stats.totalMembers > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardDescription>총 XP</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-indigo-400">
                {stats.totalXp.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardDescription>평균 레벨</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-green-400">
                Lv. {stats.avgLevel}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardDescription>최고 레벨</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-amber-400">
                Lv. {stats.maxLevel}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">빠른 설정</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
              <Card className="group cursor-pointer border-slate-700 bg-slate-800/50 transition-all hover:border-indigo-500/50 hover:bg-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white group-hover:text-indigo-400">
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                    {action.title}
                  </CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Bot Status */}
      {!guild?.botJoined && (
        <Card className="border-amber-500/30 bg-amber-950/20">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <h3 className="font-semibold text-amber-400">봇이 서버에 없습니다</h3>
              <p className="text-sm text-slate-400">
                봇을 서버에 초대해야 모든 기능을 사용할 수 있습니다.
              </p>
            </div>
            <Button
              asChild
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <a href={getBotInviteUrl(guildId)} target="_blank" rel="noopener noreferrer">
                봇 초대하기
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
