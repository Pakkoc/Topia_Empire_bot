"use client";

import { useParams, usePathname } from "next/navigation";
import { useGuilds } from "@/hooks/queries/use-guilds";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { ForgeSidebar } from "@/components/layout/forge-sidebar";
import { UnsavedChangesProvider } from "@/contexts/unsaved-changes-context";

export default function GuildDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const guildId = params['guildId'] as string;
  const { data: guilds } = useGuilds();

  const guild = guilds?.find((g) => g.id === guildId);
  const guildName = guild?.name ?? "Loading...";
  const guildIcon = guild?.icon;

  // forge 경로인지 확인
  const isForge = pathname.includes(`/dashboard/${guildId}/forge`);

  return (
    <UnsavedChangesProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Aurora Background Effect */}
        <div className="fixed inset-0 pointer-events-none">
          <div
            className="absolute left-1/2 top-1/3 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2 opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute right-0 bottom-0 h-[600px] w-[600px] opacity-15"
            style={{
              background:
                "radial-gradient(ellipse at bottom right, rgba(59, 130, 246, 0.3) 0%, transparent 60%)",
            }}
          />
        </div>

        <DashboardHeader />
        <div className="relative flex flex-1 overflow-hidden">
          {isForge ? (
            <ForgeSidebar guildId={guildId} />
          ) : (
            <DashboardSidebar guildId={guildId} guildName={guildName} guildIcon={guildIcon} />
          )}
          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </UnsavedChangesProvider>
  );
}