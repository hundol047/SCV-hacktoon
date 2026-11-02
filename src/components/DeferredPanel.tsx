'use client';
import {useState,type ReactNode} from 'react';
export default function DeferredPanel({title,children}:{title:string;children:ReactNode}){
  const [loaded,setLoaded]=useState(false);
  return <details className="cloud-panel" onToggle={e=>{if(e.currentTarget.open)setLoaded(true);}}><summary>{title}</summary>{loaded&&children}</details>;
}
