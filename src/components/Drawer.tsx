import { memo, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
}

export const Drawer = memo(function Drawer({ isOpen, onClose, children, title }: DrawerProps) {
    if (!isOpen) return null;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={onClose}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
                aria-label="Close drawer"
            />
            <div className="fixed inset-x-0 bottom-0 md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:max-w-[90vw] max-h-[90vh] md:max-h-none bg-bg-main shadow-lg z-50 flex flex-col animate-slide-in-bottom md:animate-slide-in-right rounded-t-2xl md:rounded-none">
                <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border">
                    {title && <h2 className="text-lg md:text-xl font-semibold text-text-primary">{title}</h2>}
                    <button
                        type="button"
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors -mr-1"
                        onClick={onClose}
                        aria-label="Close drawer"
                    >
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {children}
                </div>
            </div>
        </>
    );
});
