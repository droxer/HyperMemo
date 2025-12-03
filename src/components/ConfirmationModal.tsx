import React, { useEffect, useRef } from 'react';

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

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDangerous = false
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    const [isLoading, setIsLoading] = React.useState(false);

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
            className="modal-overlay"
            ref={overlayRef}
            onClick={handleOverlayClick}
            onKeyDown={handleOverlayKeyDown}
            role="presentation"
        >
            <dialog open className="modal-container" aria-modal="true">
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button type="button" className="btn-icon" onClick={onClose} aria-label="Close" disabled={isLoading}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><title>Close</title><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="modal-content">
                    <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="ghost" onClick={onClose} disabled={isLoading}>{cancelLabel}</button>
                    <button
                        type="button"
                        className={isDangerous ? 'btn-danger' : 'primary'}
                        onClick={handleConfirm}
                        disabled={isLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {isLoading && (
                            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
};
