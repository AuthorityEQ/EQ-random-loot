"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";

type DiscordSessionUser = {
  discordUsername?: string | null;
  name?: string | null;
};

function discordDisplayName(user: DiscordSessionUser) {
  return user.discordUsername ?? user.name ?? "Discord";
}

export function DiscordAuthControl() {
  const { status, data: session } = useSession();
  const user = session?.user;
  const signedIn = status === "authenticated" && Boolean(user?.discordUserId);

  if (status === "loading") {
    return (
      <div className="discord-auth-control" aria-label="Discord login">
        <span>Discord</span>
      </div>
    );
  }

  if (!signedIn || !user) {
    return (
      <div className="discord-auth-control" aria-label="Discord login">
        <button className="discord-auth-button" onClick={() => signIn("discord")} type="button">
          Login with Discord
        </button>
      </div>
    );
  }

  return (
    <div className="discord-auth-control is-signed-in" aria-label="Discord account">
      {user.image ? (
        <Image
          alt=""
          className="discord-auth-avatar"
          height={24}
          src={user.image}
          width={24}
        />
      ) : null}
      <span className="discord-auth-name">{discordDisplayName(user)}</span>
      <button className="discord-auth-button" onClick={() => signOut()} type="button">
        Logout
      </button>
    </div>
  );
}
