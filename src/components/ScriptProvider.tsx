
'use client';

import React from 'react';

export function ScriptProvider() {
    // This component is no longer responsible for loading scripts
    // as they are handled in the server-side layout.
    // However, we keep it to avoid having to remove it from every layout.
    return null;
}
