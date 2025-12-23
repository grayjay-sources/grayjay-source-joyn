# Joyn Plugin - Deployment Guide

## 📦 Installation

### For Users

**Via QR Code:**  
*(Generate QR code from URL below)*

**Via URL:**
```
https://raw.githubusercontent.com/grayjay-sources/grayjay-source-joyn/main/build/JoynConfig.json
```

**Via grayjay-sources.github.io:**
- Visit https://grayjay-sources.github.io
- Find "Joyn" in the list
- Click "Install"

### For Developers

**Clone and Build:**
```bash
git clone https://github.com/grayjay-sources/grayjay-source-joyn
cd grayjay-source-joyn
npm install
npm run build
```

**Output:** `build/` folder contains:
- `JoynConfig.json` - Plugin configuration
- `JoynScript.js` - Compiled plugin code (~26 KB)
- `JoynIcon.png` - Plugin icon (512x512, ~22 KB)

## 🔧 Development Setup

### Prerequisites
- Node.js >= 14
- npm >= 6.14.4

### Project Structure
```
grayjay-source-joyn/
├── src/                    # TypeScript source files
│   ├── JoynScript.ts      # Main plugin logic
│   ├── constants.ts        # API URLs and constants
│   ├── gqlQueries.ts       # GraphQL queries
│   ├── util.ts             # Helper functions
│   ├── Mappers.ts          # Data converters
│   └── Pagers.ts           # Pagination classes
├── types/                  # Type definitions
│   ├── plugin.d.ts         # GrayJay API types
│   └── types.d.ts          # Joyn-specific types
├── assets/                 # Source assets
│   ├── JoynIcon.svg        # Icon source
│   └── JoynIcon.png        # Generated icon
├── build/                  # Build output (deployed)
│   ├── JoynConfig.json     # ← Entry point
│   ├── JoynScript.js       # Compiled code
│   └── JoynIcon.png        # Icon
├── scripts/                # Build scripts
│   └── generate-icon.js    # SVG → PNG converter
├── JoynConfig.json         # Source config
├── package.json
├── tsconfig.json
└── rollup.config.js
```

### Build Commands

```bash
# Development (watch mode)
npm run dev

# Production build
npm run build

# Generate icon from SVG
npm run generate-icon

# Format code
npm run prettier
```

### Testing Locally

```bash
# 1. Build the plugin
npm run build

# 2. Serve the build folder
cd build
npx serve -p 8080

# 3. Load in GrayJay DevPortal
# Navigate to: http://100.100.1.57:11337/dev
# Config URL: http://YOUR_IP:8080/JoynConfig.json
```

## 🚀 Deployment

### Automatic (GitHub Actions)
- Builds automatically on push to `main`
- Updates `build/` folder
- Commits build output

### Manual
```bash
git add build/
git commit -m "chore: Update build output"
git push
```

### CDN URLs (after deployment)
- **Config:** `https://raw.githubusercontent.com/grayjay-sources/grayjay-source-joyn/main/build/JoynConfig.json`
- **Script:** `https://raw.githubusercontent.com/grayjay-sources/grayjay-source-joyn/main/build/JoynScript.js`
- **Icon:** `https://raw.githubusercontent.com/grayjay-sources/grayjay-source-joyn/main/build/JoynIcon.png`

## 📋 Release Checklist

Before releasing a new version:

- [ ] Update version number in `JoynConfig.json`
- [ ] Update changelog in `JoynConfig.json`
- [ ] Run `npm run build`
- [ ] Test in dev portal
- [ ] Update `README.md` if needed
- [ ] Commit and push
- [ ] Create GitHub release
- [ ] Update `sources.json` (if major changes)

## 🔐 Signing (Optional)

To sign the plugin:

```bash
# Generate keys
# (requires GrayJay signing tools)

# Update config
# - Set scriptSignature
# - Set scriptPublicKey
```

## 🌐 Adding to grayjay-sources Registry

The source is already listed in:
- https://grayjay-sources.github.io/sources.json

Entry includes:
- ✅ `_installUrl` - Direct install link
- ✅ `_feeds` - Commits & releases Atom feeds
- ✅ `_tags` - Proper categorization
- ✅ All required API domains in `allowUrls`
- ✅ `enablePlaylists` and `enableLiveContent` flags

## ⚠️ Current Limitations

**Video Playback:**
- Metadata extraction: ✅ Working
- Video sources: ❌ Not yet implemented
- Requires: DRM/entitlement handling

**Content Coverage:**
- Episodes: ✅ Metadata only
- Series: ✅ As playlists
- Live TV: ✅ Channel info only
- Movies: ⏳ Stub implementation
- Brands: ⏳ Stub implementation

**Testing Status:**
- Build: ✅ Passing
- DevPortal: ⏳ Pending
- Production: ❌ Not tested

## 📞 Support

- **Issues:** https://github.com/grayjay-sources/grayjay-source-joyn/issues
- **Discussions:** https://github.com/grayjay-sources/grayjay-source-joyn/discussions
- **Pull Requests:** Welcome!

## 📄 License

MIT License - See `LICENSE` file
