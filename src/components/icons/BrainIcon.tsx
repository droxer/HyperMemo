import { memo } from 'react';

interface BrainIconProps {
    className?: string;
    size?: number;
}

/**
 * Custom HyperMemo AI icon - a stylized brain with constellation nodes
 * Represents the "second brain" concept with connected memory points
 */
export const BrainIcon = memo(function BrainIcon({ className = '', size = 24 }: BrainIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            role="img"
            aria-label="HyperMemo AI"
        >
            {/* Brain outline */}
            <path
                d="M12 4C8.5 4 6 6.5 6 9.5C6 11 6.5 12.3 7.3 13.3C6.5 14.2 6 15.5 6 17C6 19.5 8 21.5 10.5 21.5C11.5 21.5 12.5 21.2 13.3 20.6C14 21.2 15 21.5 16 21.5C18.2 21.5 20 19.7 20 17.5C20 16 19.3 14.7 18.2 13.8C18.7 12.9 19 11.8 19 10.5C19 7.5 16.5 5 13.5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Brain curve */}
            <path
                d="M12 4C12 4 14 5 14 8C14 11 12 13 12 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Memory nodes - constellation points */}
            <circle cx="9" cy="9" r="1.5" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0ms' }} />
            <circle cx="15" cy="8" r="1.5" fill="currentColor" className="animate-pulse" style={{ animationDelay: '200ms' }} />
            <circle cx="11" cy="15" r="1.5" fill="currentColor" className="animate-pulse" style={{ animationDelay: '400ms' }} />
            <circle cx="16" cy="14" r="1.5" fill="currentColor" className="animate-pulse" style={{ animationDelay: '600ms' }} />
            {/* Connection lines between nodes */}
            <path
                d="M9 9L11 15M15 8L16 14M9 9L15 8M11 15L16 14"
                stroke="currentColor"
                strokeWidth="0.75"
                strokeLinecap="round"
                strokeDasharray="2 2"
                opacity="0.5"
            />
        </svg>
    );
});

/**
 * Simpler version for smaller contexts like avatars
 */
export const BrainIconSimple = memo(function BrainIconSimple({ className = '', size = 20 }: BrainIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            role="img"
            aria-label="HyperMemo AI"
        >
            {/* Simplified brain shape */}
            <path
                d="M12 3C7.5 3 5 6 5 9.5C5 12 6 14 7.5 15.5C6.5 16.5 6 18 6 19.5C6 21 7.5 22 9.5 22C11 22 12 21.5 12.5 21C13 21.5 14 22 15.5 22C17.5 22 19 21 19 19.5C19 18 18.5 16.5 17.5 15.5C19 14 20 12 20 9.5C20 6 17.5 3 13 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Center node - represents active thought */}
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            {/* Radiating dots */}
            <circle cx="9" cy="9" r="1" fill="currentColor" opacity="0.6" />
            <circle cx="15" cy="9" r="1" fill="currentColor" opacity="0.6" />
            <circle cx="10" cy="16" r="1" fill="currentColor" opacity="0.6" />
            <circle cx="14" cy="16" r="1" fill="currentColor" opacity="0.6" />
        </svg>
    );
});
