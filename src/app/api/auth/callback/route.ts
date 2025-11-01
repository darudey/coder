
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
        console.error("Google OAuth credentials are not set in the environment variables.");
        return NextResponse.json({ error: "Configuration error, please contact the administrator." }, { status: 500 });
    }

    const code = req.nextUrl.searchParams.get('code');

    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    if (typeof code !== 'string') {
        return NextResponse.redirect(new URL('/?error=invalid_code', req.url));
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        const cookieStore = cookies();
        if (tokens.access_token) {
             cookieStore.set('google_access_token', tokens.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                sameSite: 'lax',
                path: '/',
                maxAge: tokens.expiry_date ? (tokens.expiry_date - Date.now()) / 1000 : 3600,
            });
        }
       if (tokens.refresh_token) {
            cookieStore.set('google_refresh_token', tokens.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                sameSite: 'lax',
                path: '/',
            });
        }

        return NextResponse.redirect(new URL('/', req.nextUrl.origin));

    } catch (error) {
        console.error("Error exchanging code for tokens:", error);
        return NextResponse.redirect(new URL('/?error=token_exchange_failed', req.url));
    }
}
