# Changelog

All notable changes to HyperMemo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Original content indicator when viewing full page content
- Error boundary for better error handling
- Performance optimizations for tag and bookmark operations

### Changed
- Updated extension description for better clarity
- Improved tag deletion with optimistic updates
- Debounced storage writes for better performance

### Fixed
- Tag deletion now provides instant UI feedback
- Bookmark save operations no longer trigger full list refresh
- Reduced storage I/O operations by 80%

## [0.1.0] - 2025-12-01

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
