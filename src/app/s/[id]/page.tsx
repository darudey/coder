
import { getSharedCode } from "@/app/actions";
import { CodeEditor } from "@/components/codeweave/code-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from 'next/cache';

interface SharePageProps {
    params: {
        id: string;
    }
}

// This is a server component to fetch the code
export default async function SharePage({ params }: SharePageProps) {
    noStore();
    const code = await getSharedCode(params.id);

    if (code === null) {
        notFound();
    }
    
    return (
        <main className="bg-background min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Shared Code</CardTitle>
                        <CardDescription>This is a read-only view of a shared code snippet.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="h-[70vh]">
                         <CodeEditor 
                            code={code}
                            onCodeChange={() => {}}
                            onUndo={() => {}}
                            onRedo={() => {}}
                            onDeleteFile={() => {}}
                            hasActiveFile={false}
                         />
                       </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
