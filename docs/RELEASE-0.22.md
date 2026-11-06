# 여행잇 0.22.0 — 지역 할인·쿠폰 안내

일정의 날짜별 탭 아래에서 지역별 혜택을 확인합니다. 일정에 실제 포함된 시설은 먼저 표시하고, 다른 지역도 선택해 살펴볼 수 있습니다. 공유받은 일정과 Android 앱에서도 같은 안내를 제공합니다. AI 생성 경로에 외부 요청을 추가하지 않아 생성 대기시간을 늘리지 않습니다.

## 연결 범위

- 17개 시·도를 6개 권역별 한국관광공사 공식 혜택 목록으로 연결합니다. 목록에는 개별 행사 날짜·종료 여부가 포함됩니다.
- 공식 페이지에서 확인한 52개 디지털 관광주민증 참여지역을 묶어 안내합니다. 속초를 관광주민증 참여지역으로 임의 추가하지 않습니다.
- 경기·베이밸리·전북·경북·제주 관광패스 및 탐나오에 연결합니다. 비짓부산패스와 디스커버서울패스는 외국인 전용임을 표시합니다. 유료 패스를 무료 쿠폰으로 표현하지 않습니다.
- 설악 케이블카 속초시민 할인, 속초 여로요가, 정동진·정선 레일바이크, 태백 365세이프타운, 동해 도째비골 스카이밸리·무릉별유천지의 조건부 혜택을 등록했습니다.

## 데이터와 적용 방식

`src/data/travel-benefits.ts`의 공식 출처 기반 등록 목록을 사용합니다. 실시간 쿠폰 수집·자동 발급 API가 아니며, 발급·재고·결제는 공식 제공처에서 확인합니다. 현재 TourAPI 키만으로 관광주민증 발급을 수행하지 않습니다. 디지털서비스 개방의 직접 발급 연계에는 별도의 신청·심사·운영 API 인증키가 필요합니다. 전국 모든 업체의 혜택을 수집했다고 주장하지 않습니다.

개별 행사 기간과 선택한 여행일을 비교하고 이미 종료된 할인은 제외합니다. 특정 시설 할인 및 관광주민증 참여지역은 확인일로부터 30일 후 재검토 전까지 숨깁니다. 공식 목록 링크는 유지됩니다. 기존 일반 이용 요금이나 예상 비용은 할인 자격을 추정하여 자동 차감하지 않습니다. 출발지를 목적지로 오인하지 않으며 해외 일정에는 국내 혜택을 자동 추천하지 않습니다.

갱신 시 공식 출처를 다시 확인해 기간·조건·참여지역·reviewBy를 함께 수정하고 배포해야 합니다. 현재 등록 데이터는 2026-11-06 확인 기준입니다.

## 확인한 공식 출처

- 설악 케이블카: https://www.sorakcablecar.co.kr/guide
- 디지털 관광주민증: https://korean.visitkorea.or.kr/dgtourcard/
- 전국 할인: https://korean.visitkorea.or.kr/travelmonth/benefit.do
- 강원: https://korean.visitkorea.or.kr/travelmonth/local/gangwon.do
- 수도권: https://korean.visitkorea.or.kr/travelmonth/local/seoul-area.do
- 충청: https://korean.visitkorea.or.kr/travelmonth/local/chungcheong.do
- 경상: https://korean.visitkorea.or.kr/travelmonth/local/gyeongsang.do
- 전라: https://korean.visitkorea.or.kr/travelmonth/local/jeolla.do
- 제주: https://korean.visitkorea.or.kr/travelmonth/local/jeju.do
- 경기투어패스: https://www.ggtourpass.kr/
- 전북투어패스: https://www.jbtourpass.kr/
- 경북투어패스: https://www.gbtourpass.kr/
- 제주투어패스: https://www.tamnao.com/web/sp/detailPrdt.do?prdtNum=SP00002076
- 비짓부산패스 자격: https://visitbusanpass.com/pass/
- 서울관광재단 패스 안내: https://sto.or.kr/tourism01/view?stBusinessSeq=144
- 디지털서비스 개방 절차: https://openservice.go.kr/serviceProc
