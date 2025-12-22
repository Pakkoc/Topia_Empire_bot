import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        url: "https://discord.com/api/oauth2/authorize",
        params: {
          scope: "identify email guilds",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.id = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  events: {
    // 로그아웃 시 Discord 토큰 revoke
    async signOut({ token }) {
      console.log("[Auth] signOut event triggered, token:", token?.accessToken ? "exists" : "none");
      if (token?.accessToken) {
        try {
          const response = await fetch("https://discord.com/api/oauth2/token/revoke", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              token: token.accessToken as string,
              client_id: process.env.DISCORD_CLIENT_ID!,
              client_secret: process.env.DISCORD_CLIENT_SECRET!,
            }),
          });
          console.log("[Auth] Discord token revoke response:", response.status);
        } catch (error) {
          console.error("[Auth] Failed to revoke Discord token:", error);
        }
      }
    },
  },
  pages: {
    signIn: "/login",
  },
};
