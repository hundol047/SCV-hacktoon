from pathlib import Path
from pptx import Presentation
from pptx.util import Inches
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor
from pptx.oxml.xmlchemy import OxmlElement
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_16장_팀역량반영.pptx');s=p.slides[14]
for a in list(s.shapes):
 if (a.has_text_frame and a.text=='사진 넣기') or (abs(a.top-Inches(2.2))<100 and abs(a.height-Inches(1.15))<100):s.shapes._spTree.remove(a._element)
for a in s.shapes:
 if abs(a.top-Inches(3.55))<100:a.top=Inches(3.97)
 elif abs(a.top-Inches(4.12))<100:a.top=Inches(4.49)
 elif abs(a.top-Inches(4.73))<100:
  a.top=Inches(5.02);a.height=Inches(1.75)
for i,name in enumerate(['백승훈','장현희','이종원','조재민']):
 x=.6+i*3.08
 a=s.shapes.add_shape(MSO_SHAPE.RECTANGLE,Inches(x+(2.86-1.25)/2),Inches(2.18),Inches(1.25),Inches(1.61));a.name=name+' 사진';a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string('EAF2F5');a.line.fill.background()
 ph=OxmlElement('p:ph');ph.set('type','pic');ph.set('idx',str(40+i));a._element.nvSpPr.nvPr.append(ph)
 # Keep the editable picture frame flat, consistent with the bright deck.
 a._element.spPr.append(OxmlElement('a:effectLst'))
 for e in a._element.xpath('.//a:effectRef'):e.set('idx','0')
s.notes_slide.notes_text_frame.text='원래 밝은 배경과 백승훈·장현희·이종원·조재민 4명 구성을 유지했습니다. 사진 자리의 그림 삽입 아이콘으로 사진을 넣으세요. 각 자리 3.175 × 4.089cm, 원본 증명사진과 같은 약 0.776 세로 비율입니다. 얼굴이 잘리면 그림 서식 > 자르기 > 맞춤을 선택하세요.'
p.save(out/'보폭_IR_16장_팀원복원.pptx')
assert len(p.slides)==16
