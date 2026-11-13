from pathlib import Path
import fitz
from fontTools import subset
root=Path(__file__).resolve().parents[1];src=root/'artifacts/ir/final-polished/보폭_IR_최종_v2.pdf';p=fitz.open(src)
def write(page,x,y,text,size=16,bold=False,color=(.106,.263,.329)):
 name='HalfBold' if bold else 'HalfRegular';path='/tmp/bopok-'+('Bold' if bold else 'Regular')+'.otf';page.insert_font(fontname=name,fontfile=path);page.insert_text((x,y),text,fontname=name,fontsize=size,color=color)
def erase(page,rect):page.add_redact_annot(fitz.Rect(rect),fill=False)
# Product slide: keep photographs; introduce the policy connection underneath.
s=p[6];erase(s,(43,60,920,104));erase(s,(48,448,920,474));s.apply_redactions(images=0,graphics=0)
write(s,44,89,'코스·숙소 비교에 반값여행 혜택을 연결합니다',27,True)
write(s,50,462,'이동 시간·취향 비교 · 반값여행 대상 지역 코스',14)
write(s,501,462,'숙소 사진·날짜·예약 검색 · 지원 조건 확인',14)
write(s,50,491,'반값여행은 지자체별 공고의 대상 지역·신청 기간·지원 조건을 확인해 준비합니다.',11,color=(.322,.42,.478))
# Differentiation: no unverified competitor feature claims; only our closing statement changes.
s=p[8];erase(s,(48,460,920,490));s.apply_redactions(images=0,graphics=0)
write(s,50,480,'이동 조건을 지키는 일정부터 반값여행 대상 코스와 신청 준비까지 연결합니다.',17,True)
# Demo: fit four steps in the existing right column, leaving the live link untouched.
s=p[9];erase(s,(540,187,924,410));s.apply_redactions(images=0,graphics=0)
steps=[('01  여행 조건 입력','동행자·기간·이동 조건을 말하거나 선택'),('02  코스·숙소 비교','여행 코스와 숙소·장소 정보를 함께 확인'),('03  반값여행 혜택 확인','대상 지역 코스 선택 · 공식 공고·신청 조건 확인'),('04  신청·정산 준비','일정 기반 초안 작성 · 영수증·방문사진 보관')]
for i,(title,desc) in enumerate(steps):
 y=207+i*60;write(s,543,y,title,19,True);write(s,543,y+25,desc,13)
write(s,49,495,'선택한 일정으로 신청용 여행계획과 정산 설명 초안 준비',10,color=(.322,.42,.478))
tmp=src.with_name('halftravel-temp.pdf');p.save(tmp,garbage=4,deflate=True);p.close();q=fitz.open(tmp);assert len(q)==16
assert any(l.get('uri')=='http://52.65.9.104:8000/lab/' for l in q[9].get_links())
for i in [6,8,9]:q[i].get_pixmap(matrix=fitz.Matrix(.8,.8)).save(f'/tmp/half-after-{i+1}.png')
for i in range(16):q[i].get_pixmap(matrix=fitz.Matrix(.3,.3))
q.close();tmp.replace(src)
print('16 pages rendered; website link preserved; 3 slides updated')
