import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  RoleTicket,
  CreateRoleTicket,
  UpdateRoleTicket,
  TicketRoleOption,
  CreateTicketRoleOption,
  UpdateTicketRoleOption,
} from "@/types/shop-v2";

// ========== Role Tickets ==========

// Fetch role tickets
export function useRoleTickets(guildId: string) {
  return useQuery<RoleTicket[]>({
    queryKey: ["role-tickets", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/tickets`);
      if (!res.ok) throw new Error("Failed to fetch role tickets");
      return res.json();
    },
  });
}

// Fetch single role ticket with options
export function useRoleTicket(guildId: string, ticketId: number | null) {
  return useQuery<RoleTicket>({
    queryKey: ["role-tickets", guildId, ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to fetch role ticket");
      return res.json();
    },
    enabled: !!ticketId,
  });
}

// Create role ticket
export function useCreateRoleTicket(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<RoleTicket, Error, CreateRoleTicket>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/guilds/${guildId}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create role ticket");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-tickets", guildId] });
    },
  });
}

// Update role ticket
export function useUpdateRoleTicket(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<RoleTicket, Error, { id: number; data: UpdateRoleTicket }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update role ticket");
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["role-tickets", guildId] });
      queryClient.invalidateQueries({ queryKey: ["role-tickets", guildId, id] });
    },
  });
}

// Delete role ticket
export function useDeleteRoleTicket(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete role ticket");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-tickets", guildId] });
    },
  });
}

// ========== Ticket Role Options ==========

// Fetch role options for a ticket
export function useTicketRoleOptions(guildId: string, ticketId: number | null) {
  return useQuery<TicketRoleOption[]>({
    queryKey: ["ticket-role-options", guildId, ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/${ticketId}/roles`);
      if (!res.ok) throw new Error("Failed to fetch role options");
      return res.json();
    },
    enabled: !!ticketId,
  });
}

// Create role option
export function useCreateTicketRoleOption(guildId: string, ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation<TicketRoleOption, Error, CreateTicketRoleOption>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/guilds/${guildId}/tickets/${ticketId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create role option");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ticket-role-options", guildId, ticketId],
      });
      queryClient.invalidateQueries({
        queryKey: ["role-tickets", guildId, ticketId],
      });
    },
  });
}

// Update role option
export function useUpdateTicketRoleOption(guildId: string, ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    TicketRoleOption,
    Error,
    { optionId: number; data: UpdateTicketRoleOption }
  >({
    mutationFn: async ({ optionId, data }) => {
      const res = await fetch(
        `/api/guilds/${guildId}/tickets/${ticketId}/roles/${optionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update role option");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ticket-role-options", guildId, ticketId],
      });
      queryClient.invalidateQueries({
        queryKey: ["role-tickets", guildId, ticketId],
      });
    },
  });
}

// Delete role option
export function useDeleteTicketRoleOption(guildId: string, ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (optionId) => {
      const res = await fetch(
        `/api/guilds/${guildId}/tickets/${ticketId}/roles/${optionId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete role option");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ticket-role-options", guildId, ticketId],
      });
      queryClient.invalidateQueries({
        queryKey: ["role-tickets", guildId, ticketId],
      });
    },
  });
}
