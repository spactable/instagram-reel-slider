# Instagram Reel Slider

A lightweight Chrome extension that brings back the video progress scrubber on Instagram Reels and videos. Built as a Manifest V3 extension.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

## Features

- **Minimalist Progress Slider** - Clean, unobtrusive scrubber that appears on hover
- **Smooth Scrubbing** - Drag to seek through video content
- **Automatic Injection** - Works seamlessly with Instagram's SPA navigation
- **Proper Cleanup** - No memory leaks; removes listeners when videos are unmounted
- **Zero Permissions** - Only requires host permission for instagram.com

## Installation

### Development / Unpacked Extension

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/yourusername/instagram-reel-slider.git
   cd instagram-reel-slider/extension
   ```

2. **Open Chrome Extensions page**:
   - Navigate to `chrome://extensions/` in your browser
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load unpacked extension**:
   - Click "Load unpacked"
   - Select the parent folder of this repository

5. **Verify installation**:
   - Visit [instagram.com](https://www.instagram.com/)
   - Open any Reel or video
   - at the bottom of the video you'll see the progress slider

## Usage

### Slider Controls

| Action           | Description                                        |
| ---------------- | -------------------------------------------------- |
| **Hover**        | Move cursor near the bottom of any Instagram video |
| **Click & Drag** | Click anywhere on the slider bar to seek           |
| **Release**      | Video continues playing from the new position      |

### Keyboard Shortcuts

All shortcuts use `Alt` as the modifier key to avoid conflicts with Instagram's native shortcuts.

**Default shortcuts (pre-configured):**

| Shortcut | Action |
|----------|--------|
| `Alt + K` | Play / Pause video |
| `Alt + ←` | Seek backward 5 seconds |
| `Alt + →` | Seek forward 5 seconds |
| `Alt + S` | Cycle playback speed |

**Additional shortcuts (set your own at `chrome://extensions/shortcuts`):**

| Command | Suggested Binding | Action |
|---------|-------------------|--------|
| `volume-down` | `Alt + ↓` | Decrease volume by 10% |
| `volume-up` | `Alt + ↑` | Increase volume by 10% |
| `speed-down` | `Alt + ,` | Decrease playback speed |
| `speed-up` | `Alt + .` | Increase playback speed |
| `speed-reset` | `Alt + 0` | Reset playback speed to 1x |

**Playback speeds:** 0.25x → 0.5x → 0.75x → 1x → 1.25x → 1.5x → 1.75x → 2x → (loops back)

> **Note:** Chrome allows only 4 pre-configured shortcuts per extension. To enable the additional shortcuts, go to `chrome://extensions/shortcuts`, find "Instagram Reel Slider", and assign your preferred keys.


## Project Structure

```
instagram-reel-slider/
├── manifest.json          # Extension manifest (MV3)
├── background/
│   └── background.js      # Service worker for keyboard shortcuts
├── content/
│   ├── content.js         # Main content script
│   └── styles.css         # Slider styles
├── icons/
│   ├── 16.png             # Toolbar icon (16x16)
│   ├── 32.png             # Toolbar icon, high-DPI displays (32x32)
│   ├── 48.png             # Extensions management page (48x48)
│   └── 128.png            # Chrome Web Store & install dialog (128x128)
├── userscript.js          # Original Tampermonkey userscript
├── README.md
├── LICENSE
└── .gitignore
```

## Debugging

A debug API is exposed on the `window` object for troubleshooting. Open the browser console on Instagram and use:

```javascript
// Re-scan and enhance all videos
window.__instaScrubber.enhanceAll();

// Get count of enhanced videos
window.__instaScrubber.enhancedCount();

// Remove all sliders and cleanup
window.__instaScrubber.cleanupAll();

// Test keyboard shortcut functions manually
window.__instaScrubber.togglePlayPause();
window.__instaScrubber.seekBackward(5);    // Seek back 5 seconds
window.__instaScrubber.seekForward(5);     // Seek forward 5 seconds
window.__instaScrubber.increaseVolume(0.1);
window.__instaScrubber.decreaseVolume(0.1);
window.__instaScrubber.increaseSpeed();
window.__instaScrubber.decreaseSpeed();
window.__instaScrubber.resetSpeed();

// Get the currently active video element
window.__instaScrubber.getActiveVideo();
```


## Chrome Web Store Submission Checklist

Before submitting to the Chrome Web Store:

- [ ] Update `author` and `homepage_url` in manifest.json
- [ ] Add screenshots (1280x800 or 640x400 recommended)
- [ ] Write a detailed store description
- [ ] Create a privacy policy (required if collecting any data - this extension collects none)
- [ ] Test thoroughly on clean Chrome profile
- [ ] Ensure no console errors or warnings

## Privacy

This extension:
- [x] Does **not** collect any user data
- [x] Does **not** track browsing activity
- [x] Does **not** communicate with external servers
- [x] Runs entirely locally in your browser
- [x] Only modifies Instagram pages

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Originally built as a Tampermonkey userscript
- Inspired by the desire to bring back Instagram's native scrubber functionality

---

**Disclaimer**: This extension is not affiliated with, endorsed, or sponsored by Meta Platforms, Inc. or Instagram.
