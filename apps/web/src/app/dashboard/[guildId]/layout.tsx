"use client";

import { useParams } from "next/navigation";
import { useGuilds } from "@/hooks/queries/use-guilds";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

export default function GuildDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const guildId = params['guildId'] as string;
  const { data: guilds } = useGuilds();

  const guild = guilds?.find((g) => g.id === guildId);
  const guildName = guild?.name ?? "Loading...";

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar guildId={guildId} guildName={guildName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
