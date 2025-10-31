
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;


if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Google OAuth credentials are not set in the environment variables.");
}


export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('google_access_token')?.value;
    const refreshToken = cookieStore.get('google_refresh_token')?.value;

    const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
    );

    if (!accessToken) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        oauth2Client.setCredentials({ 
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const response = await drive.files.list({
            pageSize: 10,
            fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink)',
        });
        
        return NextResponse.json(response.data.files || []);
    } catch (error: any) {
        // If the access token is expired, try to refresh it.
        if (error.response?.status === 401 && refreshToken) {
            try {
                const { tokens } = await oauth2Client.refreshAccessToken();
                oauth2Client.setCredentials(tokens);

                 if (tokens.access_token) {
                    cookieStore.set('google_access_token', tokens.access_token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV !== 'development',
                        sameSite: 'lax',
                        path: '/',
                        maxAge: tokens.expiry_date ? (tokens.expiry_date - Date.now()) / 1000 : 3600,
                    });
                }
                
                const drive = google.drive({ version: 'v3', auth: oauth2Client });
                const response = await drive.files.list({
                    pageSize: 10,
                    fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink)',
                });

                return NextResponse.json(response.data.files || []);

            } catch (refreshError) {
                console.error('Error refreshing access token:', refreshError);
                // Clear the potentially invalid refresh token
                cookieStore.set('google_refresh_token', '', { expires: new Date(0), path: '/' });
                return NextResponse.json({ error: 'Session expired, please sign in again.' }, { status: 401 });
            }
        }
        
        console.error('Error fetching Drive files:', error);
        return NextResponse.json({ error: 'Failed to fetch files from Google Drive.' }, { status: 500 });
    }
}
