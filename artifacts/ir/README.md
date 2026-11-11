# 여행잇 신규 앱과 IR 덱

- IR: `여행잇_IR_STP_TAM_SAM_SOM.pptx`, 15 slides. Actual integrated application screenshots, STP, TAM/SAM/SOM and calculation assumptions.
- Source: MY-AI-LAB travel-planner at 7d9f5ee. New entry `/lab/`; legacy app `/legacy`.
- Existing AWS Bedrock implementation, EC2-role auth and AI budget remain unchanged. New UI sends start/guide/lodging/translation requests through the existing transport.
- Deploy: run `Deploy-UpdatedApp.ps1` in Windows PowerShell. Uses existing PEM and server.env, retains SQLite in Docker volume `yeohaengit-lab-data`. Requires existing server configuration. This workspace has no EC2 key and has not deployed to the production server.
- Validation: Next production build; 35,640 original planner combinations; original service/API tests; bridge transport/schema tests; browser desktop and mobile (no horizontal overflow); root/legacy/API forwarding and cross-origin rejection.
- AWS real inference, external photo/tile availability and production deployment need checking on the EC2 environment. No credentials were copied or embedded.

Market references (checked 2026-11-11):
1. MCST 2025 National Travel Survey, 2026-06-30: https://www.mcst.go.kr/site/s_notice/press/pressView.jsp?pSeq=22557
2. Gyeongbuk Ilbo citing same survey, 2026-07-05: https://v.daum.net/v/20260705165659435
TAM 39.5 trillion KRW annual travel spending. SAM scenario: Gangwon 5.858 trillion × 10% assumed target share = 585.8 billion. SOM first 12-month target: 2,000 travel parties × 500,000 = 1 billion. Spending is not platform revenue. No customer/contract/revenue traction is asserted.

Additional legacy regression run: 6/7 checks passed. The legacy live Gangneung catalog check received HTTP 503 in this environment; it was not changed or suppressed. It does not exercise the newly imported local dataset/planner.

## 보폭 전환 (2026-11-11)
최신 덱: `보폭_IR_STP_TAM_SAM_SOM.pptx` (15장). 이전 여행잇 덱은 과거 버전입니다.
이용자: 어르신 및 거동이 불편한 분. 가족·보호자는 함께 계획하는 동행자입니다.
- 기본: 어르신 동행, 짧게 걷기, 여유로운 속도.
- 필수 조건: 짧은 보행 분류, 원문 근거가 있는 휠체어 진입, 장애인 화장실.
- 휠체어 대여·경사로 단독 정보는 진입 근거로 사용하지 않습니다.
- 관광 뒤 20분 여유를 일정 계산에 반영합니다. 실제 휴식 좌석이 확보됐다는 의미가 아닙니다.
- 코스 교체·재배치에도 필수 조건을 유지합니다. 숙소 객실·실제 보행 경사·좌석은 현장 확인 대상입니다.
- AWS 모델·인증·사용량 제한 구현은 변경하지 않았습니다.
검증: 프로덕션 빌드, 이동 조건 필터·원문 근거·3개 대안·여유 간격 회귀 테스트, AI 전송/스키마 검사, 한국어 데스크톱·모바일 일정 생성 및 가로 넘침 없음, 다국어 문구 검사.
운영 서버에는 아직 배포하지 않았습니다. 같은 Deploy-UpdatedApp.ps1로 최신 브랜치를 배포할 수 있습니다.
최종 원본 회귀 검사도 통과: 35,640개 일정 조합, 충돌 0건. 최신 이동 조건 전용 검사는 별도 포함하고 npm test에 등록했습니다.
