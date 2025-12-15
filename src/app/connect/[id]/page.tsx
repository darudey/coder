
'use client';

import SessionPage from "@/app/session/page";
import { useParams } from 'next/navigation';

interface ConnectPageProps {
    params: {
        id: string;
    }
}

// This page now simply acts as a wrapper, passing the connectId to the SessionPage.
// The SessionPage itself will handle fetching the code.
export default function ConnectPage({ params }: ConnectPageProps) {
    const { id } = useParams() as { id: string };
    
    return <SessionPage connectId={id} />;
}
