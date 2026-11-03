'use client';
import {useEffect,useRef,useState} from 'react';
import type {Place} from '../data/demo';
import {publicTravelJSON} from '../adapters/public-travel';
import {forecastHazards,forecastFresh,forecastURL,forecastWeather,parseForecast,type Forecast} from '../domain/live-weather';
import {weatherLabels} from '../domain/weather';
export default function LiveWeather({place,date,saved,onApply}:{place?:Place;date:string;saved?:Forecast;onApply:(f:Forecast)=>void}){
  const [forecast,setForecast]=useState<Forecast|null>(saved??null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const controller=useRef<AbortController|null>(null),lastRequest=useRef(0);
  const [,tick]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>tick(v=>v+1),60000);return()=>{clearInterval(timer);controller.current?.abort();};},[]);
  async function lookup(){
    if(place?.latitude===undefined||place.longitude===undefined)return;
    if(Date.now()-lastRequest.current<10000){setMessage('잠시 후 다시 조회해 주세요.');return;}
    lastRequest.current=Date.now();controller.current?.abort();const c=new AbortController();controller.current=c;
    setBusy(true);setMessage('');setForecast(null);
    try{const raw=await publicTravelJSON(forecastURL(place.latitude,place.longitude),c.signal);const f=parseForecast(raw,date,place.latitude,place.longitude);if(!c.signal.aborted)setForecast(f);}
    catch(e){if(!c.signal.aborted)setMessage(e instanceof Error?e.message:'예보 조회 실패');}
    finally{if(!c.signal.aborted)setBusy(false);}
  }
  const matching=forecast&&forecast.latitude===place?.latitude&&forecast.longitude===place?.longitude&&forecast.date===date;
  return <div className="live-weather"><h3>여행일 날씨 예보</h3><p>{place?.name??'기준 출발 장소를 먼저 선택하세요.'} · {date}. 조회하면 장소 좌표를 Open-Meteo에 전송합니다.</p>
    <button type="button" disabled={busy||place?.latitude===undefined||place?.longitude===undefined} onClick={lookup}>{busy?'예보 불러오는 중…':'현재 날씨·여행일 예보 조회'}</button>
    {busy&&<button type="button" onClick={()=>{controller.current?.abort();setBusy(false);setMessage('예보 조회를 취소했습니다.');}}>예보 조회 취소</button>}
    {matching&&<div><p>예보 최저 {forecast.low}°C · 최고 {forecast.high}°C · 강수확률 {forecast.rainChance}% · 최대 바람 {forecast.wind}km/h</p>{forecast.current!==null&&<p>현재 모델 기온 {forecast.current}°C · {forecast.currentTime} ({forecast.timezone})</p>}<p>함께 확인할 위험: {forecastHazards(forecast).join(' · ')||'해당 기준의 위험 없음 · 안전 보장은 아닙니다'}</p><p>추천 적용 기준: {weatherLabels[forecastWeather(forecast)]}. 모델 예보를 분류한 값이며 공식 특보 발령 여부가 아닙니다. 흐림·안개 등은 맑음으로 간주하지 않습니다.</p><p>조회 시각 {new Date(forecast.fetchedAt).toLocaleString('ko-KR')}{!forecastFresh(forecast,date)&&' · 오래된 자료입니다. 다시 조회하세요.'}</p><button type="button" disabled={busy||!forecastFresh(forecast,date)} onClick={()=>{if(!forecastFresh(forecast,date)){setMessage('예보를 다시 조회하세요.');return;}onApply(forecast);}}>이 예보를 코스 추천에 적용</button></div>}
    <p role="status">{message}</p><p><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo</a> · 예보 범위 밖·인터넷 오류 시 수동 날씨 선택을 이용하세요. 출발 직전 공식 예보·특보도 확인하세요.</p>
  </div>;
}
