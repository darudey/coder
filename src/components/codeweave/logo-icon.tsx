import { cn } from '@/lib/utils';
import type { FC } from 'react';

interface LogoIconProps {
    className?: string;
}

export const LogoIcon: FC<LogoIconProps> = ({ className }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            className={cn(className)}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#ff00a0' }} />
                <stop offset="100%" style={{ stopColor: '#00bfff' }} />
                </linearGradient>
            </defs>
            <rect width="100" height="100" rx="20" ry="20" fill="url(#g)" />
            <path
                d="M25 40 l15 10 l-15 10"
                stroke="white"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M45 60 h25"
                stroke="white"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
            />
        </svg>
    );
};
