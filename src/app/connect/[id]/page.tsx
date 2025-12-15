
'use client';

import { useEffect, useState } from 'react';
import SessionPage from "@/app/session/page";
import { getDoc, doc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import { notFound, useParams } from 'next/navigation';
import { LoadingPage } from '@/components/loading-page';

interface ConnectPageProps {
    params: {
        id: string;
    }
}

export default function ConnectPage({ params }: ConnectPageProps) {
    const { id } = params;
    const [initialCode, setInitialCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            setError(true);
            return;
        }

        const fetchCode = async () => {
            const db = await getClientDb();
            if (!db) {
                setError(true);
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, "shares", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setInitialCode(docSnap.data()?.code);
                } else {
                    setError(true);
                }
            } catch (e) {
                console.error(e);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchCode();
    }, [id]);

    if (loading) {
        return <LoadingPage />;
    }

    if (error) {
        notFound();
    }

    return <SessionPage connectId={id} initialCode={initialCode} />;
}

    