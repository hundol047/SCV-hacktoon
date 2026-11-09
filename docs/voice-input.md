# Korean voice trip entry

The compact four-field form offers an explicit microphone button. It uses the browser's SpeechRecognition/webkitSpeechRecognition with ko-KR, single utterances and final results only. Audio may be processed by the browser's recognition provider; this is disclosed next to the control. The app does not record or store audio and the existing Bedrock course generator is unchanged.

Examples:
- 판교역에서 내일 강릉으로 1박 2일 일정 만들어 줘
- 여행지는 속초
- 출발지는 판교고등학교
- 기간은 이틀
- 2027년 1월 3일
- 일정 만들어 줘

Recognized corrections update the current form. Explicit generation commands invoke the same validated workflow after React has applied the new fields. No final-result event can trigger generation twice. Unknown dates/regions are not guessed; ambiguous weekday expressions require an explicit date. Cancelled sessions ignore late results. Microphone access starts only after a button click and is aborted on unmount or when generation starts.

Deployment: HTTPS (localhost allowed), microphone permission, and a browser implementing Web Speech recognition are required. The existing plain HTTP IP address does not support this feature. Provider availability varies by device/network; unsupported or denied capture leaves manual entry usable. No new server API key is needed.

Verification: parser unit tests and desktop/mobile Playwright recognition-event mocks check fields, generation payload, corrections, duplication and cancellation. Real microphone quality and browser-provider connectivity require a physical-device test after HTTPS deployment; mocks do not establish actual transcription accuracy.
