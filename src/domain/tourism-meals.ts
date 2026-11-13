import type {Place} from '../data/demo';
// General-purpose chains are not a destination dining recommendation.
const everydayChain=/고봉민|김밥천국|김밥나라|김가네|싸다김밥|이삭토스트|신전떡볶이|엽기떡볶이|명랑핫도그|죠스떡볶이|배스킨라빈스|던킨|노브랜드버거|프랭크버거|샐러디|한솥|본죽|본도시락|홍콩반점|역전우동|맥도날드|롯데리아|버거킹|맘스터치|써브웨이|서브웨이|KFC|스타벅스|이디야|메가커피|컴포즈커피|빽다방|파리바게뜨|뚜레쥬르|도미노|피자헛|교촌|BBQ|BHC/i;
const regionalFood=/초당|순두부|막국수|메밀|감자옹심이|옹심이|황태|곤드레|산채|물회|대게|홍게|오징어순대|아바이|장칼국수|섭국|꼬막|곰치|도루묵|회센터|횟집|향토|전통시장|지역음식/;
export function tourismMealScore(p:Place){
 if(p.kind!=='meal'||everydayChain.test(p.name.replace(/\s/g,'')))return -1;
 const local=regionalFood.test([p.name,...p.experiences,p.description].join(' '));
 const official=p.id.startsWith('tourapi:')||/한국관광공사|관광음식점/.test(p.description);
 return local?3:official?1:-1;
}
