import {it,expect} from 'vitest';
import {dailyPhoto,koreaDay,untilKoreaMidnight} from '../src/domain/daily-photo';
it('photo changes exactly at Korean midnight and remains identical during that date',()=>{
 const midnight=Date.parse('2026-11-04T00:00:00+09:00'),photos=Array.from({length:365},(_,i)=>i);
 expect(dailyPhoto(photos,midnight-1)).not.toBe(dailyPhoto(photos,midnight));
 expect(dailyPhoto(photos,midnight)).toBe(dailyPhoto(photos,midnight+86399999));
 expect(untilKoreaMidnight(midnight-1)).toBe(1);expect(untilKoreaMidnight(midnight)).toBe(86400000);
});
it('cycles all photos without duplicates over 365 consecutive days including leap day',()=>{
 const start=Date.parse('2028-01-01T00:00:00+09:00'),photos=Array.from({length:365},(_,i)=>i);
 expect(new Set(photos.map((_,i)=>dailyPhoto(photos,start+i*86400000))).size).toBe(365);
 expect(dailyPhoto(photos,start)).toBe(dailyPhoto(photos,start+365*86400000));expect(dailyPhoto([],start)).toBeUndefined();
});
