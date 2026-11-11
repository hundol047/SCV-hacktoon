from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR, MSO_AUTO_SIZE
from PIL import ImageFont
from pathlib import Path
R=Path(__file__).resolve().parents[1]; out=R/'artifacts/ir'; out.mkdir(parents=True,exist_ok=True)
p=Presentation();p.slide_width=Inches(13.333);p.slide_height=Inches(7.5)
INK='193D50';TEAL='146B99';BG='F7FBFE';MUTED='526B7A';GOLD='FFBE55';WHITE='FFFFFF'
def rect(s,x,y,w,h,color,r=False):
 a=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if r else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h));a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string(color);a.line.fill.background();return a
FONT_PATH='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FIT_REPORT=[]
def wrapped_lines(value,size,width):
 font=ImageFont.truetype(FONT_PATH,round(size*4))
 lines=1;current=''
 for ch in value:
  if current and font.getlength(current+ch)/4>width:
   lines+=1;current=ch
  else:current+=ch
 return lines

def text(s,x,y,w,h,t,size=22,color=INK,bold=False):
 # Measure against the actual Korean font, reserving room for Office font substitution.
 requested=size
 width=w*72-10;height=h*72-4
 def needed(fs):
  return sum((wrapped_lines(line,fs,width)*fs*1.2+2) if line else fs*.55 for line in t.split('\n'))
 while needed(size)>height and size>8:size-=.5
 FIT_REPORT.append({'slide':len(p.slides),'text':t[:50],'requested':requested,'size':size,'needed':needed(size),'height':height})
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.word_wrap=True
 f.margin_left=f.margin_right=Pt(4);f.margin_top=f.margin_bottom=Pt(1)
 f.vertical_anchor=MSO_ANCHOR.TOP;f.auto_size=MSO_AUTO_SIZE.NONE
 for i,line in enumerate(t.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size if line else size*.5);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color)
  q.space_before=Pt(0);q.space_after=Pt(2 if line else 0);q.line_spacing=1.12
 return a
def centerText(*args,**kwargs):
 a=text(*args,**kwargs)
 for q in a.text_frame.paragraphs:q.alignment=PP_ALIGN.CENTER
 return a
