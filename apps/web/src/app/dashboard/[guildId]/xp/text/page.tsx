"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useXpSettings, useUpdateXpSettings } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const textXpFormSchema = z.object({
  textXpEnabled: z.boolean(),
  textXpMin: z.coerce.number().min(0).max(1000),
  textXpMax: z.coerce.number().min(0).max(1000),
  textCooldownSeconds: z.coerce.number().min(0).max(3600),
  textMaxPerCooldown: z.coerce.number().min(1).max(100),
});

type TextXpFormValues = z.infer<typeof textXpFormSchema>;

export default function TextXpSettingsPage() {
  const params = useParams();
  const guildId = params['guildId'] as string;
  const { toast } = useToast();

  const { data: settings, isLoading } = useXpSettings(guildId);
  const updateSettings = useUpdateXpSettings(guildId);

  const form = useForm<TextXpFormValues>({
    resolver: zodResolver(textXpFormSchema),
    defaultValues: {
      textXpEnabled: true,
      textXpMin: 15,
      textXpMax: 25,
      textCooldownSeconds: 60,
      textMaxPerCooldown: 1,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        textXpEnabled: settings.textXpEnabled,
        textXpMin: settings.textXpMin,
        textXpMax: settings.textXpMax,
        textCooldownSeconds: settings.textCooldownSeconds,
        textMaxPerCooldown: settings.textMaxPerCooldown,
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: TextXpFormValues) => {
    try {
      await updateSettings.mutateAsync(data);
      toast({
        title: "설정 저장 완료",
        description: "텍스트 XP 설정이 저장되었습니다.",
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
              {[...Array(5)].map((_, i) => (
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
        <h1 className="text-2xl font-bold text-white">텍스트 XP 설정</h1>
        <p className="text-slate-400">채팅 메시지 기반 경험치 부여 설정</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">기본 설정</CardTitle>
              <CardDescription>텍스트 채널에서 XP를 얻는 방식을 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="textXpEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-slate-700 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-white">텍스트 XP 활성화</FormLabel>
                      <FormDescription>
                        채팅 메시지로 XP를 획득할 수 있도록 합니다.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="textXpMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">최소 XP</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="border-slate-700 bg-slate-900"
                        />
                      </FormControl>
                      <FormDescription>
                        메시지당 최소 획득 XP
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="textXpMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">최대 XP</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="border-slate-700 bg-slate-900"
                        />
                      </FormControl>
                      <FormDescription>
                        메시지당 최대 획득 XP
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="textCooldownSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">쿨다운 (초)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="border-slate-700 bg-slate-900"
                        />
                      </FormControl>
                      <FormDescription>
                        XP 획득 간격 (0~3600초)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="textMaxPerCooldown"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">쿨다운당 최대 횟수</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="border-slate-700 bg-slate-900"
                        />
                      </FormControl>
                      <FormDescription>
                        쿨다운 내 XP 획득 가능 횟수
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
    </div>
  );
}
