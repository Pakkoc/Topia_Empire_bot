"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useXpHotTimes,
  useCreateXpHotTime,
  useUpdateXpHotTime,
  useDeleteXpHotTime,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Clock, Sparkles } from "lucide-react";
import { XpHotTime } from "@/types/xp";

const hotTimeFormSchema = z.object({
  type: z.enum(["text", "voice", "all"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  multiplier: z.coerce.number().min(1).max(10),
  enabled: z.boolean(),
});

type HotTimeFormValues = z.infer<typeof hotTimeFormSchema>;

const typeLabels = {
  text: "텍스트",
  voice: "음성",
  all: "전체",
};

export default function HotTimeSettingsPage() {
  const params = useParams();
  const guildId = params['guildId'] as string;
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const { data: hotTimes, isLoading } = useXpHotTimes(guildId);
  const createHotTime = useCreateXpHotTime(guildId);
  const updateHotTime = useUpdateXpHotTime(guildId);
  const deleteHotTime = useDeleteXpHotTime(guildId);

  const form = useForm<HotTimeFormValues>({
    resolver: zodResolver(hotTimeFormSchema),
    defaultValues: {
      type: "all",
      startTime: "18:00",
      endTime: "22:00",
      multiplier: 2,
      enabled: true,
    },
  });

  const onSubmit = async (data: HotTimeFormValues) => {
    try {
      await createHotTime.mutateAsync(data);
      toast({
        title: "핫타임 추가 완료",
        description: "새로운 핫타임이 추가되었습니다.",
      });
      setIsAdding(false);
      form.reset();
    } catch {
      toast({
        title: "추가 실패",
        description: "핫타임을 추가하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (hotTime: XpHotTime) => {
    try {
      await updateHotTime.mutateAsync({
        id: hotTime.id,
        data: { enabled: !hotTime.enabled },
      });
      toast({
        title: hotTime.enabled ? "핫타임 비활성화" : "핫타임 활성화",
        description: `핫타임이 ${hotTime.enabled ? "비활성화" : "활성화"}되었습니다.`,
      });
    } catch {
      toast({
        title: "변경 실패",
        description: "상태를 변경하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteHotTime.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "핫타임이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "핫타임을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardContent className="py-8">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
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
          <h1 className="text-2xl font-bold text-white">XP 핫타임</h1>
          <p className="text-slate-400">특정 시간대에 XP 배율을 증가시킵니다.</p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          핫타임 추가
        </Button>
      </div>

      {/* Add New Hot Time Form */}
      {isAdding && (
        <Card className="border-indigo-500/50 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">새 핫타임 추가</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">유형</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-700 bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="text">텍스트</SelectItem>
                            <SelectItem value="voice">음성</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">시작 시간</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
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
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">종료 시간</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
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
                    name="multiplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">배율</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="1"
                            max="10"
                            {...field}
                            className="border-slate-700 bg-slate-900"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                    disabled={createHotTime.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createHotTime.isPending ? "추가 중..." : "추가"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Hot Times List */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">핫타임 목록</CardTitle>
          <CardDescription>설정된 XP 핫타임 시간대</CardDescription>
        </CardHeader>
        <CardContent>
          {hotTimes && hotTimes.length > 0 ? (
            <div className="space-y-3">
              {hotTimes.map((hotTime) => (
                <div
                  key={hotTime.id}
                  className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {hotTime.startTime} - {hotTime.endTime}
                        </span>
                        <Badge variant="secondary">{typeLabels[hotTime.type]}</Badge>
                        <Badge className="bg-amber-600">x{hotTime.multiplier}</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-slate-400">
                        <Clock className="h-3 w-3" />
                        {hotTime.enabled ? "활성화됨" : "비활성화됨"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={hotTime.enabled}
                      onCheckedChange={() => handleToggle(hotTime)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(hotTime.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Sparkles className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">설정된 핫타임이 없습니다.</p>
              <p className="text-sm text-slate-500">핫타임을 추가하여 특정 시간대에 XP 배율을 높이세요.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
