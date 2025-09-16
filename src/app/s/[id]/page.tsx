import { getSharedCode } from "@/app/actions";
import { Compiler } from "@/components/codeweave/compiler";
import { notFound } from "next/navigation";

interface SharePageProps {
    params: {
        id: string;
    }
}

// This is now a Server Component that fetches data and passes it to a Client Component.
export default async function SharePage({ params }: SharePageProps) {
    const initialCode = await getSharedCode(params.id);

    if (initialCode === null) {
        notFound();
    }
    
    // The Compiler component is a Client Component, but we can pass server-fetched
    // data to it as props. We use a `key` to ensure it re-mounts with the new code.
    return (
        <main className="bg-background min-h-screen">
            <Compiler key={params.id} initialCode={initialCode} />
        </main>
    );
}
