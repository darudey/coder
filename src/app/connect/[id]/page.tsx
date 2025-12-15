'use client';

import SessionPage from "@/app/session/page";

interface ConnectPageProps {
    params: {
        id: string;
    }
}

export default function ConnectPage({ params: { id } }: ConnectPageProps) {
    // This page reuses the SessionPage component but passes the connectId
    // which will activate the real-time presence features.
    return <SessionPage connectId={id} />;
}
