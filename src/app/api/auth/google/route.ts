
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error("Google OAuth credentials are not set in the environment variables.");
    return NextResponse.json({ error: "Configuration error, please contact the administrator." }, { status: 500 });
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent', 
  });
  return NextResponse.redirect(url);
}
