import { getSharedCode } from "@/app/actions";
import { Compiler } from "@/components/codeweave/compiler";
import { notFound } from "next/navigation";
import Home from "@/app/page";

interface SharePageProps {
    params: {
        id: string;
    }
}

// This component now acts as a data-fetching layer.
// It fetches the code and passes it to the main Home component.
export default async function SharePage({ params }: SharePageProps) {
    const initialCode = await getSharedCode(params.id);

    if (initialCode === null) {
        notFound();
    }
    
    // The main compiler page will handle rendering the Compiler with the initialCode
    // We pass it down through props. This is a bit of a workaround for App Router limitations.
    return <Home initialCode={initialCode} />;
}
