from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
import sys
root=Path(__file__).resolve().parents[1];out=root/'artifacts/ir'
p=Presentation(sys.argv[1])
INK='193D50';BLUE='146B99';MUTED='526B7A'
def text(s,x,y,w,h,t,size=18,color=INK,bold=False,center=False):
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.word_wrap=True
 f.margin_left=f.margin_right=Pt(3);f.margin_top=f.margin_bottom=Pt(2)
 for i,line in enumerate(t.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color);q.line_spacing=1.12;q.space_after=Pt(5)
  if center:q.alignment=PP_ALIGN.CENTER
 return a
def box(s,x,y,w,h,c):
 a=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h));a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string(c);a.line.fill.background();a.adjustments[0]=.06;return a
def roundpic(a):
 geom=a._element.spPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom');geom.set('prst','roundRect')
 av=geom.find('{http://schemas.openxmlformats.org/drawingml/2006/main}avLst')
 for child in list(av):av.remove(child)
 gd=OxmlElement('a:gd');gd.set('name','adj');gd.set('fmla','val 4000');av.append(gd)
def place(a,x,y,w,h,crop=(0,0,0,0)):
 l,t,r,b=crop;iw,ih=a.image.size;ratio=iw*(1-l-r)/(ih*(1-t-b));ww=min(w,h*ratio);hh=ww/ratio
 a.left=Inches(x+(w-ww)/2);a.top=Inches(y+(h-hh)/2);a.width=Inches(ww);a.height=Inches(hh)
 a.crop_left=l;a.crop_top=t;a.crop_right=r;a.crop_bottom=b;roundpic(a)
# User screenshots have broad page gutters. Crop only those, retaining the actual UI.
for n,s in enumerate(p.slides,1):
 for a in s.shapes:
  if a.shape_type==13:
   if n==1:place(a,7.1,2.0,5.5,4.85,(.265,.07,.265,.02))
   elif n==5:place(a,.65,2.0,7.7,4.85,(.265,.07,.265,.02))
   elif n==7:place(a,.65,2.0,7.7,4.5,(.25,.06,.25,0))
   elif n==8:place(a,.8,2.35,5.3,3.65)
   else:place(a,a.left/914400,a.top/914400,a.width/914400,a.height/914400)
# Enlarge course and hotel details independently, using the same supplied screenshot.
s=p.slides[6]
original=next(a for a in s.shapes if a.shape_type==13)
from io import BytesIO
blob=original.image.blob
for a in list(s.shapes):
 if a.top>=Inches(1.9) and a.top<Inches(7):s.shapes._spTree.remove(a._element)
text(s,.65,2.15,5.8,.45,'01  세 가지 코스 비교',21,BLUE,True)
text(s,6.9,2.15,5.8,.45,'02  일정에 맞는 숙소',21,BLUE,True)
a=s.shapes.add_picture(BytesIO(blob),0,0)
place(a,.65,2.85,5.8,3.15,(.25,.075,.25,.525))
a=s.shapes.add_picture(BytesIO(blob),0,0)
place(a,6.9,2.85,5.8,3.15,(.25,.565,.25,.005))
text(s,.65,6.25,5.8,.5,'이동 시간과 취향을 비교하고 선택',16,MUTED)
text(s,6.9,6.25,5.8,.5,'숙소 사진 · 여행 날짜 · 예약 검색',16,MUTED)
# Low resolution original is presented at a smaller size, without inventing detail.
s=p.slides[7]
for a in s.shapes:
 if a.has_text_frame and a.text in ['방문 전에 이해하고 선택','장소 소개를 바로 확인\n\n보행·시설 정보를 함께 확인\n\n길찾기와 장소 바꾸기\n\n후기·의견은 필요할 때 펼치기']:
  a.left=Inches(6.7);a.width=Inches(5.8)
# Four equal, editable team cards, photo slots are deliberately empty.
s=p.slides[15]
for a in list(s.shapes):
 if a.top>=Inches(2) and a.top<Inches(7):s.shapes._spTree.remove(a._element)
for a in s.shapes:
 if a.has_text_frame and a.text=='제품 실행력과 지역 검증을 함께 쌓겠습니다':
  a.text_frame.paragraphs[0].runs[0].text='기획·개발·발표·검증을 연결하는 네 명의 팀'
people=[('백승훈','개발 · AI 연동','서비스 구현\n추천 기능·배포 관리'),('장현희','서비스 기획 · UX','사용자 흐름 설계\n사용자 조사·화면 기획'),('이종원','발표 · IR','발표 자료·스토리 구성\n멘토·외부 대상 설명'),('조재민','시장 조사 · 품질 검증','지역 정보·파트너 조사\n기능 테스트·개선 정리')]
for i,(name,role,body) in enumerate(people):
 x=.6+i*3.08;box(s,x,2.15,2.86,4.55,'FFFFFF')
 slot=box(s,x+.2,2.35,2.46,2.1,'E9F2F8');slot.name=f'{name} 사진 자리'
 # Minimal portrait placeholder, not a fictitious team photo.
 head=s.shapes.add_shape(MSO_SHAPE.OVAL,Inches(x+1.12),Inches(2.78),Inches(.62),Inches(.62));head.fill.solid();head.fill.fore_color.rgb=RGBColor.from_string('B7CBD8');head.line.fill.background()
 box(s,x+.88,3.42,1.1,.38,'B7CBD8')
 text(s,x+.3,3.95,2.26,.3,'사진 넣기',12,MUTED,center=True)
 text(s,x+.2,4.65,2.46,.45,name,23,BLUE,True,True)
 text(s,x+.2,5.2,2.46,.4,role,14,INK,True,True)
 text(s,x+.22,5.82,2.42,.7,body,14,MUTED,center=True)
for s in p.slides:
 for a in s.shapes:
  sp=getattr(a._element,'spPr',None)
  if sp is not None:sp.append(OxmlElement('a:effectLst'))
  for e in a._element.xpath('.//a:effectRef'):e.set('idx','0')
# Ask PowerPoint to retain the embedded screenshots without recompression.
p.part._element.set('autoCompressPictures','0')
for i,s in enumerate(p.slides):
 for a in s.shapes:assert a.left>=0 and a.top>=0 and a.left+a.width<=p.slide_width+100 and a.top+a.height<=p.slide_height+100,(i,a.name)
dest=out/'보폭_IR_화면개선_팀역량.pptx';p.save(dest);print(dest)
