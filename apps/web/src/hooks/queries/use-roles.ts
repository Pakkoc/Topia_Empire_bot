import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  mentionable: boolean;
  hoist: boolean;
}

export interface UseRolesParams {
  excludeManaged?: boolean;
  excludeEveryone?: boolean;
}

export function useRoles(guildId: string, params: UseRolesParams = {}) {
  const { excludeManaged = true, excludeEveryone = true } = params;

  return useQuery({
    queryKey: ["roles", guildId, { excludeManaged, excludeEveryone }],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (excludeManaged) searchParams.set("excludeManaged", "true");
      if (excludeEveryone) searchParams.set("excludeEveryone", "true");

      const { data } = await axios.get<Role[]>(
        `/api/guilds/${guildId}/roles?${searchParams.toString()}`
      );
      return data;
    },
    enabled: !!guildId,
  });
}
