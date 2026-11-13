// Five travel areas follow MY-AI-LAB; all 18 Gangwon cities/counties remain selectable.
export const gangwonAreas: {label:string;districts:string[]}[] = [
 {label:'강릉·동해',districts:['강릉','동해','삼척','태백']},
 {label:'속초·양양',districts:['속초','양양','고성','인제']},
 {label:'춘천·철원',districts:['춘천','철원','화천','양구','홍천']},
 {label:'평창·정선',districts:['평창','정선','영월']},
 {label:'원주',districts:['원주','횡성']},
];
export const gangwonDistricts=gangwonAreas.flatMap(area=>area.districts);
