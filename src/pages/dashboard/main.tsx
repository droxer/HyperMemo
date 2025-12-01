import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardApp from './dashboard';
import { AuthProvider } from '@/contexts/AuthContext';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@/i18n';
import './dashboard.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ErrorBoundary>
            <AuthProvider>
                <BookmarkProvider>
                    <DashboardApp />
                </BookmarkProvider>
            </AuthProvider>
        </ErrorBoundary>
    </React.StrictMode>
);
