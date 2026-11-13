# Website guide video

Updated 2026-11-09 for the Gangwon companion-comfort interface.

The 1920×1080 recording uses the actual local application UI. It covers walking/rest preferences, a saved itinerary, official-policy information, itinerary-derived application text, evidence upload and review, settlement text, and export. External evidence reading is stubbed for repeatable recording; this is not a live Bedrock integration test. The receipt is explicitly marked “기능 안내용 예시 · 제출 불가”, with a matching synthetic extraction response. No real personal documents or credentials are used. Destination facilities are not represented as verified accessible.

To reproduce (development dependencies, Chromium and Playwright FFmpeg required):

```sh
RECORD_GUIDE=1 npx playwright test --config playwright.guide.config.ts
python3 scripts/encode-guide.py
```

The recorder writes raw footage, timing and chapter metadata to `/tmp/yeohaengit-guide`. The encoder updates `public/videos/travel-guide.mp4`, its poster and VTT tracks, and `src/data/guide-chapters.json`. Update the shared asset version in `UsageVideo.tsx` when publishing a replacement. Recording fixtures affect only the test browser; production API behavior is unchanged.

Policy availability is a dated announcement snapshot, not live budget availability. Original evidence storage currently uses the user's browser IndexedDB, not server cloud storage. The actual UI retains these distinctions.
