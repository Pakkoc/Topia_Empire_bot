"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useXpSettings, useUpdateXpSettings } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { Settings, Zap, AlertTriangle } from "lucide-react";

const settingsFormSchema = z.object({
  enabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function GuildSettingsPage() {
  const params = useParams();
  const guildId = params['guildId'] as string;
  const { toast } = useToast();

  const { data: xpSettings, isLoading } = useXpSettings(guildId);
  const updateSettings = useUpdateXpSettings(guildId);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      enabled: true,
    },
  });

  useEffect(() => {
    if (xpSettings) {
      form.reset({
        enabled: xpSettings.enabled,
      });
    }
  }, [xpSettings, form]);

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      await updateSettings.mutateAsync(data);
      toast({
        title: "설정 저장 완료",
        description: "설정이 저장되었습니다.",
      });
    } catch {
      toast({
        title: "저장 실패",
        description: "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardHeader>
            <div className="h-6 w-32 rounded bg-slate-700" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-slate-700" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-slate-400">봇 기본 설정을 관리합니다.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* XP System Toggle */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="h-5 w-5 text-yellow-500" />
                XP 시스템
              </CardTitle>
              <CardDescription>XP 시스템 전체를 켜거나 끕니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-slate-700 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-white">XP 시스템 활성화</FormLabel>
                      <FormDescription>
                        비활성화하면 모든 XP 획득이 중단됩니다.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateSettings.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Bot Info */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Settings className="h-5 w-5" />
            봇 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">서버 ID</span>
            <code className="text-sm text-slate-300">{guildId}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">봇 상태</span>
            <Badge variant="outline" className="text-slate-400">
              연결 대기
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30 bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            위험 구역
          </CardTitle>
          <CardDescription>주의가 필요한 작업</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-red-500/30 p-4">
            <div>
              <p className="font-medium text-white">XP 데이터 초기화</p>
              <p className="text-sm text-slate-400">
                이 서버의 모든 XP 데이터를 삭제합니다. 되돌릴 수 없습니다.
              </p>
            </div>
            <Button variant="destructive" disabled>
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