def slide(k,title,sub=''):
 s=p.slides.add_slide(p.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor.from_string(BG);text(s,.55,.28,12,.3,'보폭  /  '+k,11,TEAL,True);text(s,.55,.9,12,1,title,28,INK,True)
 if sub:text(s,.58,1.75,12,.6,sub,16,MUTED)
 rect(s,.6,7.05,12.1,.015,'CFDAD5');text(s,.6,7.13,11,.28,'MENTOR IR  ·  2026.11  ·  어르신과 아이, 서로의 보폭에 맞추는 여행',9,MUTED);text(s,12,7.12,.6,.3,f'{len(p.slides):02}',10,TEAL)
 return s
def cards(s,items,y=2.55):
 w=12.1/len(items)-.18
 for i,(head,body) in enumerate(items):
  x=.6+i*(w+.18);rect(s,x,y,w,3.7,WHITE,True);text(s,x+.22,y+.25,w-.44,.8,head,22,TEAL,True);text(s,x+.22,y+1.15,w-.44,2.4,body,18)
def note(s,t):text(s,.65,6.55,12,.4,t,11,MUTED)
def pic(s,name,x,y,w,h):
 from PIL import Image
 im=Image.open(out/name); iw,ih=im.size;scale=min(w/iw,h/ih);s.shapes.add_picture(str(out/name),Inches(x+(w-iw*scale)/2),Inches(y),width=Inches(iw*scale),height=Inches(ih*scale))
s=slide('INVESTMENT STORY','함께 떠날 수 있도록, 여행의 부담을 줄이다')
text(s,.65,2.35,6.5,1.4,'어르신과 아이의 보폭에 맞춰\n함께 떠나는 편안한 여행',31,TEAL,True);text(s,.65,4.05,6.1,1.3,'AI가 여행 의도를 이해하고, 일정 엔진이\n장소·시간·동선을 연결합니다.',23);text(s,.65,5.8,6,.5,'보폭 · 어르신·거동이 불편한 분을 위한 이동 조건 기반 추천',15,MUTED);pic(s,'home.png',7.1,2.15,5.5,4.55)
s=slide('PROBLEM','여행을 포기하게 만드는 것은 검색보다 조율입니다','핵심 고객 문제 가설 — 사용자 인터뷰로 우선 검증')
cards(s,[('이동 부담','많은 장소보다 적절한 보행량과\n휴식 간격이 중요합니다.\n\n동행자의 체력을 일정에\n반영하기 어렵습니다.'),('정보의 분산','장소·운영시간·숙소·교통을\n여러 서비스에서 확인합니다.\n\n계획이 바뀌면 다시\n맞춰야 합니다.'),('가족의 합의','여행을 준비하는 사람과\n함께 가는 사람의 조건이 다릅니다.\n\n보행 능력과 필수 시설 조건을\n한 일정에 모아야 합니다.')])
s=slide('STP · SEGMENTATION','어르신·이동약자의 이동 조건과 동행 상황으로 나눕니다')
cards(s,[('어르신 여행','어르신과 이동이 불편한 여행자\n함께 계획하는 가족·보호자\n\n중요 조건: 걷기·휴식·식사·숙소'),('이동 편의','휠체어·유모차 등 이동 편의\n정보가 필요한 동행자\n\n중요 조건: 진입·시설·정보 근거'),('아이 동반','아이와 강원 여행을 준비하는 가족\n\n중요 조건: 아이 동반 장소\n긴 보행 제외 · 유모차 진입')])
s=slide('STP · TARGETING & POSITIONING','어르신·이동약자를 먼저, 아이 동반 가족으로 확장')
rect(s,.6,2.5,7.8,3.65,TEAL,True);text(s,.95,2.85,7.1,2.5,'“나의 이동 조건으로 함께할 수 있는\n강원 여행을 짜고 싶다.”\n\n조건을 말하면 비교하고 고를 수 있는\n일정으로 정리하는 여행 도우미',26,WHITE,True);text(s,8.8,2.7,3.8,3.5,'초기 타깃\n수도권 출발 · 어르신·이동약자\n강원 1~2박 · 소규모 자유여행\n\n포지셔닝\n보행·접근성 조건을 지키는\n동행 여행 계획 서비스',20)
s=slide('PRODUCT · HOME','동행자의 보폭에서 시작하는 여행')
pic(s,'home.png',.6,2.0,8.1,4.85)
text(s,9.05,2.65,3.5,.6,'간결한 시작',23,TEAL,True)
text(s,9.05,3.45,3.5,2.8,'어르신·아이·휠체어\n동행 유형 선택\n\n음성 또는 글로 조건 입력\n\n직접 선택해 일정 만들기',20)
s=slide('PRODUCT · ACTUAL SCREEN','말하거나 고르면, 여행 조건을 일정으로 연결합니다')
pic(s,'mobility-form.png',.6,2.1,5.3,4.7);text(s,6.35,2.65,6,3.6,'01  어르신·아이·휠체어 시작 유형\n02  보행·휠체어·유모차·화장실 선택\n03  조건이 확인된 장소로 일정 구성\n04  필수 조건을 유지하며 일정 변경',24,INK,True)
s=slide('PRODUCT · ACTUAL SCREEN','코스와 숙소를 같은 여행 흐름에서 비교합니다')
pic(s,'result.png',.6,2.05,8,4.3);text(s,9,2.55,3.65,3.7,'추천 / 여유롭게 / 색다른 코스\n\n권역 내 숙소와 예약 검색\n\n예상 비용은 범위로 표시\n\n날짜별 일정과 가족 의견',19);note(s,'선택한 날짜와 이동 조건으로 생성한 일정 · 숙소별 예약 검색으로 연결')
s=slide('PRODUCT · PLACE DETAIL','일정 안에서 장소 소개와 다음 행동을 함께 확인합니다')
pic(s,'place-detail.png',.6,2.1,7.5,4.7)
text(s,8.55,2.65,4.1,.6,'방문 전에 이해하고 선택',23,TEAL,True)
text(s,8.55,3.5,4.1,2.8,'장소 소개를 바로 확인\n\n보행·시설 정보를 함께 확인\n\n길찾기와 장소 바꾸기\n\n후기·의견은 필요할 때 펼치기',19)
s=slide('DIFFERENTIATION','차별성은 이동 조건을 지키며 일정을 다시 맞추는 데 있습니다')
cards(s,[('검색 → 실행 일정','짧게 걷기·휠체어 진입·화장실\n필수 조건으로 장소를 선별\n\n휠체어 대여와 진입 정보를 구분'),('대화 → 조건 변경','AI가 필요한 이동 조건을 해석\n\n코스를 바꿔도 필수 조건 유지\n관광 뒤 20분의 여유 시간 확보'),('개인 → 가족 결정','확인된 시설 원문을 함께 표시\n\n좌석·실제 경사·숙소 객실은\n현장 확인으로 정보 보완')]);note(s,'경쟁 범주: 지도·검색 / 예약 플랫폼 / 범용 AI. 특정 경쟁 서비스의 기능 부재를 주장하지 않습니다.')
s=slide('MARKET · TAM / SAM / SOM','시장 규모와 우리가 확보할 규모를 분리합니다','금액 기준: 연간 여행 소비액. 플랫폼 매출과 구분합니다.')
# Nested market hierarchy. Circle areas are illustrative, not proportional to spending.
for x,y,d,c in [(.95,2.35,4.15,'DAEDF8'),(1.625,3.48,2.8,'8CCAD9'),(2.2,4.57,1.65,'146B99')]:
 a=s.shapes.add_shape(MSO_SHAPE.OVAL,Inches(x),Inches(y),Inches(d),Inches(d))
 a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string(c);a.line.color.rgb=RGBColor.from_string(WHITE);a.line.width=Pt(2)
centerText(s,1.625,2.69,2.8,.42,'TAM',25,INK,True)
centerText(s,1.625,3.11,2.8,.38,'국내 전체 여행 시장',16,INK)
centerText(s,1.925,3.84,2.2,.42,'SAM',24,INK,True)
centerText(s,1.825,4.26,2.4,.35,'강원 핵심 고객 시장',14,INK)
centerText(s,2.275,4.96,1.5,.4,'SOM',22,WHITE,True)
centerText(s,2.25,5.4,1.55,.55,'초기 확보 목표',13,WHITE)
for y,tag,value,body in [(2.3,'TAM','39.5조 원','2025년 국내여행 총지출 · 공식 통계 [1]'),(3.7,'SAM','5,858억 원','강원 여행 소비 5.858조 원 × 핵심 고객 10% 가정 [2]'),(5.1,'SOM','10억 원','초기 12개월 2,000팀 × 팀당 여행 소비 50만 원 목표')]:
 rect(s,6.05,y,6.55,1.15,WHITE,True)
 text(s,6.3,y+.15,1.05,.4,tag,18,TEAL,True)
 text(s,7.45,y+.1,4.85,.48,value,26,INK,True)
 text(s,6.3,y+.66,6.05,.37,body,14,MUTED)
note(s,'시장 포함 관계를 표현한 개념도이며 원 면적은 금액 비례가 아닙니다. SAM·SOM은 사업 가정과 목표로, 플랫폼 매출이 아닙니다.')
s=slide('MARKET · ASSUMPTIONS','SAM은 고객 비중, SOM은 실제 전환율로 검증합니다')
cards(s,[('보수적 · 5%','SAM 2,929억 원\n\n강원 소비액의 5%가\n핵심 여행 조건에 해당한다고 가정'),('기준 · 10%','SAM 5,858억 원\n\n어르신 여행·이동 부담 수요를\n인터뷰와 사용 데이터로 검증'),('확장 · 15%','SAM 8,787억 원\n\n아이·유모차 동반 가족 등\n인접 고객군으로 확대')]);note(s,'세 수치는 독립적인 공식 통계가 아닌 민감도 분석입니다. 대상 고객 조사 후 핵심 고객 비중을 갱신합니다.')
s=slide('BUSINESS MODEL','여행 계획의 가치를 먼저 검증하고 수익을 연결합니다')
cards(s,[('초기 · 무료 사용','이동 조건 기반 일정·비교·공유\n\n완성된 일정 비율과\n여행 실행 여부를 측정'),('제휴 · 접근성 정보','시설 정보를 함께 확인한\n숙소·체험 제휴가 성립하면\n예약 전환에 따른 수수료\n\n정산 가능한 거래부터 적용'),('확장 · 지역 파트너','숙소·관광 사업자·복지기관 협업\n지역 맞춤 코스와 정보 관리\n\n유료 파일럿으로 지불 의사 검증')]);note(s,'수익 시나리오: 계획지원 소비 10억 × 제휴 거래 전환 30% × 수수료 5% = 연 1,500만 원. 계약·실적이 아닌 가정입니다.')
s=slide('GO TO MARKET','강릉·속초에서 반복 사용을 만들고 권역을 넓힙니다')
cards(s,[('1단계 · 검증','어르신·이동약자 30팀 인터뷰\n실제 여행 10팀 동행·피드백\n\n준비 시간·이동 부담·\n일정 수정 이유를 수집'),('2단계 · 유입','복지관·보호자 커뮤니티 콘텐츠\n지역 숙소와 시범 제휴\n\n유입 → 일정 완성 → 공유\n→ 실제 여행 전환을 추적'),('3단계 · 확장','검증된 코스와 시설 정보 축적\n춘천·평창·원주 권역 확대\n\n지역 운영자 참여로\n정보 갱신 주기 단축')]);note(s,'상기 고객 수와 활동은 향후 실행 목표입니다.')
s=slide('TECHNOLOGY','기존 AWS AI와 원본 앱의 일정 엔진을 연결했습니다')
cards(s,[('사용자 화면','보폭 전용 UI·추천 조건\n\n음성·텍스트 / 일정 / 지도\n숙소 검색 / 투표 / 저장'),('AI 해석','기존 AWS Bedrock 유지\n기존 모델·EC2 역할 인증 유지\n\n자연어 → 검증 가능한\n조건과 장소 ID'),('일정·데이터','이동 조건에 맞춰 일정 배치\n운영시간·휴무·동선 재검사\n\n필수 시설 조건을 유지하며\n코스 변경과 재배치')]);note(s,'빌드·브라우저·브리지 검사 완료. 실제 AWS 모델 응답과 서버 배포 확인은 운영 환경에서 수행해야 합니다.')
s=slide('ROADMAP & KPI','성공 기준은 생성된 일정 수보다 실제 여행 완주입니다')
cards(s,[('0~1개월','어르신·이동약자 30팀 인터뷰\n10팀 실사용\n\n핵심 지표\n조건 준수율 · 준비 시간\n시설 정보 확인 가능 비율'),('2~3개월','지역 제휴 파일럿\n\n핵심 지표\n접근성 정보 일치율\n방문 완료율 · 이동 부담 만족도'),('4~12개월','연간 2,000팀 목표 검증\n\n핵심 지표\n재사용률 · 고객 획득 비용\n제휴 거래액 · 기여이익')]);note(s,'목표와 검증 계획이며 확보 고객 수 또는 매출 실적이 아닙니다.')
s=slide('TEAM & MENTOR DISCUSSION','제품 실행력과 지역 검증을 함께 쌓겠습니다')
for i,(a,b) in enumerate([('백승훈','개발 · AI 연동 · 배포'),('장현희','서비스 기획 · UX · 사용자 조사'),('이종원','발표 · IR 스토리 · 대외 설명'),('조재민','시장 조사 · 지역 파트너 · 품질 검증')]):
 y=2.3+i*.8;text(s,.65,y,2.1,.5,a,23,TEAL,True);text(s,2.8,y,8.5,.5,b,21)
text(s,.65,5.85,12,.8,'멘토 논의: 초기 고객 범위 · 지역 제휴 우선순위 · 검증 지표와 수익화 시점',19,INK,True)
s=slide('SOURCES & METHODOLOGY','출처와 계산 기준')
refs=[('1  TAM · 국내여행 지출 39.5조 원','문화체육관광부, 2025년 국민여행조사 결과 발표, 2026.6.30','https://www.mcst.go.kr/site/s_notice/press/pressView.jsp?pSeq=22557'),('2  강원 지출 5.858조 원','경북일보, 2025 국민여행조사 인용, 2026.7.5 (2차 출처)','https://v.daum.net/v/20260705165659435'),('3  제품·화면','보폭 최신 코드(64fd652)를 직접 실행해 캡처 · 운영 서버 촬영과 구분','https://github.com/hundol047/SCV-hacktoon/tree/64fd652')]
for i,(a,b,u) in enumerate(refs):
 y=2.2+i*1.1;text(s,.65,y,12,.35,a,18,TEAL,True);text(s,.65,y+.4,12,.35,b,14);t=text(s,.65,y+.74,12,.24,u,10,MUTED);t.text_frame.paragraphs[0].runs[0].hyperlink.address=u
text(s,.65,5.7,12,.8,'SAM = 5.858조 × 10%. SOM = 2,000팀 × 50만 원.\n고객 비중·팀 수·객단가·전환율·수수료는 검증 전 가정. 자료 확인일: 2026.11.11.',15)
# Remove theme-inherited shadows; keep cards, rules and circles clean.
from pptx.oxml.xmlchemy import OxmlElement
for page in p.slides:
 for shape in page.shapes:
  spPr=getattr(shape._element,'spPr',None)
  if spPr is not None:
   spPr.append(OxmlElement('a:effectLst'))
  for effect in shape._element.xpath('.//a:effectRef'):effect.set('idx','0')
  if shape.shape_type==1 and shape.auto_shape_type==MSO_SHAPE.ROUNDED_RECTANGLE:shape.adjustments[0]=.08
assert all(item['needed']<=item['height'] for item in FIT_REPORT), 'Text exceeds its frame'
p.save(out/'보폭_IR_실제화면_중첩시장.pptx')
import json
(out/'typography-check.json').write_text(json.dumps(FIT_REPORT,ensure_ascii=False,indent=2))
# Basic artifact integrity: all shapes fit inside the slide.
for i,s in enumerate(p.slides):
 for a in s.shapes:
  assert a.left>=0 and a.top>=0 and a.left+a.width<=p.slide_width+100 and a.top+a.height<=p.slide_height+100,(i,a.name)
print('Created',len(p.slides),'slides')
