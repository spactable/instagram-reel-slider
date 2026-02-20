/**
 * Instagram Reel Slider - Background Service Worker
 * Handles keyboard shortcuts and forwards commands to content script.
 */

chrome.commands.onCommand.addListener((command) => {
  // Get the active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;

    const tab = tabs[0];

    // Only send to Instagram tabs
    if (!tab.url || !tab.url.startsWith('https://www.instagram.com/')) {
      return;
    }

    // Forward the command to the content script
    chrome.tabs.sendMessage(tab.id, { action: 'command', command }, () => {
      // Ignore errors - content script may not be loaded yet
    });
  });
});
