
'use client';

import { useParams } from 'next/navigation';
import Home from '@/app/page';

// This page now simply acts as a wrapper, passing the connectId to the Home page.
// The Home page itself will handle fetching the code.
export default function SharePage() {
    const params = useParams();
    const id = params.id as string;
    
    return <Home connectId={id} />;
}

    