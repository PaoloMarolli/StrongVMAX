import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly",
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
      id: "demo",
      name: "Demo Mode",
      credentials: {},
      async authorize() {
        return {
          id: "demo-user-id",
          name: "Ospite StrongVMAX",
          email: "demo@strongvmax.com",
          image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=200",
        };
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        (session.user as any).id = token.sub as string;
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        (session as any).accessToken = token.accessToken;
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        (session as any).error = token.error;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + (account.expires_at ?? 3600) * 1000,
          refreshToken: account.refresh_token,
          user,
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to update it using refresh_token
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }

      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "default_super_secret_for_development_and_testing_strongvmax",
};

async function refreshAccessToken(token: any) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to existing refresh token
    };
  } catch (error) {
    console.error("Error refreshing access token via Google OAuth:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}
