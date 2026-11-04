"use client";
import UsageVideo from './UsageVideo';
import BeforeDeparture from './BeforeDeparture';
import {createId} from '../domain/id';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Footprints,
  Armchair,
  MapPin,
  Utensils,
  Check,
  Leaf,
  Route,
  Printer,
  Plus,
  Trash2,
  Undo2,
  ChevronRight,
  Heart,
  Menu,
  X,
  NotebookPen,
} from "lucide-react";
import {
  Conditions,
  Basics,
  Trip,
  Item,
  defaultConditions,
  demoConditions,
  defaultBasics,
  conditionsSchema,
  basicsSchema,
  basicsWithTaxiRule,
  time,
  minutes,
  dayDate,
} from "../domain/schema";
import { DEMO_NOTICE } from "../data/demo";
import {Catalog,catalogFor,demoCatalog,indexCatalog,emptyRealCatalog} from '../data/catalog';
import {CatalogContext,useCatalog} from './CatalogContext';
import RealSearch from './RealSearch';
import SimpleTripForm from './SimpleTripForm';
import WorldPlan from './WorldPlan';
import BrandMark from './BrandMark';
import DailyTourismPhoto from './DailyTourismPhoto';
import KoreaPhotoGallery from './KoreaPhotoGallery';
import DeferredPanel from './DeferredPanel';
import LocalEvents from './LocalEvents';
import PromotionStudio from './PromotionStudio';
import RegionalCourse from './RegionalCourse';
import StudentTaxiPlanner from './StudentTaxiPlanner';
import TravelSummary from './TravelSummary';
import {transportLabel,money,destinationFor,localInstant} from '../domain/world';
import {clearPhotos} from '../adapters/photo-storage';
import LibraryPanel from './LibraryPanel';
import FamilySync from './FamilySync';
import AccountPanel from './AccountPanel';
import CompactItinerary from './CompactItinerary';
import Credits from './Credits';
import VenueFacts from './VenueFacts';
import RouteLookup from './RouteLookup';
import LiveRoadRoute from './LiveRoadRoute';
import DayRoadPlanner from './DayRoadPlanner';
import WeatherAlternatives from './WeatherAlternatives';
import VisitChecks from './VisitChecks';
import AIAdvice from './AIAdvice';
import AIReplacement from './AIReplacement';
import {verifyReviewed} from '../domain/verification';
import type {CloudTrip} from '../server/store';
import { validateSchedule, Report } from "../domain/validate";
import {
  generate,
  demoItinerary,
  applyProposal,
  undo,
  parseItinerary,
  Proposal,
  isCurrentResponse,
} from "../domain/engine";
import {
  loadLibrary,
  LIBRARY_KEY,
  loadTrip,
  saveTrip,
  loadDraft,
  saveDraft,
  STORAGE_KEY,
  FORM_KEY,
  FormDraft,
} from "../adapters/storage";
import { AIResult } from "../adapters/ai";

type Screen =
  "home" | "conditions" | "basics" | "result" | "compare" | "parent";
