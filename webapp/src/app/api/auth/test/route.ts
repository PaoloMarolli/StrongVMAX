import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({
        authenticated: false,
        message: "Nessuna sessione attiva sul server. Effettua l'accesso."
      });
    }

    const typedSession = session as { accessToken?: string; user?: { name?: string; email?: string } };
    const accessToken = typedSession.accessToken;

    if (!accessToken) {
      return NextResponse.json({
        authenticated: true,
        user: {
          name: typedSession.user?.name || null,
          email: typedSession.user?.email || null
        },
        hasAccessToken: false,
        message: "L'utente è loggato ma la sessione non contiene un Token di Accesso Google valido."
      });
    }

    // Call Google OAuth Tokeninfo API to get granted scopes
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
    if (!tokenInfoRes.ok) {
      const errText = await tokenInfoRes.text();
      return NextResponse.json({
        authenticated: true,
        hasAccessToken: true,
        googleTokenValid: false,
        googleError: errText,
        message: "Il token di accesso Google è presente ma non è considerato valido da Google."
      });
    }

    const tokenInfo = await tokenInfoRes.json() as { scope?: string; expires_in?: string };

    return NextResponse.json({
      authenticated: true,
      user: {
        name: typedSession.user?.name || null,
        email: typedSession.user?.email || null
      },
      hasAccessToken: true,
      googleTokenValid: true,
      expiresInSeconds: tokenInfo.expires_in,
      grantedScopes: tokenInfo.scope ? tokenInfo.scope.split(" ") : []
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Errore sconosciuto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
