
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not set in the environment variables.");
}

function getRedirectUri(req: NextRequest) {
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    return `${protocol}://${host}/api/auth/callback`;
}

export async function GET(req: NextRequest) {
  const redirectUri = getRedirectUri(req);
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    redirectUri
  );
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
    ],
    // A refresh token is only returned on the first authorization.
    // prompt: 'consent', 
  });
  return NextResponse.redirect(url);
}
