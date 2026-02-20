// ==UserScript==
// @name         InstaReels Video Controller
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Minimal, robust scrubber for Instagram web videos. Implements MutationObserver-based injection, WeakSet tracking, safe cleanup, and metadata handling.
// @author       Assistant & Co
// @match        https://www.instagram.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ---- Styles (insert once) ----
    if (!document.head.querySelector('#insta-custom-seek-styles')) {
        const style = document.createElement('style');
        style.id = 'insta-custom-seek-styles';
        style.textContent = `
        .custom-seek-container {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 6px;
            z-index: 9999;
            background: rgba(255, 255, 255, 0.06);
            cursor: pointer;
            transition: height 0.15s ease-in-out, opacity 0.15s;
            opacity: 0.8;
            pointer-events: auto;
        }
        .custom-seek-container:hover { height: 10px; opacity: 1; }
        .custom-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 100%;
            background: transparent;
            outline: none;
            margin: 0;
            cursor: pointer;
            display: block;
            pointer-events: auto;
        }
        .custom-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 0; height: 0; }
        .custom-slider::-moz-range-thumb { width: 0; height: 0; border: 0; }
        `;
        document.head.appendChild(style);
    }

    // ---- State tracking for enhanced videos and cleanup ----
    const enhanced = new WeakSet();           // videos that have been enhanced
    const cleanupMap = new WeakMap();        // video -> cleanup function

    // Small helper: safe parent to attach container (try to place near the video)
    function findAttachmentParent(video) {
        // prefer the video's offsetParent or closest positionable ancestor, fallback to parentElement
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

    // ---- Core UI + behavior ----
    function updateProgress(video, slider) {
        if (!video || !slider) return;
        const dur = Number(video.duration);
        const cur = Number(video.currentTime);
        if (!isNaN(dur) && dur > 0) {
            const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
            slider.style.background = `linear-gradient(to right, rgba(255,255,255,0.85) ${pct}%, rgba(255,255,255,0.18) ${pct}%)`;
            // keep slider values synced
            if (document.activeElement !== slider) { // avoid clobbering while user scrubs
                slider.value = cur;
            }
            slider.max = dur;
        } else {
            // fallback visual when duration not known
            slider.style.background = 'linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.18) 0%)';
        }
    }

    function createControls(video) {
        if (!video || !(video instanceof HTMLVideoElement)) return;
        if (enhanced.has(video)) return; // idempotent
        // Heuristic: avoid tiny or non-user videos (optional safety)
        // if (video.clientWidth < 50 || video.clientHeight < 50) return;

        const parent = findAttachmentParent(video);
        if (!parent) return;

        // Avoid duplicates if container already exists near this video
        // (some layouts reuse parents) — still rely primarily on WeakSet
        const existing = parent.querySelector && parent.querySelector('.custom-seek-container');
        if (existing) {
            // If the existing container already references this video via dataset, skip
            const linked = existing.dataset && existing.dataset.forVideo === (video.dataset && video.dataset.customId);
            if (linked) {
                enhanced.add(video);
                return;
            }
            // otherwise continue — we will still attach to avoid interfering with other UI
        }

        // Create DOM
        const container = document.createElement('div');
        container.className = 'custom-seek-container';
        container.setAttribute('aria-hidden', 'true');

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'custom-slider';
        slider.min = 0;
        slider.step = 0.01;
        slider.value = 0;

        // Prevent clicks on controls from toggling Instagram play/pause handlers
        function stopProp(e) { e.stopPropagation(); }
        container.addEventListener('click', stopProp, { capture: true });
        container.addEventListener('mousedown', stopProp, { capture: true });
        slider.addEventListener('click', stopProp, { capture: true });

        // Named handlers so we can remove them later
        function onTimeUpdate() { updateProgress(video, slider); }
        function onLoadedMetadata() {
            if (!isNaN(video.duration)) {
                slider.max = video.duration;
            }
            updateProgress(video, slider);
        }
        function onSeeked() { updateProgress(video, slider); }
        function onSliderInput() {
            // parseFloat is important as slider.value can be string
            const t = parseFloat(slider.value);
            if (!isNaN(t)) {
                // set currentTime; some browsers may clamp value
                try { video.currentTime = t; } catch (err) { /* ignore DOM exceptions */ }
                updateProgress(video, slider);
            }
        }

        // Attach listeners
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('seeked', onSeeked);

        slider.addEventListener('input', onSliderInput);

        // Place container. Use position: absolute in CSS so parent should be positionable.
        // If parent isn't positioned, wrap container in an absolutely-positioned overlay near the video
        // We'll attempt to append to parent; if that causes layout issues, users can adjust CSS later.
        parent.appendChild(container);
        container.appendChild(slider);

        // Sync initial state
        if (!isNaN(video.duration)) slider.max = video.duration;
        updateProgress(video, slider);

        // Track enhanced video and cleanup handler
        enhanced.add(video);

        const cleanup = () => {
            try {
                video.removeEventListener('timeupdate', onTimeUpdate);
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
                video.removeEventListener('seeked', onSeeked);
                slider.removeEventListener('input', onSliderInput);
                container.removeEventListener('click', stopProp, { capture: true });
                container.removeEventListener('mousedown', stopProp, { capture: true });
                slider.removeEventListener('click', stopProp, { capture: true });
            } catch (e) { /* ignore if already removed */ }
            try {
                if (container.parentElement) container.parentElement.removeChild(container);
            } catch (e) {}
            // WeakSet supports delete
            try { enhanced.delete(video); } catch (e) {}
            cleanupMap.delete(video);
        };

        cleanupMap.set(video, cleanup);

        // Defensive: if video element is removed from DOM later, we will call cleanup from main observer
    }

    // ---- Cleanup utility ----
    function cleanupVideo(video) {
        if (!video) return;
        const fn = cleanupMap.get(video);
        if (typeof fn === 'function') fn();
    }

    // ---- Initial pass: enhance existing videos ----
    try {
        document.querySelectorAll('video').forEach((v) => {
            try { createControls(v); } catch (e) { /* individual failure shouldn't break whole script */ }
        });
    } catch (e) {
        // if querySelectorAll is restricted early, ignore
    }

    // ---- Efficient mutation observer: handle added & removed nodes incrementally ----
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // Process added nodes (fast-path: direct video nodes)
            if (mutation.addedNodes && mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (!node || node.nodeType !== 1) return;
                    try {
                        if (node.tagName === 'VIDEO') {
                            createControls(node);
                        } else {
                            // if node may contain videos
                            if (node.querySelectorAll) {
                                const vids = node.querySelectorAll('video');
                                if (vids && vids.length) {
                                    vids.forEach((v) => createControls(v));
                                }
                            }
                        }
                    } catch (e) { /* continue */ }
                });
            }

            // Process removed nodes: clean up listeners/containers for removed videos
            if (mutation.removedNodes && mutation.removedNodes.length) {
                mutation.removedNodes.forEach((node) => {
                    if (!node || node.nodeType !== 1) return;
                    try {
                        if (node.tagName === 'VIDEO') {
                            cleanupVideo(node);
                        } else {
                            if (node.querySelectorAll) {
                                const vids = node.querySelectorAll('video');
                                if (vids && vids.length) {
                                    vids.forEach((v) => cleanupVideo(v));
                                }
                            }
                        }
                    } catch (e) { /* continue */ }
                });
            }
        }
    });

    // Observe body for dynamic SPA changes
    observer.observe(document.body, { childList: true, subtree: true });

    // ---- Optional: expose a small API on window for debugging / manual cleanup ----
    try {
        Object.defineProperty(window, '__instaScrubber', {
            value: {
                enhanceAll: () => { document.querySelectorAll('video').forEach(createControls); },
                enhancedCount: () => {
                    // WeakSet size isn't available; count entries in cleanupMap as approximation
                    let n = 0;
                    cleanupMap && cleanupMap.forEach && cleanupMap.forEach(() => n++);
                    return n;
                },
                cleanupAll: () => { cleanupMap.forEach && cleanupMap.forEach((fn) => fn && fn()); }
            },
            configurable: true,
            writable: false,
            enumerable: false
        });
    } catch (e) { /* ignore in restricted contexts */ }

})();