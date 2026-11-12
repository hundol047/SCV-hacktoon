from pathlib import Path
import fitz,re
from fontTools.ttLib import TTCollection
root=Path(__file__).resolve().parents[1]
src=Path('/workspace/attachments/6c29b187-9d9f-43f3-bb81-fba37a6c8752/보폭_IR_최종_v2.pdf')
out=root/'artifacts/ir/final-polished/보폭_IR_최종_v2.pdf'
for style in ['Regular','Bold']:
 c=TTCollection('/usr/share/fonts/opentype/noto/NotoSansCJK-'+style+'.ttc');c.fonts[1].save('/tmp/bopok-'+style+'.otf')
font=fitz.Font(fontfile='/tmp/bopok-Regular.otf')
p=fitz.open(src); originals=[s.get_text() for s in p];links=[s.get_links() for s in p]
texts={
1:['많은 장소보다 적절한 보행량과\n휴식 간격이 중요합니다.\n\n동행자의 체력을 일정에\n반영하기 어렵습니다.','장소·운영시간·숙소·교통을\n여러 서비스에서 확인합니다.\n\n계획이 바뀌면 다시\n맞춰야 합니다.','여행을 준비하는 사람과\n함께 가는 사람의 조건이 다릅니다.\n\n보행 능력과 필수 시설 조건을\n한 일정에 모아야 합니다.'],
2:['어르신과 이동이 불편한 여행자\n함께 계획하는 가족·보호자\n\n중요 조건: 걷기·휴식·식사·숙소','휠체어·유모차 등 이동 편의\n정보가 필요한 동행자\n\n중요 조건: 진입·시설·정보 근거','아이와 강원 여행을 준비하는 가족\n\n중요 조건: 아이 동반 장소\n긴 보행 제외 · 유모차 진입'],
11:['이동 조건 기반 일정·비교·공유\n\n완성된 일정 비율과\n여행 실행 여부를 측정','시설 정보를 함께 확인한\n숙소·체험 제휴가 성립하면\n예약 전환에 따른 수수료\n\n정산 가능한 거래부터 적용','숙소·관광 사업자·복지기관 협업\n지역 맞춤 코스와 정보 관리\n\n유료 파일럿으로 지불 의사 검증'],
12:['어르신·이동약자 30팀 인터뷰\n실제 여행 10팀 동행·피드백\n\n준비 시간·이동 부담·\n일정 수정 이유를 수집','복지관·보호자 커뮤니티 콘텐츠\n지역 숙소와 시범 제휴\n\n유입 → 일정 완성 → 공유\n→ 실제 여행 전환을 추적','검증된 코스와 시설 정보 축적\n춘천·평창·원주 권역 확대\n\n지역 운영자 참여로\n정보 갱신 주기 단축'],
13:['보폭 전용 UI·추천 조건\n\n음성·텍스트 / 일정 / 지도\n숙소 검색 / 투표 / 저장','기존 AWS Bedrock 유지\n기존 모델·EC2 역할 인증 유지\n\n자연어 → 검증 가능한\n조건과 장소 ID','이동 조건에 맞춰 일정 배치\n운영시간·휴무·동선 재검사\n\n필수 시설 조건을 유지하며\n코스 변경과 재배치']}
color=(.106,.263,.329)
def erase(page,rect):
 page.add_redact_annot(rect,fill=False)
def write(page,x,y,width,text,size=16):
 page.insert_font(fontname='BopokRegular',fontfile='/tmp/bopok-Regular.otf')
 yy=y
 for line in text.split('\n'):
  if not line:yy+=12;continue
  words=line.split(' ');wrapped=[];current=''
  for word in words:
   trial=(current+' '+word).strip()
   if current and font.text_length(trial,fontsize=size)>width:wrapped.append(current);current=word
   else:current=trial
  if current:wrapped.append(current)
  for value in wrapped:
   assert font.text_length(value,fontsize=size)<=width
   page.insert_text((x,yy),value,fontsize=size,fontname='BopokRegular',color=color);yy+=25 if size>=16 else 21
 return yy
for i,cols in texts.items():
 page=p[i]
 for b in page.get_text('blocks'):
  if b[1]>250 and b[3]<450:erase(page,fitz.Rect(b[:4]))
 page.apply_redactions(images=0,graphics=0)
 for x,t in zip([63,353.5,643.9],cols):assert write(page,x,280,238,t,16)<=445
# Match four team members' biography start, font size, and leading, preserving photos.
team=['의료AI코딩대회 수상\n모두의 창업 1,2기\n강원 AI&반도체 포럼\n아이디어 경진대회 수상\n강원특별자치도·송호대학교\n창업경진대회 수상','강원특별자치도\n창업경진대회 수상\n모두의 창업 2기\n사용자 흐름 설계\n사용자 조사\n화면 기획','의료AI코딩대회 수상\n전국 모의 투자대회 입상\nLG AIMERS 12기 수료\n대한의공학회 학술지 투고','2024 연세의료AI\n개발경진대회 대상\n2025 연세FPGA\n개발경진대회 대상\nEMBC 국제학술대회 투고']
page=p[14]
for b in page.get_text('blocks'):
 if 345<b[1] and b[3]<490:erase(page,fitz.Rect(b[:4]))
page.apply_redactions(images=0,graphics=0)
for x,t in zip([59.6,281.4,503.2,725],team):assert write(page,x,362,178,t,12.5)<=490
p.save(out,garbage=4,deflate=True)
q=fitz.open(out)
# Check every original non-whitespace character remains, regardless of new line order.
from collections import Counter
for i in range(len(q)):
 a=Counter(re.sub(r'\s+','',originals[i]));b=Counter(re.sub(r'\s+','',q[i].get_text()));assert a==b,(i+1,a-b,b-a)
 assert sorted(l.get('uri','') for l in links[i])==sorted(l.get('uri','') for l in q[i].get_links()),i
for i in [1,2,11,12,13,14]:q[i].get_pixmap(matrix=fitz.Matrix(.85,.85)).save(f'/tmp/polished-{i+1}.png')
print('Verified 16 pages, full text preservation, all hyperlinks preserved:',out)
