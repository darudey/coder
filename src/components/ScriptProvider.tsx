
'use client';

import { useGoogleDrive } from '@/hooks/use-google-drive';
import Script from 'next/script';
import React from 'react';

export function ScriptProvider() {
    const { scriptLoadCallback } = useGoogleDrive();

    return (
        <>
            <Script src="https://apis.google.com/js/api.js" async defer onLoad={scriptLoadCallback} />
            <Script src="https://accounts.google.com/gsi/client" async defer onLoad={scriptLoadCallback} />
        </>
    )
}
