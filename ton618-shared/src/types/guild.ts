export interface GuildConfig {
  generalSettings: Record<string, unknown>;
  dashboardPreferences: Record<string, unknown>;
  serverRolesChannelsSettings: Record<string, unknown>;
  ticketsSettings: Record<string, unknown>;
}

export interface TicketSummary {
  openCount: number;
  closedToday: number;
  avgResponseMinutes: number;
}

export interface GuildDashboardSnapshot {
  guildId: string;
  guildName: string;
  iconUrl?: string;
  config: GuildConfig;
  tickets: TicketSummary;
}

export interface DiscordGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}
