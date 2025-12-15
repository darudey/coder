'use client';

import { useEffect, useState } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import { notFound, useParams } from 'next/navigation';
import Home from '@/app/page';
import { LoadingPage } from '@/components/loading-page';

export default function SharePage() {
    const params = useParams();
    const id = params.id as string;
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
    
    return <Home initialCode={initialCode} connectId={id} />;
}
