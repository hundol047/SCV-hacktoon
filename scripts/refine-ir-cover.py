from pathlib import Path
from pptx import Presentation
from pptx.util import Pt,Inches
from pptx.dml.color import RGBColor
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_16장_최종.pptx');s=p.slides[0]
for index in [5,1]:
 a=s.shapes[index];s.shapes._spTree.remove(a._element)
for a in s.shapes:
 if not a.has_text_frame:continue
 if 'INVESTMENT STORY' in a.text:a.text_frame.paragraphs[0].runs[0].text='보폭  /  IR DECK'
 elif a.text.startswith('어르신과 아이'):
  a.text_frame.clear();a.top=Inches(2.55);a.height=Inches(1.5)
  for i,t in enumerate(['함께 걷는 속도로,','함께 떠나는 여행']):
   q=a.text_frame.paragraphs[0] if i==0 else a.text_frame.add_paragraph();q.text=t;q.font.name='Noto Sans CJK KR';q.font.size=Pt(32);q.font.bold=True;q.font.color.rgb=RGBColor.from_string("1B4354");q.space_after=Pt(8)
 elif a.text.startswith('AI가'):
  a.text_frame.clear();a.top=Inches(4.3);a.height=Inches(1.2)
  for i,t in enumerate(['어르신·아이와 함께하는','이동 부담이 적은 맞춤 여행']):
   q=a.text_frame.paragraphs[0] if i==0 else a.text_frame.add_paragraph();q.text=t;q.font.name='Noto Sans CJK KR';q.font.size=Pt(20);q.font.color.rgb=RGBColor.from_string("526B7A");q.space_after=Pt(6)
p.save(out/'보폭_IR_16장_표지정리.pptx')
