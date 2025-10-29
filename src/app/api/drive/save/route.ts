
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin'; // Ensures admin app is initialized

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const body = await request.json();
    const { fileName, content } = body;

    if (!fileName || typeof content !== 'string') {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // We can't directly use the user's Google token on the server.
    // The user needs to grant offline access to the application via OAuth2 consent screen.
    // Since we don't have that flow implemented, we cannot proceed with the Drive API call.
    // This is a limitation of not having a full server-side OAuth2 flow.
    // For now, we will return a descriptive error message.

    console.log(`User ${uid} attempted to save ${fileName}. A server-side OAuth2 flow is required to get a Google access token.`);
    
    return NextResponse.json({ 
        error: 'This feature is not fully implemented. A server-side OAuth consent flow is required to save files to Google Drive.' 
    }, { status: 501 });

    // The code below would be used if we had an access token from a server-side OAuth flow.
    /*
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: 'USER_GOOGLE_ACCESS_TOKEN' });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const fileMetadata = {
        name: fileName,
        mimeType: 'application/javascript',
    };

    const media = {
        mimeType: 'application/javascript',
        body: content,
    };

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
    });

    return NextResponse.json({ success: true, fileId: response.data.id });
    */

  } catch (error: any) {
    console.error('API Error:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'Authentication token has expired. Please sign in again.' }, { status: 401 });
    }
    if (error.code && error.code.startsWith('auth/')) {
        return NextResponse.json({ error: `Authentication error: ${error.message}` }, { status: 401 });
    }
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