const labels = {
  move: "이동",
  visit: "둘러보기",
  meal: "식사",
  rest: "쉬는 시간",
};
const statusLabels = {
  pass: "확인된 정보 기준 충족",
  violation: "조건 위반",
  unknown: "정보 부족",
  conflict: "조건 충돌 · 가능한 일정 없음",
};
const experienceOptions = [
  "바다 보기",
  "자연 풍경",
  "전통시장",
  "지역 음식",
  "문화·전시",
  "조용한 카페",
  "사진 찍기",
];
const feedbackOptions = [
  "좋아요",
  "걷는 구간을 줄여 주세요",
  "쉬는 시간을 늘려 주세요",
  "식사를 바꾸고 싶어요",
] as const;
const uid = () => createId();
export default function Bopok({initialCloud,accessToken}:{initialCloud?:CloudTrip;accessToken?:string}={}) {
  const [screen, setScreen] = useState<Screen>("home"),
    [trip, setTrip] = useState<Trip | null>(null),
    [ready, setReady] = useState(false);
  const [c, setC] = useState<Conditions>(defaultConditions),
    [b, setB] = useState<Basics>(defaultBasics),
    [step, setStep] = useState(0),
    [existing, setExisting] = useState(false);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [edit, setEdit] = useState(false),
    [day, setDay] = useState(1);
  const [text, setText] = useState(""),
    [ai, setAi] = useState<AIResult | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState(""),
    [importItems, setImportItems] = useState<Item[]>([]),
    [customExperience, setCustomExperience] = useState("");
  const [savedDraft, setSavedDraft] = useState<FormDraft | null>(null);
  const [selectedCatalog,setSelectedCatalog]=useState<Catalog>(demoCatalog),[library,setLibrary]=useState<Trip[]>([]);
  const [identityRevision,setIdentityRevision]=useState(0);
  useEffect(()=>{const changed=()=>setIdentityRevision(n=>n+1);window.addEventListener('bopok:identity',changed);return ()=>window.removeEventListener('bopok:identity',changed);},[]);
  const currentCatalog=(screen==='conditions'||screen==='basics')?catalogFor(b.mode,selectedCatalog):catalogFor(trip?.basics.mode??'demo',trip?.catalog);
  const {placeById,getRoute}=indexCatalog(currentCatalog),places=currentCatalog.places;
  const [verificationTick,setVerificationTick]=useState(0);
  useEffect(()=>{if(!trip?.catalog?.places.some(p=>p.review))return;let active=true;fetch('/api/verification?mode=key').then(r=>r.json()).then(async data=>{await Promise.all(trip.catalog!.places.filter(p=>p.review).map(p=>verifyReviewed(p,data.publicKey)));if(active)setVerificationTick(v=>v+1);}).catch(()=>{});return ()=>{active=false;};},[trip?.catalog]);
  const requestRevision = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if(initialCloud){setTrip(initialCloud.trip);setScreen('result');setReady(true);return;}
    try {
      setLibrary(loadLibrary(localStorage));
      const saved = loadTrip(localStorage);
      setTrip(saved.trip);
      setSavedDraft(loadDraft(localStorage));
      setError(saved.error ?? "");
    } catch {
      setError(
        "브라우저 저장소에 접근할 수 없습니다. 저장 없이 시연할 수 있습니다.",
      );
    }
    setReady(true);
    return () => activeRequest.current?.abort();
  }, []);
  useEffect(() => {
    if (ready && trip) {
      try {
        const e = saveTrip(localStorage, trip);
        if (e) setError(e);else setLibrary(loadLibrary(localStorage));
      } catch {
        setError(
          "여행을 저장하지 못했습니다. 새로고침 전에 내용을 확인해 주세요.",
        );
      }
    }
  }, [trip, ready]);
  useEffect(() => {
    if (ready && (screen === "conditions" || screen === "basics")) {
      try {
        const draft: FormDraft = {
          version: 1,
          conditions: c,
          basics: b,
          step,
          existing,
          importText,
          importItems,
          catalog:b.mode==='real'?selectedCatalog:undefined,
        };
        const e = saveDraft(localStorage, draft);
        if (e) setError(e);
        else setSavedDraft(draft);
      } catch {
        setError(
          "입력 중인 초안을 저장하지 못했습니다. 저장 없이 계속할 수 있습니다.",
        );
      }
    }
  }, [ready, screen, c, b, step, existing, importText, importItems]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (screen !== "home")
      document.querySelector<HTMLElement>("main h1")?.focus();
  }, [screen, step]);
  const changeC = (patch: Partial<Conditions>) => {
    requestRevision.current++;
    activeRequest.current?.abort();
    setBusy(false);
    setC((v) => ({ ...v, ...patch }));
    setAi(null);
    setError("");
  };
  const navigate = (s: Screen) => {
    setScreen(s);
    setError("");
    setNotice("");
  };
  const start = (isExisting: boolean) => {
    setSelectedCatalog(emptyRealCatalog);
    setC(structuredClone(defaultConditions));
    setB({ ...defaultBasics,mode:'real',title:'나의 여행',region:'실제 지역',days:1, date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()) });
    setStep(0);
    setExisting(isExisting);
    setImportItems([]);
    setImportText("");
    setText("");
    setAi(null);
    setProposal(null);
    navigate("basics");
  };
  const startTaxi = (transport:'taxi'|'driving'='taxi') => {
    start(false);
    setB({...defaultBasics,title:'나의 지역 맞춤 여행',date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),days:1,mode:'real',region:'실제 지역',transport,travelPriority:'balanced'});
    setSelectedCatalog(emptyRealCatalog);
    navigate('basics');
  };
  const demo = () => {
    const basics = { ...defaultBasics, title: "솔바다에서, 천천히 함께" };
    setTrip({
      version: 1,
      id: uid(),
      revision: 0,
      conditions: structuredClone(demoConditions),
      basics,
      items: demoItinerary(basics),
      history: [],
      feedback: [],
    });
    setDay(1);
    setEdit(false);
    setProposal(null);
    navigate("result");
    setNotice(
      "가상의 문제 일정입니다. 아래에서 점검하고 수정안을 비교해 보세요.",
    );
  };
  const remove = async () => {
    try {
      await clearPhotos();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(FORM_KEY);
      localStorage.removeItem('bopok:cloud:v1');localStorage.removeItem(LIBRARY_KEY);setLibrary([]);
      setSavedDraft(null);
      setTrip(null);
      setProposal(null);
      setC(defaultConditions);
      setB(defaultBasics);
      setText("");
      setAi(null);
      setImportText("");
      setImportItems([]);
      setCustomExperience("");
      requestRevision.current++;
      activeRequest.current?.abort();
      setBusy(false);
      navigate("home");
      setNotice("이 브라우저의 여행 데이터를 삭제했습니다.");
    } catch {
      setError(
        "저장 데이터를 삭제하지 못했습니다. 브라우저 설정을 확인해 주세요.",
      );
    }
  };
  async function extract() {
    if (!text.trim()) {
      setError("자연어로 여행 조건을 입력해 주세요.");
      return;
    }
    const revision = ++requestRevision.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, consent }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!isCurrentResponse(revision, requestRevision.current)) return;
      if (!response.ok)
        throw new Error(data.error ?? "조건 추출 요청에 실패했습니다.");
      setAi(data);
    } catch (e) {
      if (
        isCurrentResponse(revision, requestRevision.current) &&
        !controller.signal.aborted
      )
        setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      if (activeRequest.current === controller) setBusy(false);
    }
  }
  function confirmExtraction() {
    if (!ai) return;
    const o = ai.output;
    changeC({
      ...Object.fromEntries(
        ["maxWalkMin", "maxWalkM", "restInterval", "restMin", "avoidStairs"]
          .filter((k) => o[k as keyof typeof o] !== null)
          .map((k) => [k, o[k as keyof typeof o]]),
      ),
      foodAvoids: [...new Set([...c.foodAvoids, ...o.foodAvoids])],
      experiences: [...new Set([...c.experiences, ...o.experiences])],
    });
    setNotice(
      "명시된 조건만 카드에 반영했습니다. 내용을 확인하고 다음으로 진행해 주세요.",
    );
  }
  function createTrip() {
    const pc = conditionsSchema.safeParse(c),
      pb = basicsWithTaxiRule.safeParse(b);
    if (!pc.success || !pb.success) {
      setError("숫자 범위와 여행 날짜, 제목을 확인해 주세요.");
      return;
    }
    if (existing && !importItems.length) {
      setError("기존 일정을 텍스트로 가져오거나 시간표에 추가해 주세요.");
      return;
    }
    if(pb.data.mode==='real'&&currentCatalog.places.length===0){setError('먼저 실제 장소를 조회해 주세요. 가상 자료로 자동 대체하지 않습니다.');return;}
    if(existing&&importItems.some(i=>i.mode!==pb.data.mode)){setError('실제/가상 일정의 모드가 맞지 않습니다.');return;}
    const p = generate(pc.data, pb.data,[],[],currentCatalog);
    if (!existing && (pb.data.taxiPlan||pb.data.coursePlans?.length) && p.blocked && !p.items.length) {setError(p.reasons.join(' '));return;}
    const items = existing ? importItems : p.items;
    setTrip({
      version: 1,
      id: uid(),
      revision: 0,
      conditions: pc.data,
      basics: pb.data,
      items,
      history: [],
      feedback: [],
      catalog:pb.data.mode==='real'?currentCatalog:undefined,
    });
    try {
      localStorage.removeItem(FORM_KEY);
    } catch {}
    setSavedDraft(null);
    setProposal(null);
    setDay(1);
    setEdit(false);
    navigate("result");
    if (!existing) setNotice(p.reasons.join(" "));
  }
  function propose() {
    if (!trip) return;
    setProposal(
      generate(
        trip.conditions,
        trip.basics,
        trip.items,
        trip.feedback.map((f) => f.text),
        trip.catalog,
      ),
    );
    navigate("compare");
  }
  function mutate(items: Item[]) {
    if (!trip) return;
    try {
      setTrip(applyProposal(trip, items));
      setProposal(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function manualEdit(items: Item[]) {
    if (!trip) return;
    setTrip({
      ...trip,
      items,
      revision: trip.revision + 1,
      history: [...trip.history, structuredClone(trip.items)].slice(-20),
      historyBasics:[...trip.history.map((_,i)=>trip.historyBasics?.[i]??null),structuredClone(trip.basics)].slice(-20),
    });
    setProposal(null);
  }
  const report = useMemo(()=>trip?validateSchedule(trip.items,trip.conditions,trip.basics,trip.catalog):null,[trip,verificationTick]);
  const progress = screen === "conditions" ? step + 1 : 4;
  return (
    <CatalogContext.Provider value={currentCatalog}><div className={screen === "parent" ? "app parent-mode" : "app"}>
      <a className="skip-link" href="#main">
        본문 바로가기
      </a>
      <header className="site-header no-print">
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="여행잇 홈"
        >
          <BrandMark size={32} />
          <span>
            여행잇<span className="brand-dot">.</span>
          </span>
        </button>
        <nav aria-label="주요 메뉴">
          <button onClick={() => start(false)}>여행 만들기</button>


        </nav>
        <span className="header-caption">AI 기반 지역 맞춤형 여행코스 추천</span>
        <div className="header-account"><AccountPanel/></div>
      </header>
      <main id="main">

        {error && (
          <div className="alert error no-print" role="alert">
            {error}
            <button aria-label="오류 안내 닫기" onClick={() => setError("")}>
              <X size={18} />
            </button>
          </div>
        )}
        {notice && (
          <div className="alert no-print" role="status">
            {notice}
          </div>
        )}
        {screen === "home" ? (
          <>
            <section className="quick-start" aria-label="여행 시작 방법">
              <div><span className="eyebrow">지역부터, 나에게 맞는 여행</span><h2>지역과 취향으로 나만의 코스를 만드세요</h2><p>지역 자료를 불러오고 취향·이동 수단을 선택하면 코스를 추천합니다. 가고 싶은 지역과 취향만 골라 보세요.</p></div>
              <button className="primary" onClick={()=>startTaxi('taxi')}>택시 여행 빠르게 만들기 <ArrowRight size={18}/></button><button className="secondary" onClick={()=>startTaxi('driving')}>자가용 여행 빠르게 만들기 <ArrowRight size={18}/></button>

            </section>
            <UsageVideo/>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> AI 기반 지역 맞춤형 여행코스 추천 서비스
                </div>
                <h1 tabIndex={-1}>
                  가고 싶은 지역에서,
                  <br />
                  나에게 맞는 <em>여행</em>
                </h1>
                <p className="hero-description">
                  지역의 관광지와 나의 취향을 연결해 코스를 만들어요.
                  <br />
                  혼자, 친구와, 가족과 함께 — 취향에 맞는 한국 여행.
                </p>
                <button
                  className="primary hero-cta"
                  onClick={() => startTaxi('taxi')}
                >
                  지역 맞춤 여행 시작 <ArrowUpRight size={20} />
                </button>
                <button
                  className="text-button hero-secondary"
                  onClick={() => {if(trip)navigate("result");else {navigate("home");setNotice("여행 보관함에서 저장된 일정을 선택하세요.");}}}
                >
                  이미 계획한 여행이 있나요?{" "}
                  <span>
                    기존 일정 점검하기 <ArrowRight size={16} />
                  </span>
                </button>
                <div className="hero-note">
                  <Leaf size={16} /> 바다부터 골목까지, 나만의 여행 취향으로
                </div>
              </div>
              <div className="hero-art hero-photo-card">
                <div className="art-top">A LITTLE SLOWER, A LITTLE CLOSER</div>
                <DailyTourismPhoto/>
                <div className="art-caption">
                  <span>
                    우리의 여행은
                    <br />
                    <strong>서두르지 않아도 괜찮으니까.</strong>
                  </span>
                  <Footprints size={28} />
                </div>
                <div className="floating-note">
                  <Armchair size={22} />
                  <span>
                    쉬어 가는 시간도
                    <br />
                    <strong>여행의 일부예요</strong>
                  </span>
                </div>
              </div>
            </section>
            <DeferredPanel title="지역 축제·문화행사 찾아보기"><LocalEvents onTrip={t=>{setTrip(t);setDay(1);setProposal(null);navigate('result');}}/></DeferredPanel>
            <DeferredPanel title="소상공인 홍보 콘텐츠 만들기"><PromotionStudio/></DeferredPanel>
            {ready && savedDraft && (
              <section className="resume">
                <div>
                  <span className="eyebrow">작성 중인 조건 카드</span>
                  <h2>아직 못다 적은 여행 이야기</h2>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setSelectedCatalog(savedDraft.catalog??demoCatalog);
                      setC(savedDraft.conditions);
                    setB(savedDraft.basics);
                    setStep(savedDraft.step);
                    setExisting(savedDraft.existing);
                    setImportText(savedDraft.importText);
                    setImportItems(savedDraft.importItems);
                    navigate("basics");
                  }}
                >
                  입력 이어서 하기 <ArrowRight size={18} />
                </button>
              </section>
            )}
            {ready && trip && (
              <section className="resume">
                <div>
                  <span className="eyebrow">이 브라우저에 저장된 여행</span>
                  <h2>{trip.basics.title}</h2>
                  <p>
                    {trip.basics.date} · {trip.basics.days}일 ·{" "}
                    {trip.basics.region}
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => navigate("result")}
                >
                  이어서 보기 <ArrowRight size={18} />
                </button>
              </section>
            )}
            <KoreaPhotoGallery/>
            <LibraryPanel trips={library} current={trip} onSelect={t=>{setTrip(t);setDay(1);navigate('result');}}/>
            <section className="intro-section">
              <div className="section-heading">
                <span className="eyebrow">HOW WE TRAVEL</span>
                <h2>
                  좋은 여행은,
                  <br />
                  가고 싶은 곳을 고르는 것부터.
                </h2>
                <p>
                  새로운 풍경과 맛있는 음식,
                  <br />
                  하고 싶은 경험을 함께 지키는 여행을 설계해요.
                </p>
              </div>
              <div className="principles">
                <article>
                  <span className="step-number">01</span>
                  <Footprints />
                  <h3>지역과 날짜 선택</h3>
                  <p>
                    떠나고 싶은 지역과 날짜,
                    <br />꼭 보고 싶은 풍경을 직접 선택해요.
                  </p>
                </article>
                <article>
                  <span className="step-number">02</span>
                  <Route />
                  <h3>마음은 그대로, 동선은 편하게</h3>
                  <p>
                    부담스러운 구간을 찾고,
                    <br />
                    경험을 유지하는 수정안을 비교해요.
                  </p>
                </article>
                <article>
                  <span className="step-number">03</span>
                  <NotebookPen />
                  <h3>함께 읽고, 함께 확인</h3>
                  <p>
                    큰 글씨의 쉬운 일정으로 살펴보고,
                    <br />
                    여행 취향에 맞게 일정을 바꿔요.
                  </p>
                </article>
              </div>
            </section>
            <section className="demo-strip">
              <div className="demo-stamp">
                TRAVEL
                <br />
                NOTE <Leaf size={20} />
              </div>
              <div>
                <span className="eyebrow">먼저 가볍게 둘러보세요</span>
                <h2>바다를 보고 싶은 마음은 그대로.</h2>
                <p>
                  관광지와 식사, 이동 동선을 한눈에.
                  <br className="mobile-only" /> 가상 솔바다 여행이 어떻게
                  달라지는지 확인해 보세요.
                </p>
                <small>{DEMO_NOTICE}</small>
              </div>
              <button className="secondary" onClick={demo}>
                예시 여행 체험하기 <ArrowUpRight size={18} />
              </button>
            </section>
          </>
        ) : null}
        {(screen === "conditions" || screen === "basics") && (
          <section className="workspace form-workspace">
            <div className="form-heading"><button className="back" onClick={()=>navigate('home')}><ArrowLeft size={18}/> 홈으로</button><span className="eyebrow">나만의 한국 여행</span><h1 tabIndex={-1}>나에게 맞는 여행을 만들어 보세요</h1><p>출발지와 목적지, 함께 떠날 인원을 알려주세요.</p></div>
            <div className="form-body"><SimpleTripForm initialTransport={b.transport==='driving'?'driving':'taxi'} conditions={defaultConditions} onTrip={t=>{setTrip(t);setDay(1);setProposal(null);setSavedDraft(null);try{localStorage.removeItem(FORM_KEY);}catch{}navigate('result');}}/></div>
          </section>
        )}
        {screen === "result" && trip && report && (
          <section className="workspace">
            <div className="result-heading">
              <div>
                <span className="eyebrow">MY TRAVEL NOTE</span>
                <h1 tabIndex={-1}>{trip.basics.title}</h1>
                <p>
                  {trip.basics.region} · {trip.basics.date}부터{" "}
                  {trip.basics.days}일
                </p>
              </div>
              <button className="secondary" onClick={() => navigate("parent")}>
                <Heart size={18} /> 일정 한눈에
              </button>
            </div>
            <CompactItinerary key={trip.id} trip={trip}/>
            <details className="trip-tools"><summary>일정 수정·추가 기능</summary>
              <AIReplacement key={`replacement:${trip.id}:${trip.revision}`} trip={trip} onTrip={t=>{setTrip(t);setProposal(null);}}/>
              <DayRoadPlanner trip={trip} onTrip={t=>{setTrip(t);setProposal(null);}}/>
              <details><summary>시간·장소 직접 수정</summary><Editor items={trip.items} days={trip.basics.days} onChange={manualEdit}/></details>
              <button className="secondary" disabled={!trip.history.length} onClick={()=>setTrip(undo(trip))}>이전 일정으로 되돌리기</button>
            </details>
          </section>
        )}
        {screen === "compare" && trip && proposal && (
          <section className="workspace">
            <button className="back" onClick={() => navigate("result")}>
              <ArrowLeft size={18} /> 일정으로 돌아가기
            </button>
            <div className="result-heading">
              <div>
                <span className="eyebrow">A MORE COMFORTABLE WAY</span>
                <h1 tabIndex={-1}>같은 마음, 조금 다른 일정.</h1>
                <p>바뀐 구간과 남은 확인 사항을 살펴보고 적용해 주세요.</p>
              </div>
            </div>
            <DemoBanner />
            <div className="change-reasons">
              <h2>이렇게 바꿔 보았어요.</h2>
              {proposal.reasons.map((r) => (
                <p key={r}>
                  <Check size={18} />
                  {r}
                </p>
              ))}
              <p>
                <Leaf size={18} /> 유지한 경험:{" "}
                {proposal.preserved.join(", ") || "확인된 선호 경험 없음"}
              </p>
            </div>
            <div className="comparison">
              <section>
                <h2>
                  원래 일정 <span>BEFORE</span>
                </h2>
                <Timeline basics={trip.basics} items={trip.items} report={report!} showDay />
              </section>
              <section>
                <h2>
                  제안 일정 <span>AFTER</span>
                </h2>
                <Timeline basics={trip.basics}
                  items={proposal.items}
                  report={validateSchedule(
                    proposal.items,
                    trip.conditions,
                    trip.basics,
                    trip.catalog,
                  )}
                  showDay
                />
                {!proposal.items.length && (
                  <p>
                    현재 확인된 후보에서는 이 조건을 모두 맞추기 어렵습니다.
                  </p>
                )}
              </section>
            </div>
            <div className="remaining">
              <h2>수정 후 다시 점검한 결과</h2>
              <ReportView
                report={validateSchedule(
                  proposal.items,
                  trip.conditions,
                  trip.basics,
                  trip.catalog,
                )}
              />
            </div>
            <div className="apply-bar">
              <p>
                {proposal.blocked
                  ? "필수 조건 위반 또는 충돌이 남아 있어 적용할 수 없습니다. 직접 편집하거나 조건을 명시적으로 조정해 주세요."
                  : "정보 부족은 그대로 남습니다. 내용을 확인한 뒤 적용해 주세요."}
              </p>
              <button className="secondary" onClick={() => navigate("result")}>
                원래 일정 유지
              </button>
              <button
                className="primary"
                disabled={proposal.blocked}
                onClick={() => {
                  mutate(proposal.items);
                  navigate("result");
                  setNotice(
                    "수정안을 적용하고 같은 조건으로 다시 점검했습니다.",
                  );
                }}
              >
                수정안 적용 <Check size={18} />
              </button>
            </div>
          </section>
        )}
        {screen === "parent" && trip && report && (
          <section className="workspace parent-sheet">
            <div className="parent-toolbar no-print">
              <button className="back" onClick={() => navigate("result")}>
                <ArrowLeft size={20} /> 자녀용 상세 화면
              </button>
              <button className="secondary" onClick={() => window.print()}>
                <Printer size={20} /> 인쇄 / PDF 저장
              </button>
            </div>
            <span className="eyebrow">나의 지역 맞춤 여행</span>
            <h1 tabIndex={-1}>{trip.basics.title}</h1>
            <p className="parent-subtitle">
              {trip.basics.region} · {trip.basics.date}부터 {trip.basics.days}일
            </p>
            <DemoBanner />
            <div className="parent-intro">
              <Leaf size={26} />
              <p>
                보고 싶은 풍경을 함께 보고,
                <br />
                쉬는 시간에는 서두르지 않아요.
              </p>
            </div>
            {Array.from({ length: trip.basics.days }, (_, idx) => (
              <section className="parent-day" key={idx}>
                <h2>
                  {idx + 1}일차 <span>{dayDate(trip.basics, idx + 1)}</span>
                </h2>
                <p>
                  {destinationFor(trip.basics,idx+1)?.region??trip.basics.region} · {destinationFor(trip.basics,idx+1)?.timezone??trip.basics.timezone} 현지 시간<br/>오늘의 경험:{" "}
                  {[
                    ...new Set(
                      trip.items
                        .filter((i) => i.day === idx + 1 && i.kind === "visit")
                        .flatMap(
                          (i) =>
                            placeById.get(i.placeId ?? "")?.experiences ?? [],
                        ),
                    ),
                  ].join(", ") || "아직 정하지 않았어요"}
                </p>
                <TravelSummary basics={trip.basics} day={idx+1}/>
                {trip.items
                  .filter((i) => i.day === idx + 1)
                  .sort((a, b) => a.start - b.start)
                  .map((i) => {
                    const p = placeById.get(i.placeId ?? "");
                    let departure:string|undefined;try{if(i.transport==='transit')departure=localInstant(dayDate(trip.basics,i.day),i.start,destinationFor(trip.basics,i.day)?.timezone??trip.basics.timezone);}catch{}const r =
                      i.kind === "move"
                        ? getRoute(i.fromId, i.toId, i.transport,departure)
                        : null;
                    return (
                      <article className="parent-item" key={i.id}>
                        <span className="parent-time">
                          {time(i.start)} – {time(i.end)}
                        </span>
                        <div>
                          <span className="parent-kind">{labels[i.kind]}</span>
                          <h3>{itemName(i,currentCatalog)}</h3>
                          <p>
                            {i.kind === "rest"
                              ? `${i.end - i.start}분 쉬어요. ${p?.seat.value === true ? "자료에 앉을 자리가 있다고 표시된 공간입니다." : "앉을 자리 확인이 필요해요."}`
                              : i.kind === "move"
                                ? `${i.transport?transportLabel[i.transport]:'이동 수단 미확인'}로 이동해요. 예상 ${r?.duration.value ?? "확인 필요"}분.`
                                : (p?.description ?? "장소를 확인해 주세요.")}
                          </p>
                          {i.kind !== "rest" && (
                            <p>
                              걷는 구간:{" "}
                              {i.kind === "move"
                                ? (r?.walkMin.value ?? "확인 필요")
                                : (p?.walkMin.value ?? "확인 필요")}
                              분 ·{" "}
                              {i.kind === "move"
                                ? (r?.walkM.value ?? "확인 필요")
                                : (p?.walkM.value ?? "확인 필요")}
                              m
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
              </section>
            ))}
            <BeforeDeparture issues={report.issues}/>
            <section className="parent-feedback no-print">
              <h2>이 여행, 어떠세요?</h2>
              <p>
                의견은 이 브라우저에 기록돼요. 자녀용 화면에서 새 수정안을 만들
                수 있어요.
              </p>
              <div>
                {feedbackOptions.map((text) => (
                  <button
                    className="secondary"
                    key={text}
                    onClick={() => {
                      setTrip({
                        ...trip,
                        feedback: [
                          ...trip.feedback,
                          { id: uid(), text, at: new Date().toISOString() },
                        ].slice(-30),
                        revision: trip.revision + 1,
                      });
                      setNotice(
                        `“${text}” 의견을 기록했습니다. 현재 일정은 그대로 유지됩니다.`,
                      );
                    }}
                  >
                    {text === "좋아요" && <Heart size={20} />} {text}
                  </button>
                ))}
              </div>
            </section>
          </section>
        )}
        {screen !== "home" &&
          !trip &&
          (screen === "result" ||
            screen === "parent" ||
            screen === "compare") && (
            <section className="empty">
              <h1 tabIndex={-1}>저장된 여행이 없어요.</h1>
              <button className="primary" onClick={() => start(false)}>
                새 여행 만들기
              </button>
            </section>
          )}
        <FamilySync key={identityRevision} trip={trip} onTrip={t=>{setTrip(t);if(proposal){setProposal(null);if(screen==='compare'){navigate('result');setNotice('공유 일정이 갱신되어 수정안을 다시 만들어 주세요.');}}}} onOpen={()=>{setDay(1);navigate('result');}} initialCloud={initialCloud} accessToken={accessToken} hidden={screen!=='home'&&screen!=='result'}/>
      </main>
      <footer className="site-footer no-print">
        <div className="footer-brand">
          <BrandMark size={24} />
          <strong>여행잇.</strong>
          <span>함께 떠나는 여행, 서로의 속도로.</span>
        </div>
        <div className="footer-meta"><Credits trip={trip??undefined}/>

          <span>

          </span>
          <button className="text-button" onClick={remove}>
            <Trash2 size={14} /> 내 여행 데이터 삭제
          </button>
        </div>
      </footer>
    </div></CatalogContext.Provider>
  );
}

function DemoBanner() {
  const {catalog}=useCatalog();if(catalog.mode==='real')return null;
  return (
    <div className="demo-banner">
      <Leaf size={18} />
      <div>
        <strong>{DEMO_NOTICE}</strong>
        <span>
          가상 지역·장소·동선입니다. 실제 조사나 AI 적합성 판정 결과가 아닙니다.
        </span>
      </div>
    </div>
  );
}
function Limit({
  label,
  unit,
  max,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  max: number;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <label>
      {label}
      <div className="number-field">
        <input
          type="number"
          min={1}
          max={max}
          value={value ?? ""}
          placeholder="잘 모르겠어요"
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
        <span>{unit}</span>
      </div>
      <small>
        1~{max}
        {unit} · 비워 두면 ‘잘 모르겠어요’로 기록
      </small>
    </label>
  );
}
function StringList({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [raw, setRaw] = useState(values.join(", "));
  return (
    <label>
      {label}
      <input
        value={raw}
        placeholder={placeholder}
        maxLength={300}
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );
        }}
      />
      <small>쉼표로 구분해서 입력해 주세요.</small>
    </label>
  );
}
function ConditionCard({c}:{c:Conditions}) {return <div className="condition-card"><h2>여행 취향</h2><p>{c.experiences.join(' · ')||'다양한 경험'}</p></div>;}
function itemName(i: Item,catalog:Catalog=demoCatalog) {
  const {placeById}=indexCatalog(catalog);
  if (i.kind === "move")
    return `${placeById.get(i.fromId ?? "")?.name ?? "출발지 미확인"} → ${placeById.get(i.toId ?? "")?.name ?? "도착지 미확인"}`;
  return placeById.get(i.placeId ?? "")?.name ?? "장소 미확인";
}
function Timeline({
  basics,items,
  report,
  showDay = false,
}: {
  basics:Basics;items: Item[];
  report: Report;
  showDay?: boolean;
}) {
  const {catalog,placeById,getRoute}=useCatalog();
  return (
    <div className="timeline">
      {!items.length && (
        <p className="empty-message">
          아직 일정이 없어요. 조건을 확인하거나 직접 일정을 추가해 주세요.
        </p>
      )}
      {[...items]
        .sort((a, b) => a.day - b.day || a.start - b.start)
        .map((i) => {
          const p = placeById.get(i.placeId ?? "");
          let departure:string|undefined;try{if(i.transport==='transit')departure=localInstant(dayDate(basics,i.day),i.start,destinationFor(basics,i.day)?.timezone??basics.timezone);}catch{}const r = getRoute(i.fromId, i.toId, i.transport,departure);
          const problems = report.issues.filter((x) =>
            x.itemIds.includes(i.id),
          );
          const Icon =
            i.kind === "move"
              ? Route
              : i.kind === "rest"
                ? Armchair
                : i.kind === "meal"
                  ? Utensils
                  : MapPin;
          return (
            <article key={i.id} className={`timeline-row ${i.kind}`}>
              <div className="timeline-time">
                {showDay && <small>{i.day}일차</small>}
                <strong>{time(i.start)}</strong>
                <span>{time(i.end)}</span>
              </div>
              <div className="timeline-marker">
                <Icon size={18} />
              </div>
              <div className="timeline-content">
                <div className="item-kicker">
                  {labels[i.kind]} {i.locked && "· 고정 일정"}{" "}
                  <span>{i.end - i.start}분{catalog.mode==='real'?' 배정':''}</span>
                </div>
                <h3>{itemName(i,catalog)}</h3>
                {i.kind === "rest" ? (
                  <p>
                    앉아서 쉬기 ·{" "}
                    {p?.seat.value === true
                      ? "자료에 좌석 정보 있음"
                      : "좌석 확인 필요"}
                  </p>
                ) : (
                  <p>
                    {i.kind === "move"
                      ? (i.transport?transportLabel[i.transport]:'미확인')+' 이동'
                      : "장소 내부 보행"}{" "}
                    ·{" "}
                    {i.kind === "move"
                      ? (r?.walkMin.value ?? "미확인")
                      : (p?.walkMin.value ?? "미확인")}
                    분 /{" "}
                    {i.kind === "move"
                      ? (r?.walkM.value ?? "미확인")
                      : (p?.walkM.value ?? "미확인")}
                    m
                  </p>
                )}
                {problems.map((x, n) => (
                  <p className={`item-issue ${x.status}`} key={n}>
                    {x.status === "unknown" ? "? 확인 필요" : "! 조건 확인"} ·{" "}
                    {x.message}
                  </p>
                ))}
                <details className="evidence">
                  <summary>장소 데이터 근거 보기</summary>
                  <p>
                    {catalog.mode==='demo'?'여행잇 가상 시연 데이터 v1 · 실제 조사 없음 · 가상 시나리오 설정':catalog.sourceNotice}
                  </p>
                  {p && (
                    <p>
                      {catalog.mode==='real'&&<><a href={p.walkMin.source} target="_blank" rel="noreferrer">실제 장소 출처</a> · 수집 {p.walkMin.collectedAt}<br/></>}보행 {p.walkMin.evidenceId}, 거리 {p.walkM.evidenceId},
                      계단 {p.stairs.evidenceId}, 좌석 {p.seat.evidenceId}, 메뉴{" "}
                      {p.foods.evidenceId}, 운영 {p.hours.evidenceId}
                    </p>
                  )}
                  {r && (
                    <p>
                      이동 {r.duration.evidenceId} ·{" "}
                      {r.duration.value ?? "미확인"}분{" · 경로 계단 "}
                      {r.stairs.evidenceId}:{" "}
                      {r.stairs.value === null
                        ? "미확인"
                        : r.stairs.value
                          ? "있음"
                          : "없음"}
                    </p>
                  )}
                </details>
              </div>
            </article>
          );
        })}
    </div>
  );
}
function ReportView({ report }: { report: Report }) {
  return (
    <div className="report">
      <h2 className={`report-status ${report.status}`}>
        {report.status === "pass" ? (
          <Check size={24} />
        ) : (
          <Footprints size={24} />
        )}{" "}
        {statusLabels[report.status]}
      </h2>
      {report.issues.length === 0 ? (
        <p>
          입력한 조건을 현재 자료 기준으로 충족합니다. 실제 여행에 대한 보증은
          아닙니다.
        </p>
      ) : (
        <ul>
          {report.issues.map((i, n) => (
            <li key={n} className={i.status}>
              <span className="issue-type">
                {i.status === "unknown"
                  ? "확인 필요"
                  : i.status === "conflict"
                    ? "조건 충돌"
                    : "조건 위반"}
              </span>
              <p>{i.message}</p>
              {i.itemIds.length > 0 && (
                <small>관련 구간: {i.itemIds.join(", ")}</small>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function Editor({
  items,
  days,
  onChange,
}: {
  items: Item[];
  days: number;
  onChange: (i: Item[]) => void;
}) {
  const {catalog}=useCatalog();
  const update = (id: string, patch: Partial<Item>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div className="editor">
      <p className="helper">
        시간·장소·휴식·이동을 직접 편집하면 전체 조건을 다시 계산해요. 고정을
        해제하기 전에는 해당 구간을 바꾸거나 삭제하지 않습니다.
      </p>
      {items.map((i) => (
        <fieldset key={i.id} className="editor-row">
          <legend>
            {i.id} · {labels[i.kind]}
          </legend>
          <div className="editor-grid">
            <label>
              날짜
              <select
                disabled={i.locked}
                value={i.day}
                onChange={(e) => update(i.id, { day: Number(e.target.value) })}
              >
                {Array.from({ length: days }, (_, n) => (
                  <option key={n} value={n + 1}>
                    {n + 1}일차
                  </option>
                ))}
              </select>
            </label>
            <label>
              종류
              <select
                disabled={i.locked}
                value={i.kind}
                onChange={(e) =>
                  update(i.id, { kind: e.target.value as Item["kind"] })
                }
              >
                {Object.entries(labels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              시작
              <input
                type="time"
                disabled={i.locked}
                value={time(i.start)}
                onChange={(e) =>
                  e.target.value &&
                  update(i.id, { start: minutes(e.target.value) })
                }
              />
            </label>
            <label>
              종료
              <input
                type="time"
                disabled={i.locked}
                value={time(i.end)}
                onChange={(e) =>
                  e.target.value &&
                  update(i.id, { end: minutes(e.target.value) })
                }
              />
            </label>
            {i.kind === "move" ? (
              <>
                <PlaceSelect
                  label="출발 장소"
                  value={i.fromId}
                  disabled={i.locked}
                  onChange={(v) => update(i.id, { fromId: v })}
                />
                <PlaceSelect
                  label="도착 장소"
                  value={i.toId}
                  disabled={i.locked}
                  onChange={(v) => update(i.id, { toId: v })}
                />
                <label>
                  이동 수단
                  <select
                    disabled={i.locked}
                    value={i.transport ?? "taxi"}
                    onChange={(e) =>
                      update(i.id, {
                        transport: e.target.value as Item["transport"],
                      })
                    }
                  >
                    <option value="taxi">택시</option>
                    <option value="walk">도보</option>{catalog.mode==='real'&&<><option value="driving">자동차</option><option value="transit">대중교통</option></>}
                  </select>
                </label>
              </>
            ) : (
              <PlaceSelect
                label="장소"
                value={i.placeId}
                disabled={i.locked}
                onChange={(v) => update(i.id, { placeId: v })}
              />
            )}
          </div>
          <div className="editor-controls">
            <label className="check-row">
              <input
                type="checkbox"
                checked={i.locked}
                onChange={(e) => update(i.id, { locked: e.target.checked })}
              />{" "}
              이 일정 고정
            </label>
            <button
              className="text-button"
              disabled={i.locked}
              onClick={() => onChange(items.filter((x) => x.id !== i.id))}
            >
              <Trash2 size={16} /> 삭제
            </button>
          </div>
        </fieldset>
      ))}
      <button
        className="secondary"
        disabled={items.length >= 1000}
        onClick={() =>
          onChange([
            ...items,
            {
              id: uid(),
              day: 1,
              start: 600,
              end: 630,
              kind: "rest",
              placeId: catalog.mode==='demo'?'p24':catalog.places.find(p=>p.kind==='rest')?.id??null,
              fromId: null,
              toId: null,
              transport: null,
              locked: false,
              mode: catalog.mode,
            },
          ])
        }
      >
        <Plus size={18} /> 일정 구간 추가
      </button>
    </div>
  );
}
function PlaceSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const {places}=useCatalog();
  return (
    <label>
      {label}
      <select
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">장소 미확인</option>
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
