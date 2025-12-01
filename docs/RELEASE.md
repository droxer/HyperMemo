# Release Guide

This guide explains how to build and release HyperMemo to the Chrome Web Store.

## Prerequisites

- Node.js and pnpm installed
- All code committed to git
- Version number updated in `package.json`
- CHANGELOG.md updated with release notes

## Quick Release

For a complete release process, simply run:

```bash
make release
```

This will:
1. Clean previous builds
2. Run linting
3. Build production bundle
4. Validate the build
5. Create a ZIP package
6. Show upload instructions

## Step-by-Step Release

### 1. Prepare for Release

Update version in `package.json`:
```json
{
  "version": "0.2.0"
}
```

Update `CHANGELOG.md` with changes:
```markdown
## [0.2.0] - 2025-12-01
### Added
- New feature X
### Fixed
- Bug Y
```

### 2. Build Production Bundle

```bash
make build-prod
```

This will:
- Clean previous builds
- Run code linting
- Type-check TypeScript
- Create optimized production build in `dist/`

### 3. Validate Build

```bash
make validate-build
```

Checks that all required files are present:
- manifest.json
- popup page
- dashboard page
- icons

### 4. Package for Chrome Web Store

```bash
make package
```

Creates `release/hypermemo-{version}.zip` ready for upload.

### 5. Upload to Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click on your extension (or "New Item" for first release)
3. Click "Package" → "Upload new package"
4. Upload `release/hypermemo-{version}.zip`
5. Fill in store listing details
6. Submit for review

### 6. Tag Release in Git

```bash
git tag v0.2.0
git push origin v0.2.0
```

## Make Commands Reference

| Command | Description |
|---------|-------------|
| `make build-prod` | Build production bundle |
| `make validate-build` | Validate build output |
| `make package` | Create ZIP package |
| `make release` | Complete release process |
| `make clean` | Remove build artifacts |

## Build Output

### Directory Structure

```
dist/
├── manifest.json           # Extension manifest
├── pages/
│   ├── popup/
│   │   └── index.html     # Popup page
│   └── dashboard/
│       └── index.html     # Dashboard page
├── assets/                # Compiled JS/CSS
└── icons/                 # Extension icons
```

### Package Contents

The ZIP package excludes:
- Source maps (*.map)
- .DS_Store files
- Development files

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
make clean
make build-prod
```

### Validation Fails

Check that all required files exist:
```bash
ls -la dist/
ls -la dist/pages/popup/
ls -la dist/pages/dashboard/
```

### Package Too Large

Chrome Web Store has a 100MB limit. Check package size:
```bash
ls -lh release/*.zip
```

If too large:
1. Remove unused dependencies
2. Optimize images
3. Check for accidentally included files

## Chrome Web Store Review

### Timeline
- Initial review: 1-3 business days
- Updates: Usually faster (< 24 hours)

### Common Rejection Reasons
1. **Permissions**: Requesting unnecessary permissions
2. **Privacy**: Missing or incomplete privacy policy
3. **Content**: Misleading description or screenshots
4. **Functionality**: Extension doesn't work as described

### Required Materials
- [ ] Extension package (ZIP)
- [ ] 128x128 icon
- [ ] 1280x800 or 640x400 screenshots (at least 1)
- [ ] Detailed description
- [ ] Privacy policy (if collecting data)
- [ ] Category selection

## Post-Release

### Monitor
- Chrome Web Store reviews
- User feedback
- Error reports

### Update Process
1. Fix issues
2. Increment version
3. Update CHANGELOG
4. Run `make release`
5. Upload new package

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.2.0): New features, backwards compatible
- **PATCH** (0.1.1): Bug fixes, backwards compatible

Example:
- 0.1.0 → 0.1.1 (bug fix)
- 0.1.1 → 0.2.0 (new feature)
- 0.2.0 → 1.0.0 (major release)

## Rollback

If you need to rollback a release:

1. Revert to previous version in Chrome Web Store
2. Fix the issue locally
3. Create a new patch release
4. Upload fixed version

## Support

For issues with:
- **Build process**: Check build logs
- **Chrome Web Store**: Contact Chrome Web Store support
- **Extension bugs**: Check browser console and error logs
