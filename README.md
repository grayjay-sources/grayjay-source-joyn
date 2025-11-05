# GrayJay Joyn Plugin

> **Status:** 🟡 ~70% Complete | **Type:** TypeScript | **Size:** ~26 KB

A GrayJay plugin for [Joyn](https://joyn.de) - German streaming platform for TV shows, series, movies, and live TV.

## ✨ Features

### ✅ Implemented
- 🏠 **Home Feed** - Browse featured content from landing page
- 🔍 **Search** - Powered by Algolia with pagination
- 📺 **Live TV Channels** - ProSieben, Sat.1, Kabel Eins, etc.
- 📚 **Series as Playlists** - Browse all seasons and episodes
- 🎬 **Episode Metadata** - Titles, descriptions, thumbnails
- 🔐 **Anonymous Authentication** - Auto-managed tokens
- 💾 **State Persistence** - Saves auth across sessions

### ⏳ Pending
- ❌ **Video Playback** - Stream URL extraction (needs DRM handling)
- ❌ **Movie Details** - Full metadata parsing
- ❌ **Brand Channels** - Mediathek content browsing

## 📥 Installation

### Via GitHub (Recommended)
```
https://raw.githubusercontent.com/grayjay-sources/grayjay-source-joyn/main/build/JoynConfig.json
```

### Via grayjay-sources.github.io
1. Visit https://grayjay-sources.github.io
2. Search for "Joyn"
3. Click "Install"

### Via QR Code
*(Scan with GrayJay mobile app)*

## 🏗️ Architecture

**Content Hierarchy:**
```
├── Channels
│   ├── Live TV (ProSieben, Sat.1, etc.) ✅
│   └── Brands/Mediatheken ⏳
├── Playlists
│   └── Series (all seasons/episodes) ✅
└── Content
    ├── Episodes (metadata) ✅
    └── Movies ⏳
```

**APIs Used:**
- GraphQL API (`api.joyn.de/graphql`) - 17 persisted queries
- Algolia Search (`ffqrv35svv-dsn.algolia.net`)
- Anonymous Auth (`auth.joyn.de`)
- Image CDN (`img.joyn.de`)

## 🛠️ Development

### Build from Source
```bash
git clone https://github.com/grayjay-sources/grayjay-source-joyn
cd grayjay-source-joyn
npm install
npm run build
```

### Project Structure
- **TypeScript** source in `src/`
- **Rollup** bundler
- **Build output** in `build/`
- **Type-safe** with plugin.d.ts

### Available Scripts
```bash
npm run build          # Build production version
npm run dev            # Watch mode for development
npm run generate-icon  # Regenerate icon from SVG
npm run prettier       # Format code
```

## 📊 Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Home Feed | ✅ 100% | Landing page with videos |
| Search | ✅ 100% | Algolia integration |
| Live TV Channels | ✅ 90% | Metadata complete, streams pending |
| Series Playlists | ✅ 100% | Full playlist support |
| Episode Details | ✅ 70% | Metadata only, no playback |
| Movie Details | ⏳ 20% | Stub only |
| Brand Channels | ⏳ 20% | Stub only |
| **Overall** | **~70%** | Core features work |

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for detailed status.

## ⚠️ Known Limitations

1. **No Video Playback** - Stream URLs not yet extracted (DRM handling needed)
2. **No Live Streaming** - Live channel metadata works, playback URLs pending
3. **Limited Content Types** - Movies and brands are stubs
4. **No Subtitles** - Not yet implemented
5. **No Quality Selection** - Pending video source extraction

## 🎯 Roadmap

### Phase 1: Core ✅ (Complete)
- [x] TypeScript infrastructure
- [x] GraphQL integration
- [x] Search (Algolia)
- [x] Channel listings
- [x] Episode metadata
- [x] Series playlists

### Phase 2: Playback ⏳ (In Progress)
- [ ] Video source extraction
- [ ] DRM/entitlement handling
- [ ] Live stream URLs
- [ ] Quality levels
- [ ] Subtitles

### Phase 3: Complete Coverage ⏳ (Planned)
- [ ] Movie full implementation
- [ ] Brand channel content
- [ ] Episode listing in playlists
- [ ] Recommendations
- [ ] User authentication (optional)

### Phase 4: Polish (Planned)
- [ ] Comprehensive testing
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Documentation

## 🤝 Contributing

Contributions are welcome, especially for:
- 🎥 **Video source extraction** (DRM knowledge helpful)
- 🎬 **Movie implementation**
- 🏢 **Brand channel support**
- 🧪 **Testing and bug reports**

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📖 Documentation

- `IMPLEMENTATION_STATUS.md` - Detailed implementation status
- `TODO.md` - Task list
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `types/plugin.d.ts` - GrayJay plugin API reference

## 🔗 Links

- **GitHub:** https://github.com/grayjay-sources/grayjay-source-joyn
- **Issues:** https://github.com/grayjay-sources/grayjay-source-joyn/issues
- **Joyn Platform:** https://www.joyn.de
- **GrayJay App:** https://grayjay.app

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

**Maintained by:** Bluscream, Cursor.AI  
**Last Updated:** 2025-11-05
