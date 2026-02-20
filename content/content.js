/**
 * Instagram Reel Slider - Content Script
 * Adds a minimalist progress scrubber to Instagram video elements.
 */

// State tracking for enhanced videos and cleanup
const enhanced = new WeakSet();
const cleanupMap = new WeakMap();

// Playback speed options (0.25x to 2x)
const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * Gets the most visible/active video element on the page.
 * Prioritizes videos that are in viewport and playing.
 */
function getActiveVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  // Find video in viewport
  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const isInViewport =
      rect.top >= -rect.height &&
      rect.left >= -rect.width &&
      rect.bottom <= window.innerHeight + rect.height &&
      rect.right <= window.innerWidth + rect.width;

    if (isInViewport && rect.width > 100 && rect.height > 100) {
      return video;
    }
  }

  // Fallback to largest video
  return videos.reduce((largest, video) => {
    const rect = video.getBoundingClientRect();
    const largestRect = largest.getBoundingClientRect();
    return rect.width * rect.height > largestRect.width * largestRect.height
      ? video
      : largest;
  }, videos[0]);
}

/**
 * Finds a suitable parent element to attach the slider container.
 * Prefers positioned ancestors for proper absolute positioning.
 */
function findAttachmentParent(video) {
  if (!video) return null;
  if (video.offsetParent) return video.offsetParent;

  let el = video.parentElement;
  while (el && el !== document.body) {
    const pos = getComputedStyle(el).position;
    if (pos && pos !== 'static') return el;
    el = el.parentElement;
  }
  return video.parentElement || document.body;
}

/**
 * Updates the slider's visual progress based on video currentTime.
 */
function updateProgress(video, slider) {
  if (!video || !slider) return;

  const dur = Number(video.duration);
  const cur = Number(video.currentTime);

  if (!isNaN(dur) && dur > 0) {
    const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
    slider.style.background = `linear-gradient(to right, rgba(255,255,255,0.85) ${pct}%, rgba(255,255,255,0.18) ${pct}%)`;

    // Keep slider value synced (avoid clobbering while user is scrubbing)
    if (document.activeElement !== slider) {
      slider.value = cur;
    }
    slider.max = dur;
  } else {
    slider.style.background = 'linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.18) 0%)';
  }
}

/**
 * Creates and attaches the slider controls to a video element.
 * Idempotent - safe to call multiple times on the same video.
 */
function createControls(video) {
  if (!video || !(video instanceof HTMLVideoElement)) return;
  if (enhanced.has(video)) return;

  const parent = findAttachmentParent(video);
  if (!parent) return;

  // Check for existing container to avoid duplicates
  const existing = parent.querySelector('.custom-seek-container');
  if (existing) {
    const linked = existing.dataset && existing.dataset.forVideo === (video.dataset && video.dataset.customId);
    if (linked) {
      enhanced.add(video);
      return;
    }
  }

  // Create DOM elements
  const container = document.createElement('div');
  container.className = 'custom-seek-container';
  container.setAttribute('aria-hidden', 'true');

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'custom-slider';
  slider.min = 0;
  slider.step = 0.01;
  slider.value = 0;

  // Prevent clicks from propagating to Instagram's handlers
  function stopProp(e) {
    e.stopPropagation();
  }
  container.addEventListener('click', stopProp, { capture: true });
  container.addEventListener('mousedown', stopProp, { capture: true });
  slider.addEventListener('click', stopProp, { capture: true });

  // Named handlers for proper cleanup
  function onTimeUpdate() {
    updateProgress(video, slider);
  }

  function onLoadedMetadata() {
    if (!isNaN(video.duration)) {
      slider.max = video.duration;
    }
    updateProgress(video, slider);
  }

  function onSeeked() {
    updateProgress(video, slider);
  }

  function onSliderInput() {
    const t = parseFloat(slider.value);
    if (!isNaN(t)) {
      try {
        video.currentTime = t;
        updateProgress(video, slider);
      } catch (err) {
        // Ignore DOM exceptions (e.g., if video is not seekable)
      }
    }
  }

  // Attach listeners
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('loadedmetadata', onLoadedMetadata);
  video.addEventListener('seeked', onSeeked);
  slider.addEventListener('input', onSliderInput);

  // Insert into DOM
  parent.appendChild(container);
  container.appendChild(slider);

  // Sync initial state
  if (!isNaN(video.duration)) slider.max = video.duration;
  updateProgress(video, slider);

  // Mark as enhanced
  enhanced.add(video);

  // Create cleanup function
  const cleanup = () => {
    try {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      slider.removeEventListener('input', onSliderInput);
      container.removeEventListener('click', stopProp, { capture: true });
      container.removeEventListener('mousedown', stopProp, { capture: true });
      slider.removeEventListener('click', stopProp, { capture: true });
    } catch (e) {
      // Ignore if already removed
    }
    try {
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    } catch (e) {}
    try {
      enhanced.delete(video);
    } catch (e) {}
    cleanupMap.delete(video);
  };

  cleanupMap.set(video, cleanup);
}

/**
 * Cleans up all enhancements from a video element.
 */
function cleanupVideo(video) {
  if (!video) return;
  const fn = cleanupMap.get(video);
  if (typeof fn === 'function') fn();
}

