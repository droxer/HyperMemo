import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardApp from './dashboard';
import { AuthProvider } from '@/contexts/AuthContext';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import '@/i18n';
import './dashboard.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <AuthProvider>
            <BookmarkProvider>
                <DashboardApp />
            </BookmarkProvider>
        </AuthProvider>
    </React.StrictMode>
);
