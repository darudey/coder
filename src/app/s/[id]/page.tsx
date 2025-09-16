'use client';

import { getSharedCode } from "@/app/actions";
import { Compiler } from "@/components/codeweave/compiler";
import { DotLoader } from "@/components/codeweave/dot-loader";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

interface SharePageProps {
    params: {
        id: string;
    }
}

// This is now a client component to allow for full interactivity.
export default function SharePage({ params }: SharePageProps) {
    const [initialCode, setInitialCode] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        const fetchCode = async () => {
            const code = await getSharedCode(params.id);
            if (code === null) {
                notFound();
            } else {
                setInitialCode(code);
            }
        };

        fetchCode();
    }, [params.id]);

    if (initialCode === undefined) {
        return (
            <main className="bg-background min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <DotLoader className="w-12 text-primary" />
                    <p className="text-muted-foreground">Loading shared code...</p>
                </div>
            </main>
        );
    }
    
    // We use a key to force the Compiler to re-mount when the initialCode is loaded.
    // We also pass the initialCode to a new prop on the Compiler.
    return (
        <main className="bg-background min-h-screen">
            <Compiler key={params.id} initialCode={initialCode} />
        </main>
    );
}
