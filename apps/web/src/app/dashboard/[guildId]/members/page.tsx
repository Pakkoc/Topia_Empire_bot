"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMembers } from "@/hooks/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { useDebounce } from "react-use";

export default function MembersPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"xp" | "level" | "joinedAt" | "name">("xp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useDebounce(
    () => {
      setSearch(searchInput);
      setPage(1);
    },
    300,
    [searchInput]
  );

  const { data, isLoading, error } = useMembers(guildId, {
    page,
    limit: 20,
    search,
    sortBy,
    sortOrder,
  });

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">멤버 관리</h1>
        <p className="text-slate-400">서버 멤버의 XP 및 레벨을 관리합니다.</p>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="이름 또는 ID로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="border-slate-700 bg-slate-800/50 pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-32 border-slate-700 bg-slate-800/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xp">XP</SelectItem>
              <SelectItem value="level">레벨</SelectItem>
              <SelectItem value="joinedAt">가입일</SelectItem>
              <SelectItem value="name">이름</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortOrder}
            className="border-slate-700 bg-slate-800/50"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              <span>로딩 중...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-900/50 bg-red-950/20">
          <CardContent className="py-8 text-center">
            <p className="text-red-400">멤버 목록을 불러오는데 실패했습니다.</p>
            <p className="mt-2 text-sm text-slate-500">
              봇이 서버에 연결되어 있는지 확인해주세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {data && data.members.length === 0 && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">멤버 목록</CardTitle>
            <CardDescription>서버의 모든 멤버</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">멤버가 없습니다.</p>
              <p className="text-sm text-slate-500">
                검색 조건을 변경해 보세요.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      {data && data.members.length > 0 && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">멤버 목록</CardTitle>
            <CardDescription>
              총 {data.pagination.total}명의 멤버
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.members.map((member, index) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-4 rounded-lg border border-slate-700/50 bg-slate-900/50 p-4 transition-colors hover:bg-slate-800/50"
                >
                  <span className="w-8 text-center text-sm text-slate-500">
                    #{(page - 1) * 20 + index + 1}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar ?? undefined} />
                    <AvatarFallback className="bg-indigo-600 text-white">
                      {member.displayName[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-medium text-white">
                      {member.displayName}
                    </p>
                    <p className="text-xs text-slate-500">{member.userId}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm text-slate-400">레벨</p>
                      <p className={`font-bold ${member.hasXpData ? "text-indigo-400" : "text-slate-600"}`}>
                        {member.level}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">XP</p>
                      <p className={`font-bold ${member.hasXpData ? "text-green-400" : "text-slate-600"}`}>
                        {member.xp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  페이지 {data.pagination.page} / {data.pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="border-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                    }
                    disabled={page === data.pagination.totalPages}
                    className="border-slate-700"
                  >
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-950/20">
        <CardContent className="flex items-start gap-4 py-6">
          <Badge className="bg-blue-600">안내</Badge>
          <div>
            <p className="text-slate-300">
              서버의 모든 멤버를 표시합니다. XP 데이터는 활동 후 업데이트됩니다.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              이름, XP, 레벨, 가입일 순으로 정렬할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
