# Joyn Plugin TODO

## ✅ Completed
- [x] TypeScript build system setup
- [x] Project structure (src/, types/, build/)
- [x] Constants and configuration
- [x] GraphQL query definitions (persisted queries)
- [x] Authentication system (anonymous tokens)
- [x] GraphQL executeQuery function
- [x] Mappers (Asset→Video, Brand→Channel, LiveChannel→Channel)
- [x] Pagers (Video, Channel, Search)
- [x] Basic getHome() implementation
- [x] Token management with expiration
- [x] State saving/loading

## 🚧 In Progress
- [ ] Test getHome() with real API responses
- [ ] Verify asset mapping logic
- [ ] Add more robust error handling

## 📋 TODO - Core Methods

### High Priority
- [ ] **getContentDetails(url)**
  - Parse series/movie/episode URLs
  - Extract asset ID from URL
  - Query for detailed metadata
  - Map to PlatformVideoDetails
  - Handle series vs movies vs episodes

- [ ] **search(query, type, order, filters)**
  - Implement search GraphQL query
  - Map search results to videos
  - Add pagination support
  - Handle empty results

- [ ] **getChannel(url)**
  - Parse channel/brand URLs
  - Query for channel metadata
  - Map to PlatformChannel
  - Handle live TV channels vs brands

- [ ] **getChannelContents(url, type, order, filters)**
  - Get videos from a brand/channel
  - Support filtering and sorting
  - Implement pagination
  - Handle different content types

### Medium Priority
- [ ] **Live TV Support**
  - Implement live channel listing
  - Parse live stream URLs
  - Handle EPG (Electronic Program Guide) data
  - Map current program to video metadata

- [ ] **Series/Episode Handling**
  - List all seasons for a series
  - List episodes in a season
  - Track watch progress
  - Handle "next episode" functionality

- [ ] **Video Playback**
  - Extract video stream URLs
  - Handle authentication for playback
  - Support multiple quality levels
  - Parse DRM information if needed

### Low Priority
- [ ] **getUserSubscriptions()** (if possible)
  - Require user authentication
  - List followed brands/channels

- [ ] **searchChannels(query)**
  - Search for brands/channels
  - Map results to PlatformChannel

- [ ] **Recommendations**
  - Implement "Watch Next" recommendations
  - Parse recommendation lanes
  - Map to related videos

## 🐛 Known Issues
- [ ] No icon file yet (need JoynIcon.png)
- [ ] TypeScript warnings about allowImportingTsExtensions
- [ ] No video source extraction yet
- [ ] Limited error messages

## 🧪 Testing Needed
- [ ] Test with dev portal at http://100.100.1.57:11337/dev
- [ ] Verify GraphQL queries return expected data
- [ ] Test pagination
- [ ] Test error handling (404s, network errors)
- [ ] Test with different content types (series, movies, live)

## 📚 Documentation
- [ ] Add JSDoc comments to all public methods
- [ ] Document GraphQL query format
- [ ] Add usage examples to README
- [ ] Document build process

## 🎨 Polish
- [ ] Create/add Joyn icon (assets/JoynIcon.png)
- [ ] Add more detailed logging
- [ ] Improve error messages
- [ ] Add retry logic for failed requests
- [ ] Optimize GraphQL queries (only request needed fields)

