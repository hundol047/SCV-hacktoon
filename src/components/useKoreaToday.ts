'use client';
import {useEffect,useState} from 'react';
import {koreaToday} from '../domain/travel-benefits';
export function useKoreaToday(){const [today,setToday]=useState('');useEffect(()=>{const update=()=>setToday(koreaToday());update();const timer=setInterval(update,60000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[]);return today;}
