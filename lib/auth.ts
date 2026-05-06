import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const missingAuthEnvVars = [
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
].filter((name) => !process.env[name]);

if (missingAuthEnvVars.length > 0) {
  console.warn(
    `[auth] Missing Discord/NextAuth env vars: ${missingAuthEnvVars.join(", ")}. ` +
      "Discord sign-in will not work until these are set.",
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "discord") {
        token.discordUserId = account.providerAccountId;
      }
      if (profile && "username" in profile && typeof profile.username === "string") {
        token.discordUsername = profile.username;
      }
      if (profile && "avatar" in profile && typeof profile.avatar === "string") {
        token.discordAvatar = profile.avatar;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.discordUserId === "string" ? token.discordUserId : undefined;
        session.user.discordUserId = typeof token.discordUserId === "string" ? token.discordUserId : undefined;
        session.user.discordUsername = typeof token.discordUsername === "string" ? token.discordUsername : undefined;
        session.user.discordAvatar = typeof token.discordAvatar === "string" ? token.discordAvatar : undefined;
      }
      return session;
    },
  },
};
