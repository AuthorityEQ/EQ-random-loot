export type ServerId = "frostreaver" | "teek" | "mischief";

export const SERVER_IDS: ServerId[] = ["frostreaver", "teek", "mischief"];

export const DEFAULT_SERVER: ServerId = "frostreaver";

export type ServerMeta = {
  id: ServerId;
  name: string;
  isRandomLoot: boolean;
};

export const SERVER_META: Record<ServerId, ServerMeta> = {
  frostreaver: { id: "frostreaver", name: "Frostreaver", isRandomLoot: true },
  teek: { id: "teek", name: "Teek", isRandomLoot: true },
  mischief: { id: "mischief", name: "Mischief", isRandomLoot: true },
};

export function isRandomLootServer(server: ServerId): boolean {
  return SERVER_META[server].isRandomLoot;
}
