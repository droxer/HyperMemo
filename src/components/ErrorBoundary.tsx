import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    maxWidth: '600px',
                    margin: '2rem auto'
                }}>
                    <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>
                        Something went wrong
                    </h2>
                    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                        We encountered an unexpected error. Please try refreshing the page.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        Refresh Page
                    </button>
                    {this.state.error && (
                        <details style={{ marginTop: '2rem', textAlign: 'left' }}>
                            <summary style={{ cursor: 'pointer', color: '#64748b' }}>
                                Error details
                            </summary>
                            <pre style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: '#f8fafc',
                                borderRadius: '0.5rem',
                                overflow: 'auto',
                                fontSize: '0.875rem'
                            }}>
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
