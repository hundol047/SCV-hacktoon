// Official sources reviewed 2026-11-06. This is a curated directory, not a live coupon API.
export const benefitsReviewedAt='2026-11-06';
export type Benefit={id:string;title:string;regions:string[];cities?:string[];venues?:string[];kind:'discount'|'pass'|'resident'|'directory';summary:string;conditions:string;url:string;provider:string;from?:string;until?:string;reviewBy?:string;audience?:'resident'|'foreign';};
const month='https://korean.visitkorea.or.kr/travelmonth/local/';
export const benefitAreas=[
 {id:'seoul-area',name:'수도권',regions:['서울','인천','경기'],url:month+'seoul-area.do'},
 {id:'gangwon',name:'강원권',regions:['강원'],url:month+'gangwon.do'},
 {id:'chungcheong',name:'충청권',regions:['대전','세종','충북','충남'],url:month+'chungcheong.do'},
 {id:'gyeongsang',name:'경상권',regions:['부산','대구','울산','경북','경남'],url:month+'gyeongsang.do'},
 {id:'jeolla',name:'전라권',regions:['광주','전북','전남'],url:month+'jeolla.do'},
 {id:'jeju',name:'제주권',regions:['제주'],url:month+'jeju.do'},
];
export const residentAreas:Record<string,string[]>={
 강원:['철원','양양','정선','삼척','태백','홍천','평창','영월'],경기:['연천','가평'],인천:['강화'],충남:['태안','예산','보령'],충북:['제천','단양','괴산','옥천','영동','보은'],전북:['김제','무주','고창','임실','남원','순창'],전남:['영광','함평','곡성','신안','해남','장흥','구례','담양','고흥','완도'],경북:['영주','안동','영덕','청도','고령','의성','울진'],부산:['동구','영도','서구'],경남:['밀양','하동','합천','거창','함양','산청']
};
const gw=month+'gangwon.do';
const seasonal=(id:string,title:string,city:string,summary:string,conditions:string):Benefit=>({id,title,regions:['강원'],cities:[city],venues:[title],kind:'discount',summary,conditions,url:gw,provider:'한국관광공사 여행가는 달',from:'2026-11-01',until:'2026-11-30',reviewBy:'2026-12-06'});
export const travelBenefits:Benefit[]=[
 {id:'seorak-resident',title:'설악 케이블카 시민 할인',regions:['강원'],cities:['속초'],venues:['설악케이블카','설악산케이블카'],kind:'discount',summary:'속초시민 정상요금 50% 할인',conditions:'속초 거주 신분증 지참 · 국내인 본인 1인 1매 · 중복 할인 불가 · 당일 현장 구매',url:'https://www.sorakcablecar.co.kr/guide',provider:'설악 케이블카',audience:'resident',reviewBy:'2026-12-06'},
 seasonal('sokcho-yoga','여로요가','속초','2인 동반 상품 할인','네이버 지정 상품 예약 후 캠페인 화면을 현장에서 제시'),
 seasonal('jeongdongjin-rail','정동진레일바이크','강릉','현장 발권 10% 할인','11월 현장 구매 대상 · 온라인 예약 적용 여부는 제공처에서 확인'),
 seasonal('jeongseon-rail','정선레일바이크','정선','현장 발권 10% 할인','레일바이크 1대 기준 · 현장 구매 대상'),
 seasonal('taebaek-safe','365세이프타운','태백','사진 인증 시 케이블카 혜택','사진 게시와 지정 해시태그 조건 충족 후 현장 확인'),
 seasonal('donghae-sky','도째비골 스카이밸리','동해','입장료 50% 할인','행사 기간 방문객 대상 · 시설별 추가 체험료는 별도 확인'),
 seasonal('donghae-mureung','무릉별유천지','동해','입장료 20% 할인','입장 할인 · 개별 체험과 중복 적용 여부는 제공처 확인'),
 {id:'gyeonggi-pass',title:'경기투어패스',regions:['경기'],kind:'pass',summary:'관광·체험·카페 통합 이용권',conditions:'유료 패스 · 상품별 사용 시간과 가맹점 확인 후 구매',url:'https://www.ggtourpass.kr/',provider:'경기투어패스'},
 {id:'bayvalley-pass',title:'베이밸리투어패스',regions:['경기','충남'],kind:'pass',summary:'경기·충남 지정 시설 패키지',conditions:'유료 상품 · 방문할 시설이 포함된 상품을 선택',url:'https://www.ggtourpass.kr/',provider:'경기투어패스'},
 {id:'jeonbuk-pass',title:'전북투어패스',regions:['전북'],kind:'pass',summary:'제휴 관광지와 가맹점 혜택',conditions:'유료 패스 · 권종별 시설·사용 시간·추가요금 확인',url:'https://www.jbtourpass.kr/',provider:'전북투어패스'},
 {id:'gyeongbuk-pass',title:'경북투어패스',regions:['경북'],kind:'pass',summary:'지역별 관광시설 패키지 확인',conditions:'유료 패스 · 판매 상품과 포함 시설은 선택한 권종 기준',url:'https://www.gbtourpass.kr/',provider:'경북투어패스'},
 {id:'jeju-tamnao',title:'제주 탐나오',regions:['제주'],kind:'directory',summary:'관광지·숙소·렌터카 할인 상품',conditions:'상품별 여행 날짜·쿠폰 조건·재고를 확인',url:'https://www.tamnao.com/',provider:'제주 여행 플랫폼 탐나오'},
 {id:'jeju-pass',title:'제주투어패스',regions:['제주'],kind:'pass',summary:'제휴 관광지·체험 이용권',conditions:'유료 패스 · 개별 여행객 대상 · 다른 할인과 중복 불가',url:'https://www.tamnao.com/web/sp/detailPrdt.do?prdtNum=SP00002076',provider:'탐나오'},
 {id:'busan-foreign',title:'비짓부산패스',regions:['부산'],kind:'pass',summary:'외국인 관광객 전용 패스',conditions:'외국인 전용 · 한국인은 구매·사용 불가 · 유료 패스',url:'https://visitbusanpass.com/pass/',provider:'비짓부산패스',audience:'foreign'},
 {id:'seoul-foreign',title:'디스커버서울패스',regions:['서울'],kind:'pass',summary:'외국인 관광객 전용 패스',conditions:'외국인 전용 · 유료 패스 · 권종별 제휴시설 확인',url:'https://www.discoverseoulpass.com/',provider:'디스커버서울패스',audience:'foreign'},
 ...benefitAreas.map(a=>({id:'month-'+a.id,title:a.name+' 공식 여행 혜택',regions:a.regions,kind:'directory' as const,summary:'지역 할인·쿠폰·지원 사업 모아보기',conditions:'공식 페이지에서 개별 행사 날짜와 신청 조건 확인',url:a.url,provider:'한국관광공사 여행가는 달'})),
 ...Object.entries(residentAreas).map(([region,cities])=>({id:'resident-'+region,title:'디지털 관광주민증 · '+region,regions:[region],cities,kind:'resident' as const,summary:'참여 지역의 식음료·숙박·체험 혜택',conditions:'참여지역: '+cities.join(' · ')+'. 공식 사이트에서 본인인증·지역 발급 후 가맹점별 QR/쿠폰 조건 확인. 거주 지역 제한 확인.',url:'https://korean.visitkorea.or.kr/dgtourcard/',provider:'한국관광공사',reviewBy:'2026-12-06'})),
];
