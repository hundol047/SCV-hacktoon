# 보폭 실행 시연

- 영상: 보폭_클릭시연_관광지_호텔.mp4 (177.3초, 1920×1080, 30fps, H.264/AAC 무음).
- 해당 브랜치의 로컬 앱을 실제 조작하여 녹화했습니다. 외부 AI 응답이나 실시간 도로·예약 공급자 연결을 시연한 것은 아닙니다.
- 관광지·호텔 원본 사진과 OpenStreetMap 지도 타일을 외부 서버에서 실제 로드했습니다. 소개·마무리 화면도 이번 실행의 첫 화면을 사용합니다. 스크린샷을 사진으로 대체하는 처리는 제거했습니다. 네트워크 응답 기록과 화면 검증 이미지를 함께 제공합니다.
- 한국어 자막은 영상에 포함되며 별도 SRT도 제공합니다. 유튜브 게시 자체는 수행하지 않았습니다.
- 재현: record-bopok-click.cjs → render-demo-cards.cjs → edit-bopok-click.py.

## 실행 준비

루트와 `vendor/my-ai-lab`에서 각각 `npm ci` 후 루트에서 `npm run dev`를 실행합니다. Chromium에는 환경 프록시 CA 신뢰가 필요하며 TLS 검증은 유지합니다. Playwright FFmpeg가 설치되어 있어야 합니다. 이번 실행에서는 `PLAYWRIGHT_BROWSERS_PATH=/tmp/bopok-browsers`를 사용했습니다.
