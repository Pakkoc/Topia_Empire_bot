"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useXpSettings, useUpdateXpSettings } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { MessageSquare, Mic2 } from "lucide-react";

const xpSettingsFormSchema = z.object({
  // 텍스트 XP
  textXpEnabled: z.boolean(),
  textXpMin: z.coerce.number().min(0).max(1000),
  textXpMax: z.coerce.number().min(0).max(1000),
  textCooldownSeconds: z.coerce.number().min(0).max(3600),
  textMaxPerCooldown: z.coerce.number().min(1).max(100),
  // 음성 XP
  voiceXpEnabled: z.boolean(),
  voiceXpMin: z.coerce.number().min(0).max(1000),
  voiceXpMax: z.coerce.number().min(0).max(1000),
  voiceCooldownSeconds: z.coerce.number().min(0).max(3600),
  voiceMaxPerCooldown: z.coerce.number().min(1).max(100),
});

type XpSettingsFormValues = z.infer<typeof xpSettingsFormSchema>;

export default function XpSettingsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  const { data: settings, isLoading } = useXpSettings(guildId);
  const updateSettings = useUpdateXpSettings(guildId);

  const form = useForm<XpSettingsFormValues>({
    resolver: zodResolver(xpSettingsFormSchema),
    defaultValues: {
      textXpEnabled: true,
      textXpMin: 15,
      textXpMax: 25,
      textCooldownSeconds: 60,
      textMaxPerCooldown: 1,
      voiceXpEnabled: true,
      voiceXpMin: 10,
      voiceXpMax: 20,
      voiceCooldownSeconds: 60,
      voiceMaxPerCooldown: 1,
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
        voiceXpEnabled: settings.voiceXpEnabled,
        voiceXpMin: settings.voiceXpMin,
        voiceXpMax: settings.voiceXpMax,
        voiceCooldownSeconds: settings.voiceCooldownSeconds,
        voiceMaxPerCooldown: settings.voiceMaxPerCooldown,
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: XpSettingsFormValues) => {
    try {
      await updateSettings.mutateAsync(data);
      toast({
        title: "설정 저장 완료",
        description: "XP 설정이 저장되었습니다.",
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
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse border-slate-700 bg-slate-800/50">
              <CardHeader>
                <div className="h-6 w-32 rounded bg-slate-700" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="h-10 rounded bg-slate-700" />
                  ))}
                </div>
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
        <h1 className="text-2xl font-bold text-white">XP 설정</h1>
        <p className="text-slate-400">텍스트 및 음성 채널에서 XP를 얻는 방식을 설정합니다.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 텍스트 XP 설정 */}
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  텍스트 XP
                </CardTitle>
                <CardDescription>채팅 메시지 기반 경험치 부여</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="textXpEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-slate-700 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white">활성화</FormLabel>
                        <FormDescription className="text-xs">
                          채팅으로 XP 획득
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="textMaxPerCooldown"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">쿨다운당 횟수</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="border-slate-700 bg-slate-900"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 음성 XP 설정 */}
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Mic2 className="h-5 w-5 text-green-500" />
                  음성 XP
                </CardTitle>
                <CardDescription>음성 채널 활동 기반 경험치 부여</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="voiceXpEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-slate-700 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white">활성화</FormLabel>
                        <FormDescription className="text-xs">
                          음성 참여로 XP 획득
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="voiceXpMin"
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voiceXpMax"
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="voiceCooldownSeconds"
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voiceMaxPerCooldown"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">쿨다운당 횟수</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="border-slate-700 bg-slate-900"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

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
