# MY-AI-LAB → 여행잇 강원 화면 이식

참조: https://github.com/hundol047/MY-AI-LAB/tree/7f24645/travel-planner
대상: SCV-hacktoon, 기존 feat/bopok-mvp의 24f6681 기반.

MY-AI-LAB의 청록색 테마·둥근 카드·사진 헤더·접이식 수동 입력·5개 강원 권역·일정과 지도 배치를 기존 React 컴포넌트에 적용했다. 원본의 정적 HTML/app.js를 덮어쓰는 대신 기존 여행잇 API와 상태 관리를 연결한다.

- 강릉·동해 / 속초·양양 / 춘천·철원 / 평창·정선 / 원주 권역. 세부 18개 시·군 모두 선택 가능.
- 관광지 검색은 KR-42로 한정. 출발지는 전국 주소·현재 위치를 계속 지원.
- 기존 Bedrock 서버, 모델·환경변수, AI 프롬프트, 후보 검증, 과금 제한과 API 경로는 변경하지 않는다. 원본의 OpenAI/내장 가이드는 이식하지 않는다.
- 결과는 일정 / 숙소 / 예산·할인 / 여행 도우미로 분리. 숨긴 패널의 입력 상태를 유지한다.
- 공유·캘린더·접근성·숙소 사진/예약 비교·일정 수정 기능을 유지한다.
- 강원 사진은 원본 저장소의 한국관광공사 장소-사진 대응을 사용한다. 원본 링크를 표시하고, 실패 시 재시도와 텍스트를 제공한다. 실시간 사진 제공 여부와 실제 AI 호출은 운영 환경의 공급자 연결이 필요하다.
- 기존 사용 안내 영상은 접이식 안내에 남겼다. 이번 화면의 새 녹화본은 아니다.

## 실행

```powershell
git clone -b feat/gangwon-lab-ui https://github.com/hundol047/SCV-hacktoon.git yeohaengit-gangwon
cd yeohaengit-gangwon
npm ci
npm run dev
```

http://localhost:3000 에서 확인한다. 기존 서버의 AI 키를 새로 발급하거나 변경할 필요가 없다. 새 로컬 실행 환경의 AI 호출에는 기존 환경 설정이 필요하다. 키를 Git에 커밋하지 않는다.

## 검증

```sh
npm run typecheck
npm run build
npm run test -- tests/bedrock-routes.test.ts tests/bedrock-json.test.ts tests/anonymous-ai.test.ts tests/ai.test.ts
npx playwright test --config playwright.lab.config.ts
```

브라우저 테스트는 외부 API를 고정 응답으로 검증한다. 강원 조회 범위와 AI 요청 계약, 모바일 정렬·접근성, 숙소 이미지 실패 대체/더보기, 날짜별 지도 전환을 확인한다. 기존 전국 홈 화면 전용 테스트는 이번 강원 홈 구성과 다르다.
