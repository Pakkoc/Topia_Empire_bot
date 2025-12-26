"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useRoleTickets,
  useCreateRoleTicket,
  useUpdateRoleTicket,
  useDeleteRoleTicket,
  useShopItemsV2,
  useRoles,
  useTicketRoleOptions,
  useCreateTicketRoleOption,
  useDeleteTicketRoleOption,
  useCurrencySettings,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@iconify/react";
import type { RoleTicket } from "@/types/shop-v2";

const ticketFormSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요").max(100),
  description: z.string().max(500).optional(),
  shopItemId: z.coerce.number().min(1, "상점 아이템을 선택하세요"),
  consumeQuantity: z.coerce.number().min(0).optional(),
  removePreviousRole: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

const roleOptionSchema = z.object({
  roleId: z.string().min(1, "역할을 선택하세요"),
  name: z.string().min(1, "이름을 입력하세요").max(100),
  description: z.string().max(500).optional(),
});

type RoleOptionValues = z.infer<typeof roleOptionSchema>;

export default function TicketsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<RoleTicket | null>(null);
  const [manageRolesTicket, setManageRolesTicket] = useState<RoleTicket | null>(null);

  const { data: settings } = useCurrencySettings(guildId);
  const { data: tickets, isLoading } = useRoleTickets(guildId);
  const { data: shopItems } = useShopItemsV2(guildId);
  const { data: roles } = useRoles(guildId);
  const { data: roleOptions } = useTicketRoleOptions(guildId, manageRolesTicket?.id ?? null);

  const createTicket = useCreateRoleTicket(guildId);
  const updateTicket = useUpdateRoleTicket(guildId);
  const deleteTicket = useDeleteRoleTicket(guildId);
  const createRoleOption = useCreateTicketRoleOption(
    guildId,
    manageRolesTicket?.id ?? 0
  );
  const deleteRoleOption = useDeleteTicketRoleOption(
    guildId,
    manageRolesTicket?.id ?? 0
  );

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      name: "",
      description: "",
      shopItemId: 0,
      consumeQuantity: 1,
      removePreviousRole: true,
      enabled: true,
    },
  });

  const roleOptionForm = useForm<RoleOptionValues>({
    resolver: zodResolver(roleOptionSchema),
    defaultValues: {
      roleId: "",
      name: "",
      description: "",
    },
  });

  // 이미 선택권으로 연결된 상점 아이템 필터링
  const availableShopItems = shopItems?.filter(
    (item) =>
      !tickets?.some((t) => t.shopItemId === item.id) ||
      editingTicket?.shopItemId === item.id
  );

  const onSubmit = async (data: TicketFormValues) => {
    try {
      if (editingTicket) {
        await updateTicket.mutateAsync({
          id: editingTicket.id,
          data: {
            name: data.name,
            description: data.description || null,
            consumeQuantity: data.consumeQuantity ?? 1,
            removePreviousRole: data.removePreviousRole ?? true,
            enabled: data.enabled ?? true,
          },
        });
        toast({ title: "선택권 수정 완료", description: "역할선택권이 수정되었습니다." });
        setEditingTicket(null);
      } else {
        await createTicket.mutateAsync(data);
        toast({ title: "선택권 생성 완료", description: "새 역할선택권이 추가되었습니다." });
        setIsCreateOpen(false);
      }
      form.reset();
    } catch (error) {
      toast({
        title: "오류 발생",
        description: error instanceof Error ? error.message : "작업 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (ticket: RoleTicket) => {
    setEditingTicket(ticket);
    form.reset({
      name: ticket.name,
      description: ticket.description || "",
      shopItemId: ticket.shopItemId,
      consumeQuantity: ticket.consumeQuantity,
      removePreviousRole: ticket.removePreviousRole,
      enabled: ticket.enabled,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말로 이 선택권을 삭제하시겠습니까? 연결된 역할 옵션도 함께 삭제됩니다.")) return;
    try {
      await deleteTicket.mutateAsync(id);
      toast({ title: "삭제 완료", description: "선택권이 삭제되었습니다." });
    } catch {
      toast({
        title: "삭제 실패",
        description: "선택권 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggleEnabled = async (ticket: RoleTicket) => {
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        data: { enabled: !ticket.enabled },
      });
    } catch {
      toast({
        title: "오류 발생",
        description: "상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const onAddRoleOption = async (data: RoleOptionValues) => {
    try {
      await createRoleOption.mutateAsync(data);
      toast({ title: "역할 추가 완료" });
      roleOptionForm.reset();
    } catch (error) {
      toast({
        title: "오류 발생",
        description: error instanceof Error ? error.message : "역할 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoleOption = async (optionId: number) => {
    try {
      await deleteRoleOption.mutateAsync(optionId);
      toast({ title: "역할 삭제 완료" });
    } catch {
      toast({
        title: "오류 발생",
        description: "역할 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">선택권 이름</FormLabel>
              <FormControl>
                <Input
                  placeholder="색상선택권"
                  {...field}
                  className="bg-white/5 border-white/10 text-white"
                />
              </FormControl>
              <FormDescription className="text-xs text-white/40">
                인벤토리에서 표시될 이름
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">설명 (선택)</FormLabel>
              <FormControl>
                <Input
                  placeholder="닉네임 색상을 변경할 수 있습니다"
                  {...field}
                  className="bg-white/5 border-white/10 text-white"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shopItemId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">연결할 상점 아이템</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value?.toString() || ""}
                disabled={!!editingTicket}
              >
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="상점 아이템을 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableShopItems?.map((item) => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{item.name}</span>
                        <span className="text-white/40">
                          ({item.price.toLocaleString()}{" "}
                          {item.currencyType === "topy" ? topyName : rubyName})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingTicket && (
                <FormDescription className="text-xs text-amber-400/70">
                  연결된 상점 아이템은 변경할 수 없습니다
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="consumeQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70">소모 개수</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </FormControl>
                <FormDescription className="text-xs text-white/40">
                  0 = 기간제 (소모 없음)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="removePreviousRole"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="text-white/70">이전 역할 제거</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <span className="text-sm text-white/50">
                      {field.value ? "ON" : "OFF"}
                    </span>
                  </div>
                </FormControl>
                <FormDescription className="text-xs text-white/40">
                  역할 변경 시 이전 역할 제거
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl bg-white/5 p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-white">활성화</FormLabel>
                <FormDescription className="text-xs text-white/40">
                  비활성화하면 인벤토리에서 사용할 수 없습니다
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

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingTicket(null);
              form.reset();
            }}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={createTicket.isPending || updateTicket.isPending}
            className="bg-gradient-to-r from-amber-600 to-orange-600"
          >
            {editingTicket ? "수정" : "추가"}
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-bold text-white">역할선택권 관리</h1>
          <p className="text-white/50 mt-1">
            상점 아이템을 역할 교환권으로 설정합니다
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-amber-600 to-orange-600">
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              선택권 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">새 역할선택권 추가</DialogTitle>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTicket}
        onOpenChange={(open: boolean) => !open && setEditingTicket(null)}
      >
        <DialogContent className="bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">선택권 수정</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      {/* Role Options Dialog */}
      <Dialog
        open={!!manageRolesTicket}
        onOpenChange={(open: boolean) => !open && setManageRolesTicket(null)}
      >
        <DialogContent className="bg-zinc-900 border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              역할 관리 - {manageRolesTicket?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Add Role Form */}
            <Form {...roleOptionForm}>
              <form
                onSubmit={roleOptionForm.handleSubmit(onAddRoleOption)}
                className="space-y-4 p-4 bg-white/5 rounded-xl"
              >
                <h4 className="text-sm font-medium text-white/70">새 역할 추가</h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={roleOptionForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-white/50">표시 이름</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="빨강"
                            {...field}
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={roleOptionForm.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-white/50">역할</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                              <SelectValue placeholder="역할 선택" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles?.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor: `#${role.color.toString(16).padStart(6, "0")}`,
                                    }}
                                  />
                                  {role.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={roleOptionForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-white/50">설명 (선택)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="역할 설명"
                          {...field}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={createRoleOption.isPending}
                  className="bg-gradient-to-r from-amber-600 to-orange-600"
                >
                  <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                  역할 추가
                </Button>
              </form>
            </Form>

            {/* Role Options List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-white/70">
                등록된 역할 ({roleOptions?.length || 0}개)
              </h4>
              {roleOptions && roleOptions.length > 0 ? (
                <div className="space-y-2">
                  {roleOptions.map((option) => {
                    const role = roles?.find((r) => r.id === option.roleId);
                    return (
                      <div
                        key={option.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {role && (
                            <div
                              className="w-8 h-8 rounded-lg border border-white/10"
                              style={{
                                backgroundColor: `#${role.color.toString(16).padStart(6, "0")}`,
                              }}
                            />
                          )}
                          <div>
                            <span className="text-white font-medium">{option.name}</span>
                            {option.description && (
                              <span className="text-white/40 ml-2 text-sm">
                                - {option.description}
                              </span>
                            )}
                          </div>
                          <Icon icon="solar:arrow-right-linear" className="h-4 w-4 text-white/30" />
                          <div className="flex items-center gap-2">
                            {role && (
                              <>
                                <span className="text-white/70">@{role.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRoleOption(option.id)}
                          disabled={deleteRoleOption.isPending}
                        >
                          <Icon icon="solar:trash-bin-2-linear" className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-white/40">
                  등록된 역할이 없습니다
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:info-circle-linear" className="h-5 w-5 text-blue-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-white">역할선택권 사용 방법</h3>
            <ul className="text-sm text-white/60 space-y-1">
              <li>1. 먼저 <strong className="text-white/80">상점</strong>에서 티켓 아이템을 생성하세요 (가격, 화폐, 유효기간 설정)</li>
              <li>2. 이 페이지에서 역할선택권을 생성하고 상점 아이템을 연결하세요</li>
              <li>3. 역할 관리에서 교환 가능한 역할들을 추가하세요</li>
              <li>4. 유저가 상점에서 티켓을 구매하면 인벤토리에서 역할로 교환할 수 있습니다</li>
            </ul>
            <div className="flex gap-4 text-xs text-white/40 pt-2">
              <span>소모 개수 = 0: 기간제 (소모 없이 무제한 변경)</span>
              <span>소모 개수 &gt; 0: 일반 (사용 시 차감)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon icon="solar:ticket-linear" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">역할선택권 목록</h3>
              <p className="text-white/50 text-sm">{tickets?.length || 0}개의 선택권</p>
            </div>
          </div>
        </div>

        {tickets && tickets.length > 0 ? (
          <div className="divide-y divide-white/10">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Icon icon="solar:ticket-linear" className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{ticket.name}</span>
                      <Badge
                        variant={ticket.enabled ? "default" : "secondary"}
                        className={
                          ticket.enabled
                            ? "bg-green-500/20 text-green-400 border-0"
                            : "bg-red-500/20 text-red-400 border-0"
                        }
                      >
                        {ticket.enabled ? "활성" : "비활성"}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-white/10 text-white/70 border-0"
                      >
                        {ticket.consumeQuantity === 0 ? "기간제" : `${ticket.consumeQuantity}개 소모`}
                      </Badge>
                      {ticket.removePreviousRole && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-500/20 text-purple-400 border-0"
                        >
                          이전 역할 제거
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/50 mt-1">
                      {ticket.shopItem && (
                        <>
                          <span>
                            {ticket.shopItem.name} ({ticket.shopItem.price.toLocaleString()}{" "}
                            {ticket.shopItem.currencyType === "topy" ? topyName : rubyName})
                          </span>
                          {ticket.shopItem.durationDays > 0 && (
                            <>
                              <span>•</span>
                              <span>{ticket.shopItem.durationDays}일</span>
                            </>
                          )}
                        </>
                      )}
                      {ticket.roleOptions && ticket.roleOptions.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{ticket.roleOptions.length}개 역할</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setManageRolesTicket(ticket)}
                    className="text-white/50 hover:text-white"
                  >
                    <Icon icon="solar:users-group-rounded-linear" className="h-4 w-4 mr-1" />
                    역할 관리
                  </Button>
                  <Switch
                    checked={ticket.enabled}
                    onCheckedChange={() => handleToggleEnabled(ticket)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(ticket)}>
                    <Icon icon="solar:pen-linear" className="h-4 w-4 text-white/50" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(ticket.id)}>
                    <Icon icon="solar:trash-bin-2-linear" className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Icon icon="solar:ticket-linear" className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">등록된 역할선택권이 없습니다</p>
            <p className="text-white/30 text-sm mt-1">
              위의 &quot;선택권 추가&quot; 버튼을 눌러 새 역할선택권을 추가하세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
