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
