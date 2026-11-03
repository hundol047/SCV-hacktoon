# 여행잇 0.11.0 · 앱 내부 도로 지도와 날씨

## HYUNDAI에서 이식한 부분

사용자 요청으로 `hundol047/HYUNDAI`의 커밋 `6d2fe079b9c631e105b81d1d380380f4b2f92b8a`를 읽고 아래 구성을 React/TypeScript + Java WebView에 맞게 이식했습니다. 원본 저장소는 변경하지 않았습니다.

- `core/src/jsMain/resources/nearby-map.js`: Leaflet, OSM 표준 타일, ResizeObserver 수명 관리, 날짜 변경선 경도 정렬, 사용자 문자열을 HTML로 해석하지 않는 지도 라벨.
- `app/src/main/java/io/cabinos/one/platform/NavigationService.kt`: OSRM `/route/v1/driving` GeoJSON 조회, HTTPS 제한·응답 한도·시간 초과.
- `core/src/commonMain/kotlin/io/cabinos/core/Navigation.kt`: 출발 도로 연결점 1km 검사. 여행잇에서는 도착점도 검사합니다.
- 원본 서울 경로 응답을 최소 필드로 줄인 `tests/fixtures/hyundai-seoul-road.json`은 **과거 응답 재생 검증**용입니다. 새 실시간 조회 증거가 아닙니다.
- 기존 프로젝트의 키·사용자 설정·GPS 이력은 복사하지 않았습니다. Leaflet BSD-2-Clause 라이선스를 `docs/licenses/leaflet.txt`와 APK `LEAFLET-LICENSE.txt`에 포함합니다. 지도에 © OpenStreetMap contributors를 표시합니다.

## 사용 방법

1. 지역 자료를 불러오고 기준 출발 장소·여행 날짜를 고릅니다. ‘현재 날씨·여행일 예보 조회’를 눌러 확인 후 ‘이 예보를 코스 추천에 적용’을 선택합니다.
2. Open-Meteo의 현지 시간대와 최대 16일 일별 예보를 사용합니다. 현재 기온은 모델값이며 관측소 실측값이 아닙니다. 구름·안개를 맑음으로 바꾸지 않으며, 강풍/뇌우 분류는 공식 특보 발령 판정이 아닙니다. 예보 조회 시각·좌표·날짜를 여행 JSON에 저장합니다. 2시간이 지나거나 여행 날짜가 바뀌면 추천 전에 다시 조회하거나 수동 날씨로 바꿉니다.
3. 택시/자가용 일정을 만든 뒤 ‘앱 안에서 자동차 도로 경로 확인’에서 구간을 선택합니다. 조회 성공 시 실제 도로 형상, 공급자 거리·예상 시간과 장소에서 도로 연결점까지의 거리를 표시합니다.
4. ‘도로 예상 시간을 일정 점검에 반영’은 카탈로그 경로 시간을 저장해 시간 부족 등을 다시 검사합니다. 기존 시간표를 자동 변경하지 않습니다. 지도 형상은 현재 화면에서만 보관하므로 다시 열면 재조회합니다.
5. 좌표를 OSRM/Open-Meteo로, 지도 타일 요청을 OSM으로 보냅니다. 조회는 버튼을 누를 때만 시작하며 GPS 권한이나 별도 사용자 API 키는 필요하지 않습니다. APK는 고정 HTTPS 호스트만 허용하는 Java 브리지를 사용하며 자격 증명·쿠키·리다이렉트를 사용하지 않습니다. 앱 내부 WebView에 임의 외부 스크립트를 열지 않습니다.

## 제공 범위와 운영 조건

- 자동차 경로만 지원합니다. OSRM은 실시간 교통, 택시 실요금·호출, 실제 통행 가능성을 보장하지 않습니다. 방문 순서 최적화는 기존 직선거리 기준입니다.
- OSM/OSRM 공개 서버는 체험용이며 가용성 보장이 없습니다. 실패하면 실패 상태를 표시하며 직선을 도로 경로로 대체하지 않습니다. 도로 연결점까지의 보행·출입구·주차는 미확인입니다.
- Open-Meteo 무료 엔드포인트는 비상업 미리보기용입니다. 상용 공개 운영 전 [Open-Meteo 이용 조건](https://open-meteo.com/en/terms)·[요금](https://open-meteo.com/en/pricing), [OSM 타일 정책](https://operations.osmfoundation.org/policies/tiles/), OSRM 공개 서버 정책을 확인하고 자체/계약 인프라로 전환해야 합니다. 데이터 CC BY 4.0 출처를 화면에 표시합니다.
- 키·로그인 없이 사용하는 읽기 전용 기능이므로 웹 서버 배포 없이 APK에서도 조회를 시도할 수 있습니다. 실제 휴대폰 네트워크, 공급자 가용성은 별도 조건입니다.

## 검증 구분 · 2026-11-03

개발 환경에서 Open-Meteo와 OSRM 접속은 프록시 CONNECT 403으로 거부되었습니다. 이를 우회하지 않았습니다. 환경 설정 초안에 `api.open-meteo.com`, `router.project-osrm.org`, `tile.openstreetmap.org`를 기존 목록을 보존해 추가했으나 `requires_publish=true`입니다. 설정 검토·저장·게시 전에는 이 환경에서 실제 API 검증이 완료됐다고 주장할 수 없습니다. 이 제한은 개발 환경 정책이며 사용자 휴대폰에 그대로 적용되는 정책은 아닙니다.

단위 테스트·기존 HYUNDAI 응답 재생·브라우저의 합성 예보/경로/지도 타일·Android 브리지 계약 검증과 실제 공급자/물리 Android 검증을 구분합니다. 새 테스트에서는 적용 전 날씨 조건 유지, 적용 후 조건·백업 보존, 경로 시간 저장, 구간 변경 시 이전 지도 제거, 서버 실패 시 경로를 생성하지 않는 동작을 확인합니다.

설정 적용 뒤 `NODE_USE_ENV_PROXY=1 npm run probe:public-travel`로 고정 서울 경로·예보·지도 타일 1개의 읽기 전용 실연결 검사를 실행할 수 있습니다. 이는 기기 검증을 대체하지 않습니다.

이번 실행: 단위 181개·데스크톱/모바일 화면 12개 통과, 웹/Android 빌드·APK v2/v3 서명 통과. Android 웹 자산의 합성 공개 API 브리지·예보 적용·지도 렌더링·경로 시간 보존 검사 통과. 최종 문구 정리 후 재빌드했습니다. 실연결 probe 3개는 현재 환경의 접속 제한으로 실패했으며 실제 성공으로 집계하지 않습니다.
