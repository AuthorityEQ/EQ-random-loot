import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      discordUserId?: string;
      discordUsername?: string;
      discordAvatar?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordUserId?: string;
    discordUsername?: string;
    discordAvatar?: string;
  }
}
