"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useLevelRewards,
  useCreateLevelReward,
  useUpdateLevelReward,
  useDeleteLevelReward,
  useRoles,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Trophy, Star, Loader2 } from "lucide-react";
import { LevelReward } from "@/types/xp";

const rewardFormSchema = z.object({
  level: z.coerce.number().min(1).max(999),
  roleId: z.string().min(1, "역할을 선택해주세요"),
  removeOnHigherLevel: z.boolean(),
});

type RewardFormValues = z.infer<typeof rewardFormSchema>;

export default function LevelRewardsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const { data: rewards, isLoading } = useLevelRewards(guildId);
  const { data: roles, isLoading: rolesLoading } = useRoles(guildId);
  const createReward = useCreateLevelReward(guildId);
  const updateReward = useUpdateLevelReward(guildId);
  const deleteReward = useDeleteLevelReward(guildId);

  const form = useForm<RewardFormValues>({
    resolver: zodResolver(rewardFormSchema),
    defaultValues: {
      level: 5,
      roleId: "",
      removeOnHigherLevel: false,
    },
  });

  const onSubmit = async (data: RewardFormValues) => {
    try {
      await createReward.mutateAsync(data);
      toast({
        title: "보상 추가 완료",
        description: `레벨 ${data.level} 보상이 추가되었습니다.`,
      });
      setIsAdding(false);
      form.reset();
    } catch {
      toast({
        title: "추가 실패",
        description: "이미 존재하는 보상이거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggleRemove = async (reward: LevelReward) => {
    try {
      await updateReward.mutateAsync({
        id: reward.id,
        data: { removeOnHigherLevel: !reward.removeOnHigherLevel },
      });
      toast({
        title: "설정 변경 완료",
        description: "역할 제거 설정이 변경되었습니다.",
      });
    } catch {
      toast({
        title: "변경 실패",
        description: "설정을 변경하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteReward.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "레벨 보상이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "보상을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // Helper to get role name and color by ID
  const getRole = (id: string) => {
    return roles?.find((r) => r.id === id);
  };

  // Group rewards by level
  const sortedRewards = [...(rewards ?? [])].sort((a, b) => a.level - b.level);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardContent className="py-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded bg-slate-700" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">레벨 보상</h1>
          <p className="text-slate-400">특정 레벨 달성 시 지급할 역할을 설정합니다.</p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          보상 추가
        </Button>
      </div>

      {/* Add New Reward Form */}
      {isAdding && (
        <Card className="border-indigo-500/50 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">새 레벨 보상 추가</CardTitle>
            <CardDescription>
              레벨 달성 시 지급할 역할을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">레벨</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="999"
                            {...field}
                            className="border-slate-700 bg-slate-900"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">역할</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-700 bg-slate-900">
                              <SelectValue
                                placeholder={rolesLoading ? "로딩 중..." : "역할 선택"}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {rolesLoading ? (
                              <SelectItem value="loading" disabled>
                                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                로딩 중...
                              </SelectItem>
                            ) : roles && roles.length > 0 ? (
                              roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="h-3 w-3 rounded-full"
                                      style={{
                                        backgroundColor:
                                          role.color === 0
                                            ? "#99aab5"
                                            : `#${role.color.toString(16).padStart(6, "0")}`,
                                      }}
                                    />
                                    {role.name}
                                  </span>
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                역할이 없습니다
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="removeOnHigherLevel"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-3 space-y-0 rounded-lg border border-slate-700 p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-white">
                          상위 레벨 달성 시 역할 제거
                        </FormLabel>
                        <FormDescription>
                          다음 레벨 보상을 받으면 이 역할을 제거합니다.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAdding(false);
                      form.reset();
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={createReward.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createReward.isPending ? "추가 중..." : "추가"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Rewards List */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">보상 목록</CardTitle>
          <CardDescription>설정된 레벨 보상 역할</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedRewards.length > 0 ? (
            <div className="space-y-3">
              {sortedRewards.map((reward) => {
                const role = getRole(reward.roleId);
                return (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20">
                        <Star className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">
                            레벨 {reward.level}
                          </span>
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: role?.color
                                ? `#${role.color.toString(16).padStart(6, "0")}20`
                                : undefined,
                              color: role?.color
                                ? `#${role.color.toString(16).padStart(6, "0")}`
                                : undefined,
                              borderColor: role?.color
                                ? `#${role.color.toString(16).padStart(6, "0")}40`
                                : undefined,
                            }}
                          >
                            @{role?.name ?? reward.roleId}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                          {reward.removeOnHigherLevel
                            ? "상위 레벨 달성 시 제거됨"
                            : "영구 역할"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={reward.removeOnHigherLevel}
                          onCheckedChange={() => handleToggleRemove(reward)}
                        />
                        <span className="text-sm text-slate-400">제거</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(reward.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Trophy className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">설정된 레벨 보상이 없습니다.</p>
              <p className="text-sm text-slate-500">
                레벨 보상을 추가하여 유저들에게 동기를 부여하세요.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
