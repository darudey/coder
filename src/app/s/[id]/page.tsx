import { getSharedCode } from "@/app/actions";
import { Compiler } from "@/components/codeweave/compiler";
import { notFound } from "next/navigation";

interface SharePageProps {
    params: {
        id: string;
    }
}

export default async function SharePage({ params }: SharePageProps) {
    // The params object is a Promise, so we need to await it.
    const awaitedParams = params;
    const initialCode = await getSharedCode(awaitedParams.id);

    if (initialCode === null) {
        notFound();
    }
    
    // The Compiler component is a Client Component, but we can pass server-fetched
    // data to it as props. We use a `key` to ensure it re-mounts with the new code.
    return (
        <main className="bg-background min-h-screen">
            <Compiler key={awaitedParams.id} initialCode={initialCode} />
        </main>
    );
}
