
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    
    // Clear the tokens by setting them to empty and expiring them
    cookieStore.set('google_access_token', '', { expires: new Date(0), path: '/' });
    cookieStore.set('google_refresh_token', '', { expires: new Date(0), path: '/' });

    return NextResponse.json({ message: 'Signed out successfully' }, { status: 200 });
}
