# Changelog

All notable changes to HyperMemo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.8] - 2025-12-07

### Added
- **Streaming Responses**: AI responses now stream in real-time using Server-Sent Events (SSE), providing a much better user experience with text appearing progressively
- **Conversation Context**: AI chat now maintains conversation history within a session, enabling natural follow-up questions and multi-turn conversations

### Changed
- **Citation Style**: Redesigned inline citations to Wikipedia-style bracketed links `[1]`, `[2]` with hover tooltips showing source titles
- **Citation Container**: Enhanced the sources section below AI responses with blue gradient background and improved visual contrast
- **RAG Prompt**: Updated AI to generate numbered citations instead of inline markdown links for cleaner formatting

### Fixed
- **Citation Rendering**: Fixed issue where `[1]`, `[2]` citation markers were not clickable - now properly linked to source bookmarks

## [0.0.6] - 2025-12-04

### Added
- **Chat UI Overhaul**: Modernized the AI chat interface with a clean, flat design ("twink" style) consistent with the app's aesthetic.
- **User Avatars**: Chat now displays the user's Google profile picture instead of a generic initial.
- **Image Processing Script**: Added `scripts/resize_images.py` to automate screenshot resizing and formatting for the store.

### Changed
- **AI Avatar**: Updated the AI assistant avatar to a modern sparkle icon with a subtle, clean design.
- **Dark Mode**: Refined chat bubbles and avatars to look perfect in dark mode, using specific border and background overrides.
- **Screenshots**: Updated store screenshots to 1280x800 JPEG format.

### Fixed
- **Accessibility**: Added missing titles to SVGs in the dashboard to pass accessibility checks.

### Added (Previous)
- **Smart Content Extraction**: Implemented backend-side content fetching using `@mozilla/readability` to strip ads and navigation, ensuring high-quality content capture.
- **Enhanced Markdown Rendering**: Added `remark-gfm` support for tables and task lists, plus comprehensive styling for all markdown elements.
- **Smart Refetch**: The "Refetch" button now triggers the robust backend extraction pipeline instead of a simple client-side fetch.

### Changed
- **UI Polish**: Enhanced "Pro" and "AI" badges with vibrant gradients and depth.
- **Dashboard Consistency**: Unified styling for Tags, Summary, and Content sections with consistent card designs.
- **Icons**: Updated the "Refetch" icon to a download symbol for better semantic meaning.
- **Loading States**: Improved content loading experience with a centered spinner in the content area.

## [0.0.5] - 2025-12-03

### Added
- **LLM-based Reranking**: RAG query now uses AI to rerank search results for better relevance
- **Embedded Citation Links**: AI responses now include clickable links to source bookmarks
- **HTML-to-Markdown Conversion**: Original content is now parsed from HTML and converted to clean markdown format using Turndown
- **Profile Dropdown Menu**: Sign-out moved to a polished dropdown menu accessible from profile avatar
- **Enhanced Delete Confirmation**: Bookmark deletion now shows the bookmark title in confirmation dialog

### Changed
- **Subscription Model**: AI summaries and smart tags are now available to all users (free feature)
- **Subscription UI**: Updated feature list - renamed "RAG Chat" to "AI Chat", "Smart Tags" to "AI Tags", removed "Export to Docs", added "AI Notes"
- **Modal Design**: Completely redesigned confirmation modals with better spacing, animations, and visual hierarchy
- **Delete Button**: Enhanced hover effects with red tint, border, and scale animation
- **Google Sign-in**: Polished auth page design with logo and official Google button styling

### Fixed
- **Citation Rendering**: Fixed issue where AI response citations were not clickable
- **Dark Mode**: Improved button hover effects to work consistently in both light and dark themes
- **Layout Shift**: Added transparent borders to prevent layout shift on hover states

## [0.0.4] - 2025-12-03

### Added
- **UI Redesign**: Complete overhaul of the dashboard with a modern, "Notion-like" aesthetic.
- **Responsive Design**: Dashboard now adapts seamlessly to mobile and tablet screens.
- **Collapsible Chat History**: New toggle in the header to show/hide chat history.
- **Cron Job**: Added daily cleanup for unused tags in Supabase.
- **DevOps**: Added `make bump-version` command.

### Changed
- **Contrast**: Improved global color contrast and dark mode support for better accessibility.
- **Layout**: Widened the main content area and sidebars for better readability.
- **Notes Tab**: Disabled "Notes" tab and added a "Coming Soon" badge.

## [0.0.3] - 2025-12-03

### Added
- **Background AI Processing**: Implemented Supabase Database Webhooks to handle AI summarization and tagging asynchronously.
- **New Edge Function**: `process-bookmark` for handling webhook events.

### Changed
- **Performance**: Moved AI tasks out of the main request loop to improve UI responsiveness.
- **Database**: Updated schema to support `pg_net` and webhook triggers.
- **Auto-generation**: AI generation now triggers automatically for all users upon bookmark creation.

## [0.0.2] - 2025-12-01

### Added
- Admin CLI tools for subscription management and user statistics
- Documentation for Admin CLI (`docs/admin-cli.md`)
- Table format output for admin stats script

### Changed
- Updated CLI scripts to use `pnpm`
- Refactored `manage-subscription.ts` for better code quality
- Updated `SUBSCRIPTION_SYSTEM.md` to reference new Admin CLI docs

### Fixed
- Pre-commit linting issues in `dashboard.tsx`, `SubscriptionManager.tsx`, and `subscriptionService.ts`
- SVG accessibility issues (added titles)
- Type safety improvements in subscription service

## [0.0.1] - 2025-12-01

### Added
- Initial release
- AI-powered bookmark management
- Smart tag generation
- RAG-based chat with saved pages
- Multi-language support (English, Chinese Simplified, Chinese Traditional)
- Dashboard with overview and chat tabs
- Bookmark organization with tag filtering
- Auto-summarization of saved pages
- Chrome extension popup for quick bookmarking

### Technical
- React + TypeScript frontend
- Supabase backend with Edge Functions
- Firebase integration for AI features
- Chrome Extension Manifest V3
- Optimistic updates for better UX
- Error boundaries for resilience

[Unreleased]: https://github.com/yourusername/hypermemo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/hypermemo/releases/tag/v0.1.0
