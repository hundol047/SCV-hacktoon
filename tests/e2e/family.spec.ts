import {test,expect} from '@playwright/test';
test('two independent browsers share parent feedback and enforce viewer permissions',async({page,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'예시 여행 체험하기',exact:true}).click();
 await page.getByRole('button',{name:'서버에 새 여행 저장',exact:true}).click();await expect(page.locator('section.cloud-panel').filter({has:page.getByRole('heading',{name:'서버 보관·가족 확인',exact:true})})).toContainText('서버에 저장했습니다.');
 await page.getByRole('button',{name:'부모님 확인 링크 만들기',exact:true}).click();const link=await page.getByLabel('가족에게 전달할 비공개 링크').inputValue();
 const second=await browser.newContext();try{const parent=await second.newPage();await parent.goto(link);await expect(parent.getByRole('heading',{name:'솔바다에서, 천천히 함께',exact:true})).toBeVisible();await expect(parent.getByRole('button',{name:'상세 화면에서 일정 수정'})).toHaveCount(0);
 await parent.getByRole('button',{name:'쉬는 시간을 늘려 주세요',exact:true}).click();await expect(parent.getByRole('status')).toContainText('의견을 기록');
 await expect(page.getByRole('button',{name:'의견을 반영한 수정안 보기'})).toBeVisible({timeout:12000});
 const fragment=new URLSearchParams(new URL(link).hash.slice(1));const denied=await second.request.put('http://127.0.0.1:3000/api/trips/'+fragment.get('trip'),{headers:{Origin:'http://127.0.0.1:3000',Authorization:'Bearer '+fragment.get('token')},data:{trip:JSON.parse(await page.evaluate(()=>localStorage.getItem('bopok:trip:v1')!)),storageVersion:1}});expect(denied.status()).toBe(403);
 await page.getByRole('button',{name:'공유 링크 모두 폐기',exact:true}).click();await expect(parent.getByRole('alert')).toBeVisible({timeout:12000});await expect(parent.getByRole('heading',{name:'솔바다에서, 천천히 함께',exact:true})).toHaveCount(0);await expect(parent.getByRole('button',{name:'쉬는 시간을 늘려 주세요',exact:true})).toHaveCount(0);
 }finally{await second.close();}
});
test('cloud connection survives parent/compare screens and reload; concurrent changes stay protected',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'예시 여행 체험하기',exact:true}).click();await page.getByRole('button',{name:'서버에 새 여행 저장',exact:true}).click();await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toBeVisible();
 const before=await context.request.get('/api/trips');const original=(await before.json()).trips[0].id;
 await page.getByRole('button',{name:'부모님 모드',exact:true}).click();await page.getByRole('button',{name:'쉬는 시간을 늘려 주세요',exact:true}).click();await page.getByRole('button',{name:'자녀용 상세 화면',exact:true}).click();
 await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toBeVisible();await page.getByRole('button',{name:'의견을 반영한 수정안 보기'}).click();await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();await page.getByRole('button',{name:'서버 변경 저장',exact:true}).click();
 const after=await context.request.get('/api/trips');expect((await after.json()).trips.map((t:any)=>t.id)).toEqual([original]);
 await page.reload();await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toBeVisible();await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await expect(page.getByRole('heading',{name:'솔바다에서, 천천히 함께',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'부모님 모드',exact:true}).click();await page.getByRole('button',{name:'식사를 바꾸고 싶어요',exact:true}).click();await page.getByRole('button',{name:'자녀용 상세 화면',exact:true}).click();
 await page.getByRole('button',{name:'직접 수정',exact:true}).click();await page.locator('.editor-row').first().getByLabel('종료',{exact:true}).fill('09:45');await page.getByRole('button',{name:'편집 마치기',exact:true}).click();
 const remote=await context.request.get('/api/trips/'+original);const data=await remote.json();data.trip.basics.title='다른 기기의 수정';const saved=await context.request.put('/api/trips/'+original,{headers:{Origin:'http://127.0.0.1:3000'},data:{trip:data.trip,storageVersion:data.storageVersion}});expect(saved.ok()).toBe(true);
 await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toBeDisabled({timeout:12000});const local=await page.evaluate(()=>JSON.parse(localStorage.getItem('bopok:trip:v1')!));expect(local.feedback.some((f:any)=>f.text==='식사를 바꾸고 싶어요')).toBe(true);expect(local.basics.title).toBe('솔바다에서, 천천히 함께');
 await page.getByRole('button',{name:'의견을 반영한 수정안 보기'}).click();const unchangedPoll=page.waitForResponse(r=>r.url().endsWith('/api/trips/'+original)&&r.request().method()==='GET');await unchangedPoll;await expect(page.getByRole('heading',{name:'같은 마음, 조금 다른 일정.',exact:true})).toBeVisible();await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();
 await page.getByRole('button',{name:'최신 서버 일정 불러오기',exact:true}).click();await expect(page.getByRole('heading',{name:'다른 기기의 수정',exact:true})).toBeVisible();
});
test('owner recovery after cookie deletion returns the original server library',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'예시 여행 체험하기',exact:true}).click();await page.getByRole('button',{name:'서버에 새 여행 저장',exact:true}).click();await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toBeVisible();
 await page.getByText('서버 소유권 복구',{exact:true}).click();await page.getByRole('button',{name:'복구 키 발급 / 재발급',exact:true}).click();const key=await page.getByLabel('새 복구 키',{exact:true}).inputValue();const original=(await (await context.request.get('/api/trips')).json()).trips[0].id;
 await context.clearCookies();await page.reload();await page.getByText('서버 소유권 복구',{exact:true}).click();await page.getByLabel('보관한 복구 키',{exact:true}).fill(key);await page.getByRole('button',{name:'소유권 복구하기',exact:true}).click();await expect(page.locator('section.cloud-panel').filter({has:page.getByRole('heading',{name:'서버 보관·가족 확인',exact:true})})).toContainText('소유권을 복구했습니다.');
 expect((await (await context.request.get('/api/trips')).json()).trips.map((t:any)=>t.id)).toEqual([original]);await page.locator('section.cloud-panel').getByRole('button',{name:'솔바다에서, 천천히 함께',exact:true}).click();await expect(page.getByRole('button',{name:'서버 변경 저장',exact:true})).toBeVisible();
});
