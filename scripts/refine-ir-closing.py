from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.xmlchemy import OxmlElement
from PIL import Image
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_출처정리_QA.pptx');s=p.slides[-1]
for a in list(s.shapes):s.shapes._spTree.remove(a._element)
def text(x,y,w,h,t,size=18,color='193D50',bold=False):
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.word_wrap=True;f.margin_left=f.margin_right=Pt(2);f.margin_top=f.margin_bottom=Pt(1)
 for i,line in enumerate(t.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color);q.line_spacing=1.18
 return a
def photo(name,x,y,w,h):
 path=out/'target-photos'/name;iw,ih=Image.open(path).size
 a=s.shapes.add_picture(str(path),Inches(x),Inches(y),width=Inches(w),height=Inches(h))
 if iw/ih<w/h:a.crop_top=a.crop_bottom=(1-(iw/ih)/(w/h))/2
 else:a.crop_left=a.crop_right=(1-(w/h)/(iw/ih))/2
 g=a._element.spPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom');g.set('prst','roundRect');av=g.find('{http://schemas.openxmlformats.org/drawingml/2006/main}avLst');gd=OxmlElement('a:gd');gd.set('name','adj');gd.set('fmla','val 5000');av.append(gd)
text(.7,.45,6,.35,'보폭  /  함께 떠날 수 있는 여행',12,'146B99',True)
text(.7,1.35,6,1.25,'서로의 보폭에 맞춰,\n함께 떠나요',30,'193D50',True)
text(.7,3.0,5.9,1.45,'어르신·이동이 불편한 분과\n아이 동반 가족의 보행·휴식 조건을 반영해\n여행 일정과 숙소를 연결합니다.',19,'526B7A')
text(.7,4.75,6,.4,'동행자 맞춤  ·  보행·휴식 반영  ·  일정·숙소 비교',14,'146B99',True)
text(.7,5.75,5.5,.55,'Q&A',28,'146B99',True)
text(.7,6.4,5.6,.4,'궁금한 점을 편하게 말씀해 주세요.',15,'526B7A')
photo('senior.jpg',7.25,.95,5.35,2.35)
text(7.28,3.43,5.2,.35,'부모님과 쉬엄쉬엄 떠나는 여행',15,'193D50',True)
photo('family.jpg',7.25,4.0,5.35,2.35)
text(7.28,6.48,5.2,.35,'아이와 함께 즐기는 가족 여행',15,'193D50',True)
a=text(.7,7.12,11,.25,'사진: Traveling to Europe for Seniors  ·  Kindred 데모(Pexels 안내)',8,'526B7A')
q=a.text_frame.paragraphs[0];q.runs[0].hyperlink.address='https://github.com/LSIS5425-Fall2023/group-2/blob/main/_data/Traveleuropebanner.jpeg'
r=q.add_run();r.text='  [가족 사진 출처]';r.font.name='Noto Sans CJK KR';r.font.size=Pt(8);r.hyperlink.address='https://github.com/mkteagle/kindred/tree/main/apps/web/public/demo/photos'
text(12,7.12,.6,.3,'18',10,'146B99')
for a in s.shapes:
 sp=getattr(a._element,'spPr',None)
 if sp is not None:sp.append(OxmlElement('a:effectLst'))
 for e in a._element.xpath('.//a:effectRef'):e.set('idx','0')
p.save(out/'보폭_IR_QA이미지_최종.pptx')