// Initial pass: enhance existing videos
try {
  document.querySelectorAll('video').forEach((v) => {
    try {
      createControls(v);
    } catch (e) {
      // Individual failures shouldn't break the whole script
    }
  });
} catch (e) {
  // Ignore if querySelectorAll is restricted early
}

// MutationObserver for dynamic SPA changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Process added nodes
    if (mutation.addedNodes && mutation.addedNodes.length) {
      mutation.addedNodes.forEach((node) => {
        if (!node || node.nodeType !== 1) return;
        try {
          if (node.tagName === 'VIDEO') {
            createControls(node);
          } else if (node.querySelectorAll) {
            const vids = node.querySelectorAll('video');
            if (vids && vids.length) {
              vids.forEach((v) => createControls(v));
            }
          }
        } catch (e) {
          // Continue on individual failures
        }
      });
    }

    // Process removed nodes: cleanup
    if (mutation.removedNodes && mutation.removedNodes.length) {
      mutation.removedNodes.forEach((node) => {
        if (!node || node.nodeType !== 1) return;
        try {
          if (node.tagName === 'VIDEO') {
            cleanupVideo(node);
          } else if (node.querySelectorAll) {
            const vids = node.querySelectorAll('video');
            if (vids && vids.length) {
              vids.forEach((v) => cleanupVideo(v));
            }
          }
        } catch (e) {
          // Continue on individual failures
        }
      });
    }
  }
});

// Start observing body for dynamic SPA changes
observer.observe(document.body, { childList: true, subtree: true });

// ---- Keyboard Shortcuts ----

/**
 * Toggles play/pause on the active video.
 */
function togglePlayPause() {
  const video = getActiveVideo();
  if (!video) return false;

  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
  return true;
}

/**
 * Seeks backward by the specified seconds.
 */
function seekBackward(seconds = 5) {
  const video = getActiveVideo();
  if (!video) return false;

  video.currentTime = Math.max(0, video.currentTime - seconds);
  return true;
}

/**
 * Seeks forward by the specified seconds.
 */
function seekForward(seconds = 5) {
  const video = getActiveVideo();
  if (!video) return false;

  video.currentTime = Math.min(video.duration || video.currentTime + seconds, video.currentTime + seconds);
  return true;
}

/**
 * Increases volume by the specified amount (0-1).
 */
function increaseVolume(amount = 0.1) {
  const video = getActiveVideo();
  if (!video) return false;

  video.volume = Math.min(1, video.volume + amount);
  return true;
}

/**
 * Decreases volume by the specified amount (0-1).
 */
function decreaseVolume(amount = 0.1) {
  const video = getActiveVideo();
  if (!video) return false;

  video.volume = Math.max(0, video.volume - amount);
  return true;
}

/**
 * Cycles to the next higher playback speed.
 */
function increaseSpeed() {
  const video = getActiveVideo();
  if (!video) return false;

  const currentSpeed = video.playbackRate || 1;
  const currentIndex = PLAYBACK_SPEEDS.indexOf(currentSpeed);
  const nextIndex = Math.min(currentIndex + 1, PLAYBACK_SPEEDS.length - 1);
  video.playbackRate = PLAYBACK_SPEEDS[nextIndex];
  return true;
}

/**
 * Cycles to the next lower playback speed.
 */
function decreaseSpeed() {
  const video = getActiveVideo();
  if (!video) return false;

  const currentSpeed = video.playbackRate || 1;
  const currentIndex = PLAYBACK_SPEEDS.indexOf(currentSpeed);
  const prevIndex = Math.max(currentIndex - 1, 0);
  video.playbackRate = PLAYBACK_SPEEDS[prevIndex];
  return true;
}

/**
 * Resets playback speed to 1x.
 */
function resetSpeed() {
  const video = getActiveVideo();
  if (!video) return false;

  video.playbackRate = 1;
  return true;
}

// Command handler mapping
const commandHandlers = {
  'play-pause': togglePlayPause,
  'seek-backward': seekBackward,
  'seek-forward': seekForward,
  'speed-toggle': increaseSpeed,
  'volume-down': decreaseVolume,
  'volume-up': increaseVolume,
  'speed-down': decreaseSpeed,
  'speed-up': increaseSpeed,
  'speed-reset': resetSpeed
};

// Listen for commands from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'command' && message.command) {
    const handler = commandHandlers[message.command];
    if (handler) {
      const result = handler();
      sendResponse({ success: result });
    } else {
      sendResponse({ success: false, error: 'Unknown command' });
    }
  }
  return true; // Keep message channel open for async response
});

// Expose debug API on window for troubleshooting
try {
  Object.defineProperty(window, '__instaScrubber', {
    value: {
      enhanceAll: () => {
        document.querySelectorAll('video').forEach(createControls);
      },
      enhancedCount: () => {
        let n = 0;
        cleanupMap && cleanupMap.forEach && cleanupMap.forEach(() => n++);
        return n;
      },
      cleanupAll: () => {
        cleanupMap.forEach && cleanupMap.forEach((fn) => fn && fn());
      },
      // Keyboard shortcut functions for testing
      togglePlayPause,
      seekBackward,
      seekForward,
      increaseSpeed,    // Also used for speed-toggle command
      decreaseSpeed,
      resetSpeed,
      increaseVolume,
      decreaseVolume,
      getActiveVideo
    },
    configurable: true,
    writable: false,
    enumerable: false
  });
} catch (e) {
  // Ignore in restricted contexts
}
