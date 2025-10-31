
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Google OAuth credentials are not set in the environment variables.");
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('google_access_token')?.value;
    const refreshToken = cookieStore.get('google_refresh_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ isAuthenticated: false });
    }

    try {
        oauth2Client.setCredentials({ 
            access_token: accessToken,
            refresh_token: refreshToken
        });

        // Use the token to get user info, which also validates the token
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: profile } = await oauth2.userinfo.get();
        
        return NextResponse.json({ isAuthenticated: true, profile });

    } catch (error) {
        // If the token is invalid or expired, the user is not authenticated
        return NextResponse.json({ isAuthenticated: false });
    }
}
