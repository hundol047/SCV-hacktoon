import {test,expect} from '@playwright/test';
test('two independent browsers share parent feedback and enforce viewer permissions',async({page,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'예시 여행 체험하기',exact:true}).click();
 await page.getByRole('button',{name:'서버에 새 여행 저장',exact:true}).click();await expect(page.locator('section.cloud-panel').filter({has:page.getByRole('heading',{name:'서버 보관·가족 확인',exact:true})})).toContainText('서버에 저장했습니다.');
 await page.getByRole('button',{name:'부모님 확인 링크 만들기',exact:true}).click();const link=await page.getByLabel('가족에게 전달할 비공개 링크').inputValue();
 const second=await browser.newContext();try{const parent=await second.newPage();await parent.goto(link);await expect(parent.getByRole('heading',{name:'솔바다에서, 천천히 함께',exact:true})).toBeVisible();await expect(parent.getByRole('button',{name:'상세 화면에서 일정 수정'})).toHaveCount(0);
 await parent.getByRole('button',{name:'쉬는 시간을 늘려 주세요',exact:true}).click();await expect(parent.getByRole('status')).toContainText('의견을 기록');
 await expect(page.getByRole('button',{name:'의견을 반영한 수정안 보기'})).toBeVisible({timeout:12000});
 const fragment=new URLSearchParams(new URL(link).hash.slice(1));const denied=await second.request.put('http://127.0.0.1:3000/api/trips/'+fragment.get('trip'),{headers:{Origin:'http://127.0.0.1:3000',Authorization:'Bearer '+fragment.get('token')},data:{trip:JSON.parse(await page.evaluate(()=>localStorage.getItem('bopok:trip:v1')!)),storageVersion:1}});expect(denied.status()).toBe(403);
 await page.getByRole('button',{name:'공유 링크 모두 폐기',exact:true}).click();await expect(parent.getByRole('alert')).toBeVisible({timeout:12000});
 }finally{await second.close();}
});
