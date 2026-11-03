# WCN mobile playback and assets

Based on main commit `5be495c7394893c43afb51b183f94effcbbf98bf`, matching the saved startup recovery fix. The startup retry/recovery implementation is retained.

## Behaviour

- Restore all five authored story autoplay ranges on touch devices, forward and reverse, plus the final white/colour reveal.
- Keep the main 109-frame image sequence manual. Its frame holds during story autoplay; swipes advance the image through the manual intervals.
- Reduce opening-sequence swipe distance by about 35%, with the same pacing in reverse. Keep the semi-panorama pannable and require a fresh gesture to leave it.
- Preserve the 48-frame quick-navigation route, both opening buttons, the fixed final viewer and the existing Elementor handoff messages. No Elementor snippet update is required for these changes.
- Move touch woodgrain panning onto inner texture transforms. Outer layers still own the existing opacity transitions. Pause hidden texture panning.
- Resume a paused visible touch background after returning to the tab or a rejected play attempt, without requiring another swipe or enabling audio. Retain the existing bounded play retry policy. The restored reveal uses the existing Elementor handoff-rate setting.
- Limit touch image requests/decodes to four workers, prioritize the requested frame, retain at most 28 decoded sequence frames and eight preloaded woodgrain images. Correct cache eviction so protected frames do not accidentally expand that limit.

## Asset audit

Reviewed the repository inventory and image/video metadata against index.html usage. The old `text sequence` PNGs are superseded by `square.json`; they remain in the repository and are not loaded by this page. Desktop bird sequences and desktop colour/mask frames retain their original assets.

Added 249 touch-only files under `mobile/`. Equivalent originals total **138,688,880 bytes**; the new files total **52,824,352 bytes**, a **61.9% reduction**. This is the complete optimized asset set, not the initial page download. The page loads the selected assets as needed.

- 109 sequence frames and 48 quick-navigation frames: 1280 × 720 WebP.
- 63 woodgrain textures and the soffit overlay: 2250 × 435 WebP, preserving aspect ratio and transparency.
- Product icons: transparent WebP; smaller panorama, semi-panorama and video stills.
- Nine background MP4s: 1280 × 720 H.264, original frame rates and durations, fast-start metadata. AAC payloads copied unchanged; audio mix and volume settings unchanged.
- Original image colour profiles are retained. All original desktop files remain byte-for-byte unchanged.

`mobile/manifest.json` records every source, output, byte size and image dimension. Regenerate with `python3 scripts/optimize-mobile-assets.py` (Pillow and ffmpeg required).

## Validation

`node --test tests/*.test.cjs`: 11 passing tests execute the actual controller and rendering/loading functions from index.html. Coverage includes all forward/reverse story ranges, main-image immobility during autoplay, mid-clip reversal, loading/overlay pauses, semi-panorama hold, reveal/handoff ordering, reversible coordinates, transform ownership, request concurrency, cache bounds, background resume and desktop texture paths.

All generated images decode at the recorded dimensions. Transparent assets retain alpha and source ICC profiles. Video dimensions, frame rates, durations and copied audio payload hashes were checked. Inline script parsing and `git diff --check` pass.

These are logic and asset checks. A browser preview could not be opened in this environment; actual Safari/iPad rendering, frame pacing and Elementor integration still require device testing. Check ordinary forward/reverse swipes, a reversal during a story clip, horizontal semi-panorama/woodgrain panning, profile and colour changes, both quick-navigation buttons, rotation and returning from the Elementor gallery.
