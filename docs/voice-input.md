# Korean voice entry with AI interpretation

The compact four-field form keeps one microphone button. Browser SpeechRecognition/webkitSpeechRecognition performs Korean transcription after the user clicks; `/api/voice-intent` then sends the transcript, current form and up to six recent conversation turns to the existing Bedrock model (`global.openai.gpt-6-sol`) for structured interpretation. This replaces the original keyword-only execution path. The old parser utility is not used as a silent fallback.

Examples:
- 판교역에서 내일 강릉으로 1박 2일 일정 만들어 줘
- 엄마랑 바다 보고 싶어. 많이 걷지 않고 쉬엄쉬엄 다니고 싶어.
- 걷는 건 십오 분 정도, 중간에 이십 분 쉬고 싶어.
- 그럼 여행지는 속초로 바꿔줘.
- 이 서비스로 어떤 여행을 만들 수 있어?
- 일정 만들어 줘 / 아니, 만들지 말고 조건만 바꿔줘

The model returns update, clarify, answer, generate or cancel. Nullable patch fields preserve existing selections. Unsupported regions, invalid dates, numeric ranges and missing departure on generation are checked server-side. Numeric walking/rest limits not present as explicit durations in user turns are replaced with a clarification. Age or mobility descriptions alone cannot become a numeric limit. Questions/answers/cancellation do not execute generation. Interpreted corrections, preferences and accessibility requirements map to the existing form and course API; the existing course model is unchanged.

The UI shows what it heard and the AI response. Questions can be answered with the microphone again. Failed AI requests expose retry and preserve the form. Stale responses cannot overwrite manual edits; cancelling or unmounting aborts the client request and invalidates late responses. Server processing already started may still consume API usage. No audio or conversation is persisted by the application; speech may be processed by the browser provider and transcripts/context by AWS, as disclosed beside the button.

Deployment: HTTPS (localhost allowed), microphone permission and a supported browser are required. The existing HTTP IP address cannot use microphone capture. AI uses the existing server region, EC2 role and `reserveAI` quota/account rules. Each interpretation consumes an additional AI request; there is no local keyword fallback when Bedrock is unavailable. No new API key is required.

Verification uses injected Bedrock responses and desktop/mobile browser recognition/API mocks for conversation carry-over, clarification, corrections, one-shot execution and error retention. Live Bedrock inference and real microphone accuracy still require the deployed HTTPS service and its server credentials; local mocks do not establish those results.
