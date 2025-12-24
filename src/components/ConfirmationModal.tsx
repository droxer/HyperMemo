import { memo, useRef, useState } from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDangerous?: boolean;
}

export const ConfirmationModal = memo(function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDangerous = false
}: ConfirmationModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
        try {
            setIsLoading(true);
            await onConfirm();
            onClose();
        } catch (error) {
            console.error('Confirmation action failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === overlayRef.current && !isLoading) {
            onClose();
        }
    };

    const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape' && !isLoading) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
            ref={overlayRef}
            onClick={handleOverlayClick}
            onKeyDown={handleOverlayKeyDown}
            role="presentation"
        >
            <dialog open className="bg-bg-main border border-border rounded-t-2xl md:rounded-xl shadow-md max-w-full md:max-w-[400px] w-full p-0 animate-slide-in-bottom md:animate-fade-in" aria-modal="true">
                <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-border">
                    <h2 className="text-base md:text-lg font-semibold text-text-primary">{title}</h2>
                    <button
                        type="button"
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors -mr-1"
                        onClick={onClose}
                        aria-label="Close"
                        disabled={isLoading}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>Close</title><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="px-4 md:px-5 py-4">
                    <p className="text-sm md:text-base text-text-primary whitespace-pre-line">{message}</p>
                </div>
                <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2 px-4 md:px-5 py-4 border-t border-border">
                    <button
                        type="button"
                        className="w-full md:w-auto px-4 py-3 md:py-2 text-sm font-medium rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 md:py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${isDangerous ? 'bg-error text-white hover:bg-error/90' : 'bg-primary text-white hover:bg-primary-hover'}`}
                        onClick={handleConfirm}
                        disabled={isLoading}
                    >
                        {isLoading && (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <title>Loading</title>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </dialog>
        </div>
    );
});
