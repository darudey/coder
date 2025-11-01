
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function getOauth2Client() {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
        // This will be caught by the outer try-catch and return a non-authed response.
        throw new Error("Google OAuth credentials are not set in the environment variables.");
    }
    
    return new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
}

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('google_access_token')?.value;
    const refreshToken = cookieStore.get('google_refresh_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ isAuthenticated: false });
    }

    try {
        const oauth2Client = await getOauth2Client();
        oauth2Client.setCredentials({ 
            access_token: accessToken,
            refresh_token: refreshToken
        });

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: profile } = await oauth2.userinfo.get();
        
        return NextResponse.json({ isAuthenticated: true, profile });

    } catch (error) {
        console.error("Auth status check error:", error);
        return NextResponse.json({ isAuthenticated: false });
    }
}
