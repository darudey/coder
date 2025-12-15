
import Home from "@/app/page";

interface ConnectPageProps {
    params: {
        id: string;
    }
}

export default function ConnectPage({ params }: ConnectPageProps) {
    // This page reuses the main Home component but passes the connectId
    // which will activate the real-time presence features.
    return <Home connectId={params.id} />;
}
