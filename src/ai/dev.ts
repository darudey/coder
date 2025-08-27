
import { config } from 'dotenv';
config(); // Load from .env
config({ path: '.env.local', override: true }); // Load and override from .env.local

import '@/ai/flows/error-checking.ts';
import '@/ai/flows/syntax-highlighting.ts';
