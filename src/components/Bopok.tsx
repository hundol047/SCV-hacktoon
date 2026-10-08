"use client";
import { useEffect, useRef, useState } from "react";
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
  time,
  minutes,
  dayDate,
} from "../domain/schema";
import { DEMO_NOTICE } from "../data/demo";
import {Catalog,catalogFor,demoCatalog,indexCatalog,emptyRealCatalog} from '../data/catalog';
import {CatalogContext,useCatalog} from './CatalogContext';
import RealSearch from './RealSearch';
import WorldPlan from './WorldPlan';
import {transportLabel,money,destinationFor,localInstant} from '../domain/world';
import LibraryPanel from './LibraryPanel';
import FamilySync from './FamilySync';
import AccountPanel from './AccountPanel';
import VenueFacts from './VenueFacts';
import RouteLookup from './RouteLookup';
import AIAdvice from './AIAdvice';
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
const uid = () => crypto.randomUUID();
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
  const currentCatalog=(screen==='conditions'||screen==='basics')?catalogFor(b.mode,selectedCatalog):catalogFor(trip?.basics.mode??'demo',trip?.catalog);
  const {placeById,getRoute}=indexCatalog(currentCatalog),places=currentCatalog.places;
  const [,setVerificationTick]=useState(0);
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
    setSelectedCatalog(demoCatalog);
    setC(structuredClone(defaultConditions));
    setB({ ...defaultBasics });
    setStep(0);
    setExisting(isExisting);
    setImportItems([]);
    setImportText("");
    setText("");
    setAi(null);
    setProposal(null);
    navigate("conditions");
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
  const remove = () => {
    try {
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
      pb = basicsSchema.safeParse(b);
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
    });
    setProposal(null);
  }
  const report = trip
    ? validateSchedule(trip.items, trip.conditions, trip.basics,trip.catalog)
    : null;
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
          aria-label="보폭 홈"
        >
          <Footprints size={26} />
          <span>
            보폭<span className="brand-dot">.</span>
          </span>
        </button>
        <nav aria-label="주요 메뉴">
          <button onClick={() => start(false)}>여행 만들기</button>
          <button onClick={() => start(true)}>일정 점검</button>
          <button className="nav-demo" onClick={demo}>
            예시 체험 <ArrowUpRight size={16} />
          </button>
        </nav>
        <span className="header-caption">함께 걷는 여행의 시작</span>
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
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> 부모님과 나, 같은 여행의 다른 보폭
                </div>
                <h1 tabIndex={-1}>
                  부모님의 속도로,
                  <br />
                  함께 떠나는 <em>여행</em>
                </h1>
                <p className="hero-description">
                  걷는 시간부터 쉬는 순간까지, 우리 가족에게 맞게.
                  <br />
                  가고 싶은 마음은 그대로, 일정의 부담은 조금 덜어 보세요.
                </p>
                <button
                  className="primary hero-cta"
                  onClick={() => start(false)}
                >
                  우리 부모님 여행 만들기 <ArrowUpRight size={20} />
                </button>
                <button
                  className="text-button hero-secondary"
                  onClick={() => start(true)}
                >
                  이미 계획한 여행이 있나요?{" "}
                  <span>
                    기존 일정 점검하기 <ArrowRight size={16} />
                  </span>
                </button>
                <div className="hero-note">
                  <Leaf size={16} /> 나이가 아닌, 직접 선택한 걷기·휴식 조건을
                  기준으로
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="바다와 산책길을 담은 여행 일러스트"
                role="img"
              >
                <div className="art-top">A LITTLE SLOWER, A LITTLE CLOSER</div>
                <svg viewBox="0 0 520 470" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient
                      id="sky"
                      x1="260"
                      y1="0"
                      x2="260"
                      y2="420"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#e9ece0" />
                      <stop offset="1" stopColor="#f7ebcc" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M36 170C36 74 108 27 260 27s224 47 224 143v244H36V170Z"
                    fill="url(#sky)"
                  />
                  <circle cx="368" cy="136" r="34" fill="#e9b65d" />
                  <path
                    d="M36 269c111-28 200-31 448-4v149H36V269Z"
                    fill="#b5cfcb"
                  />
                  <path
                    d="M36 306c115-24 230-27 448-1"
                    stroke="#e7f1e9"
                    strokeWidth="3"
                  />
                  <path
                    d="M36 339c102-24 320-18 448-1"
                    stroke="#e7f1e9"
                    strokeWidth="3"
                  />
                  <path
                    d="M36 345c120-68 131-109 189-115 74-8 125 87 259 117v67H36v-69Z"
                    fill="#678675"
                  />
                  <path
                    d="M36 380c97-13 128-75 165-65 55 16 48 72 137 99H36v-34Z"
                    fill="#365e4d"
                  />
                  <path
                    d="M139 414c37-24 56-54 62-76 4-16 29-23 45-16 24 10 42 47 89 92"
                    fill="#ded6b7"
                  />
                  <path
                    d="M76 250v96M76 224l-28 50h56l-28-50ZM76 194l-24 51h48l-24-51Z"
                    fill="#355946"
                    stroke="#355946"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M440 248v112M440 213l-33 57h66l-33-57ZM440 180l-28 56h56l-28-56Z"
                    fill="#456c54"
                    stroke="#456c54"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                  <circle cx="251" cy="298" r="9" fill="#544735" />
                  <path d="M242 311h18l6 36h-30l6-36Z" fill="#eee5ce" />
                  <path
                    d="m244 346-5 30m15-30 5 30"
                    stroke="#544735"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <circle cx="282" cy="309" r="8" fill="#544735" />
                  <path d="M275 321h16l5 30h-26l5-30Z" fill="#b47b4c" />
                  <path
                    d="m277 351-5 25m14-25 4 25"
                    stroke="#544735"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="m260 322 11 9"
                    stroke="#544735"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M147 189c9-6 16-6 24 0m0 0c8-6 15-6 23 0"
                    stroke="#678675"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
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
                    navigate("conditions");
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
            <LibraryPanel trips={library} current={trip} onSelect={t=>{setTrip(t);setDay(1);navigate('result');}}/>
            <section className="intro-section">
              <div className="section-heading">
                <span className="eyebrow">HOW WE TRAVEL</span>
                <h2>
                  좋은 여행은,
                  <br />
                  서로의 보폭을 아는 것부터.
                </h2>
                <p>
                  무조건 적게 걷는 여행이 아니라,
                  <br />
                  하고 싶은 경험을 함께 지키는 여행을 설계해요.
                </p>
              </div>
              <div className="principles">
                <article>
                  <span className="step-number">01</span>
                  <Footprints />
                  <h3>먼저, 부모님의 이야기</h3>
                  <p>
                    편하게 걷는 시간, 원하는 휴식,
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
                    부모님의 의견을 다시 반영해요.
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
                  걷기 20분, 계단 피하기, 충분한 휴식.
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
            <div className="form-heading">
              <button
                className="back"
                onClick={() =>
                  screen === "basics"
                    ? navigate("conditions")
                    : step > 0
                      ? setStep(step - 1)
                      : navigate("home")
                }
              >
                <ArrowLeft size={18} /> 이전으로
              </button>
              <span className="eyebrow">우리 가족의 여행 노트</span>
              <h1 tabIndex={-1}>
                {screen === "basics"
                  ? "어디로, 언제 떠나볼까요?"
                  : step === 0
                    ? "편안한 보폭을 알려 주세요."
                    : step === 1
                      ? "여행에서 만나고 싶은 것들."
                      : "부모님 조건, 함께 확인해요."}
              </h1>
              <p>
                모르는 조건은 비워 두세요. 나이나 활동 선호로 수치를 대신 정하지
                않아요.
              </p>
              <div className="progress" aria-label={`${progress}/4 단계`}>
                {["걷기와 휴식", "여행 취향", "조건 확인", "여행 정보"].map(
                  (t, i) => (
                    <div key={t} className={i + 1 <= progress ? "active" : ""}>
                      <span>
                        {i + 1 < progress ? <Check size={14} /> : i + 1}
                      </span>
                      {t}
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="form-body">
              <div className="demo-banner">
                <Leaf size={18} />
                <div>
                  <strong>{b.mode==='demo'?'가상 시연과 전국·해외 실제 도시 검색을 구분해요.':currentCatalog.sourceNotice}</strong>
                  <span>{DEMO_NOTICE}</span>
                </div>
              </div>
              {screen === "conditions" && step === 0 && (
                <>
                  <fieldset>
                    <legend>어떤 속도의 여행이 좋으세요?</legend>
                    <div className="choice-grid">
                      {[
                        ["slow", "천천히 둘러보고 싶어요"],
                        ["moderate", "적당히 걷는 것은 괜찮아요"],
                        ["active", "활동적인 여행이 좋아요"],
                        ["unknown", "잘 모르겠어요"],
                      ].map(([v, l]) => (
                        <label
                          className={`choice ${c.activity === v ? "selected" : ""}`}
                          key={v}
                        >
                          <input
                            type="radio"
                            name="activity"
                            value={v}
                            checked={c.activity === v}
                            onChange={() =>
                              changeC({ activity: v as Conditions["activity"] })
                            }
                          />
                          {l}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="field-grid">
                    <Limit
                      label="한 번에 걷고 싶은 최대 시간"
                      unit="분"
                      max={180}
                      value={c.maxWalkMin}
                      onChange={(v) => changeC({ maxWalkMin: v })}
                    />
                    <Limit
                      label="한 번에 걷고 싶은 최대 거리"
                      unit="m"
                      max={10000}
                      value={c.maxWalkM}
                      onChange={(v) => changeC({ maxWalkM: v })}
                    />
                    <Limit
                      label="원하는 휴식 간격"
                      unit="분마다"
                      max={240}
                      value={c.restInterval}
                      onChange={(v) => changeC({ restInterval: v })}
                    />
                    <Limit
                      label="한 번 쉴 때 원하는 시간"
                      unit="분"
                      max={120}
                      value={c.restMin}
                      onChange={(v) => changeC({ restMin: v })}
                    />
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={c.avoidStairs}
                      onChange={(e) =>
                        changeC({ avoidStairs: e.target.checked })
                      }
                    />
                    <span>
                      계단은 반드시 피하고 싶어요{" "}
                      <small>필수 조건으로 점검합니다.</small>
                    </span>
                  </label>
                  <details className="natural">
                    <summary>말로 적는 편이 더 편한가요?</summary>
                    <p>
                      명확하게 적은 여행 조건만 추출해요. 의료
                      정보·주민등록번호는 입력하지 마세요.
                    </p>
                    <label>
                      부모님의 여행 이야기
                      <textarea
                        maxLength={1800}
                        value={text}
                        onChange={(e) => {
                          requestRevision.current++;
                          activeRequest.current?.abort();
                          setText(e.target.value);
                          setAi(null);
                          setBusy(false);
                        }}
                        placeholder="한 번에 걷기는 20분이면 좋겠어요. 바다를 보고 싶고, 매운 음식은 피하고 싶어요."
                      />
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => {
                          requestRevision.current++;
                          activeRequest.current?.abort();
                          setConsent(e.target.checked);
                          setAi(null);
                          setBusy(false);
                        }}
                      />
                      선택: 서버에 AI가 설정된 경우, 이 여행 조건을 OpenAI에
                      보내 추출하는 데 동의해요.
                    </label>
                    <p className="helper">
                      동의하지 않거나 키가 없으면 규칙 기반으로 처리합니다. 전송
                      목적은 조건 추출이며, 저장 요청은 하지 않습니다. 개인·의료
                      정보를 적지 마세요.
                    </p>
                    <button
                      className="secondary"
                      onClick={extract}
                      disabled={busy}
                    >
                      {busy ? "조건을 읽는 중…" : "조건 추출하기"}
                    </button>
                    {ai && (
                      <div className="extraction">
                        <strong>{ai.message}</strong>
                        <p>
                          추출 제안: 걷기 {ai.output.maxWalkMin ?? "미확인"}분 /
                          거리 {ai.output.maxWalkM ?? "미확인"}m / 휴식{" "}
                          {ai.output.restMin ?? "미확인"}분 / 계단{" "}
                          {ai.output.avoidStairs === true ? "피하기" : "미확인"}{" "}
                          / {ai.output.experiences.join(", ") || "경험 미확인"}{" "}
                          / 피할 음식:{" "}
                          {ai.output.foodAvoids.join(", ") || "미확인"}
                        </p>
                        {ai.output.questions.map((q) => (
                          <p key={q}>확인 질문 · {q}</p>
                        ))}
                        <button
                          className="secondary"
                          onClick={confirmExtraction}
                        >
                          확인 후 조건 카드에 반영
                        </button>
                      </div>
                    )}
                  </details>
                </>
              )}
              {screen === "conditions" && step === 1 && (
                <>
                  <fieldset>
                    <legend>꼭 만나고 싶은 여행의 순간</legend>
                    <div className="chips">
                      {experienceOptions.map((e) => (
                        <button
                          key={e}
                          className={
                            c.experiences.includes(e) ? "chip selected" : "chip"
                          }
                          aria-pressed={c.experiences.includes(e)}
                          onClick={() =>
                            changeC({
                              experiences: c.experiences.includes(e)
                                ? c.experiences.filter((v) => v !== e)
                                : [...c.experiences, e],
                            })
                          }
                        >
                          {c.experiences.includes(e) && <Check size={15} />} {e}
                        </button>
                      ))}
                    </div>
                    <div className="inline-field">
                      <label>
                        다른 경험 직접 입력
                        <input
                          value={customExperience}
                          onChange={(e) => setCustomExperience(e.target.value)}
                          maxLength={60}
                        />
                      </label>
                      <button
                        className="secondary"
                        onClick={() => {
                          if (customExperience.trim()) {
                            changeC({
                              experiences: [
                                ...new Set([
                                  ...c.experiences,
                                  customExperience.trim(),
                                ]),
                              ],
                            });
                            setCustomExperience("");
                          }
                        }}
                      >
                        추가
                      </button>
                    </div>
                  </fieldset>
                  {c.experiences.length > 0 && (
                    <fieldset>
                      <legend>이 중 반드시 포함할 경험이 있나요?</legend>
                      {c.experiences.map((e) => (
                        <label key={e} className="check-row">
                          <input
                            type="checkbox"
                            checked={c.requiredExperiences.includes(e)}
                            onChange={(ev) =>
                              changeC({
                                requiredExperiences: ev.target.checked
                                  ? [...c.requiredExperiences, e]
                                  : c.requiredExperiences.filter(
                                      (v) => v !== e,
                                    ),
                              })
                            }
                          />
                          {e} · 필수 경험
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <div className="field-grid">
                    <StringList
                      label="좋아하는 음식"
                      placeholder="지역 음식, 순한 음식"
                      values={c.foodLikes}
                      onChange={(v) => changeC({ foodLikes: v })}
                    />
                    <StringList
                      label="피하고 싶은 음식"
                      placeholder="매운 음식"
                      values={c.foodAvoids}
                      onChange={(v) => changeC({ foodAvoids: v })}
                    />
                  </div>
                  <StringList
                    label="피하고 싶은 상황"
                    placeholder="붐비는 곳, 소음"
                    values={c.avoidSituations}
                    onChange={(v) => changeC({ avoidSituations: v })}
                  />
                  <label>
                    점심은 늦어도 이 시간에{" "}
                    <input
                      type="time"
                      value={c.latestLunch === null ? "" : time(c.latestLunch)}
                      onChange={(e) =>
                        changeC({
                          latestLunch: e.target.value
                            ? minutes(e.target.value)
                            : null,
                        })
                      }
                    />
                    <small>
                      선택 사항 · 11:00~15:00. 비워 두면 늦은 점심 조건을
                      판정하지 않습니다.
                    </small>
                  </label>
                  <p className="helper">
                    음식 선호 확인 기능입니다. 알레르기 안전 판정이나 의료 식단
                    추천은 제공하지 않습니다. 기록에 없는 음식·상황은 현장
                    확인이 필요합니다.
                  </p>
                </>
              )}
              {screen === "conditions" && step === 2 && <ConditionCard c={c} />}
              {screen === "basics" && (
                <>
                  <label>
                    여행 제목
                    <input
                      value={b.title}
                      maxLength={80}
                      onChange={(e) => setB({ ...b, title: e.target.value })}
                    />
                  </label>
                  <div className="field-grid">
                    <label>
                      여행 지역
                      <select aria-label="데이터 모드" value={b.mode} onChange={e=>{const mode=e.target.value as Basics['mode'];setB({...b,mode,region:mode==='demo'?'가상 솔바다':'실제 지역',days:Math.min(b.days,2),transport:'taxi',destinations:undefined,transfers:undefined,expenses:undefined,currency:'KRW'});setSelectedCatalog(mode==='demo'?demoCatalog:emptyRealCatalog);setImportItems([]);}}><option value="demo">가상 솔바다 · 시연</option><option value="real">전국·해외 실제 도시</option></select>
                    </label>
                    <label>
                      출발 날짜
                      <input
                        type="date"
                        value={b.date}
                        onChange={(e) => setB({ ...b, date: e.target.value })}
                      />
                    </label>
                    <label>
                      여행 기간
                      <select
                        value={b.days}
                        onChange={(e) =>
                          setB({ ...b, days: Number(e.target.value) })
                        }
                      >
                        <option value={1}>당일 · 1일</option>
                        <option value={2}>1박 2일</option>{b.mode==='real'&&Array.from({length:28},(_,n)=><option key={n+3} value={n+3}>{n+3}일</option>)}
                      </select>
                    </label>
                    <label>
                      전체 예산 ({b.currency??'KRW'})
                      <input
                        type="number"
                        min={0}
                        max={10000000}
                        value={b.budget}
                        onChange={(e) =>
                          setB({ ...b, budget: Number(e.target.value) })
                        }
                      />
                      <small>
                        확인된 일정 비용과 추가 비용을 합산합니다. 미확인 금액은 별도로 표시합니다.
                      </small>
                    </label>
                    <label>
                      지역 내 이동 수단
                      <select
                        value={b.transport}
                        onChange={(e) =>
                          setB({
                            ...b,
                            transport: e.target.value as Basics["transport"],
                          })
                        }
                      >
                        <option value="taxi">택시</option>
                        <option value="walk">도보</option>{b.mode==='real'&&<><option value="driving">자동차</option><option value="transit">대중교통</option></>}
                      </select>
                    </label>
                    <label>
                      일정 작성 방법
                      <select
                        value={existing ? "existing" : "new"}
                        onChange={(e) =>
                          setExisting(e.target.value === "existing")
                        }
                      >
                        <option value="new">새 일정 만들기</option>
                        <option value="existing">기존 일정 점검하기</option>
                      </select>
                    </label>
                  </div>
                  {b.mode==='real'&&<><RealSearch onLoaded={catalog=>{setSelectedCatalog(catalog);const meta=catalog.cities?.[0];setB({...b,region:catalog.region,timezone:meta?.timezone??b.timezone,destinations:[{region:catalog.region,startDay:1,endDay:b.days,timezone:meta?.timezone??b.timezone,currency:meta?.currency??'KRW'}]});setImportItems([]);}}/><label>현지 시간대 (IANA)<input value={b.timezone} onChange={e=>setB({...b,timezone:e.target.value})} placeholder="Asia/Seoul, Asia/Tokyo, Europe/Paris"/></label>{selectedCatalog.places.length>0&&<WorldPlan basics={b} catalog={selectedCatalog} onChange={(basics,catalog)=>{setB(basics);setSelectedCatalog(catalog);}}/>}</>}
                  {existing && (
                    <section className="importer">
                      <h2>기존 일정 입력</h2>
                      <p>
                        지원 범위는 아래 후보 장소입니다. 실제 장소명은 가져오지
                        않습니다. 이동 구간은 시간표에서 별도로 추가해 주세요.
                      </p>
                      <details>
                        <summary>후보 장소 목록 보기</summary>
                        <ul className="candidate-list">
                          {places.map((p) => (
                            <li key={p.id}>
                              {p.id} · {p.name} · {labels[p.kind]}
                            </li>
                          ))}
                        </ul>
                      </details>
                      <label>
                        1일차 텍스트 일정
                        <textarea
                          maxLength={10000}
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          placeholder={
                            "09:30-10:15 가상 바다마루 전망길\n14:00-14:50 가상 솔바다 매운밥집"
                          }
                        />
                      </label>
                      <button
                        className="secondary"
                        onClick={() => {
                          const parsed = parseItinerary(importText, 1, currentCatalog);
                          if (parsed.errors.length)
                            setError(parsed.errors.join(" "));
                          else {
                            setImportItems(parsed.items);
                            setError("");
                            setNotice(
                              "텍스트 일정을 가져왔어요. 시간표에서 이동과 휴식을 추가해 주세요.",
                            );
                          }
                        }}
                      >
                        텍스트를 시간표로 가져오기
                      </button>
                      <Editor
                        items={importItems}
                        days={b.days}
                        onChange={setImportItems}
                      />
                    </section>
                  )}
                </>
              )}
              <div className="form-actions">
                <p>입력하신 여행은 이 브라우저에만 저장돼요.</p>
                <button
                  className="primary"
                  onClick={() => {
                    if (!conditionsSchema.safeParse(c).success) {
                      setError("걷기·휴식 숫자 범위를 확인해 주세요.");
                      return;
                    }
                    if (screen === "basics") createTrip();
                    else if (step < 2) setStep(step + 1);
                    else navigate("basics");
                  }}
                >
                  {screen === "basics"
                    ? existing
                      ? "일정 점검하기"
                      : "우리 가족 일정 만들기"
                    : step === 2
                      ? "이 조건으로 여행 준비하기"
                      : "다음으로"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </section>
        )}
        {screen === "result" && trip && report && (
          <section className="workspace">
            <div className="result-heading">
              <div>
                <span className="eyebrow">OUR FAMILY TRAVEL NOTE</span>
                <h1 tabIndex={-1}>{trip.basics.title}</h1>
                <p>
                  {trip.basics.region} · {trip.basics.date}부터{" "}
                  {trip.basics.days}일 · 도시별 현지 시간
                </p>
              </div>
              <button className="secondary" onClick={() => navigate("parent")}>
                <Heart size={18} /> 부모님 모드
              </button>
            </div>
            <DemoBanner />
            <VenueFacts trip={trip} onTrip={t=>{setTrip(t);setProposal(null);}}/><AIAdvice key={`${trip.id}:${trip.revision}`} trip={trip}/><RouteLookup trip={trip} onTrip={t=>{setTrip(t);setProposal(null);}} cloudId={initialCloud?.id} accessToken={accessToken}/>
            <LibraryPanel trips={library} current={trip} onSelect={t=>{setTrip(t);setDay(1);setProposal(null);}}/>
            <div className="result-layout">
              <div className="schedule">
                <div className="timeline-toolbar">
                  <div className="day-tabs">
                    {Array.from({ length: trip.basics.days }, (_, i) => (
                      <button
                        key={i}
                        className={day === i + 1 ? "active" : ""}
                        onClick={() => setDay(i + 1)}
                      >
                        {i + 1}일차{" "}
                        <span>
                          {dayDate(trip.basics, i + 1)
                            .slice(5)
                            .replace("-", ".")}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setEdit(!edit)}
                  >
                    <NotebookPen size={16} />
                    {edit ? "편집 마치기" : "직접 수정"}
                  </button>
                </div>
                <p className="helper">{destinationFor(trip.basics,day)?.region??trip.basics.region} · {destinationFor(trip.basics,day)?.timezone??trip.basics.timezone} 현지 시간</p>
                {edit ? (
                  <Editor
                    items={trip.items}
                    days={trip.basics.days}
                    onChange={manualEdit}
                  />
                ) : (
                  <Timeline basics={trip.basics}
                    items={trip.items.filter((i) => i.day === day)}
                    report={report}
                  />
                )}
                <div className="schedule-actions">
                  <button
                    className="secondary"
                    onClick={() =>
                      setNotice(
                        `일정을 다시 점검했어요. ${statusLabels[report.status]} · ${report.issues.length}개 확인 항목`,
                      )
                    }
                  >
                    일정 점검하기
                  </button>
                  <button
                    className="text-button"
                    disabled={!trip.history.length}
                    onClick={() => {
                      setTrip(undo(trip));
                      setProposal(null);
                      setNotice(
                        "이전 일정으로 되돌렸습니다. 조건을 다시 점검했습니다.",
                      );
                    }}
                  >
                    <Undo2 size={16} /> 이전 일정으로 되돌리기
                  </button>
                </div>
                {trip.feedback.length > 0 && (
                  <div className="feedback-summary">
                    <h2>부모님이 남긴 이야기</h2>
                    {trip.feedback.map((f) => (
                      <p key={f.id}>
                        <Heart size={16} /> {f.text}
                      </p>
                    ))}
                    <p className="helper">
                      기존 일정을 바로 바꾸지 않습니다. 새 수정안에서 반영
                      결과를 확인하세요.
                    </p>
                    <button className="secondary" onClick={propose}>
                      의견을 반영한 수정안 보기
                    </button>
                  </div>
                )}
                <details className="conditions-detail">
                  <summary>입력한 조건 확인 및 변경</summary>
                  <ConditionCard c={trip.conditions} />
                  <button
                    className="secondary"
                    onClick={() => {
                      setC(trip.conditions);
                      setB(trip.basics);
                      setStep(0);
                      setExisting(true);
                      setImportItems(trip.items);
                      navigate("conditions");
                    }}
                  >
                    조건 수정 후 재점검
                  </button>
                </details>
              </div>
              <aside className="assessment">
                <span className="eyebrow">부모님의 보폭으로 살펴봤어요</span>
                <ReportView report={report} />
                <button className="primary full" onClick={propose}>
                  부모님 조건에 맞게 수정하기 <ArrowRight size={18} />
                </button>
                <p className="helper">
                  규칙 기반 점검 · 조건을 완화하지 않고 후보를 다시
                  조합합니다.
                </p>
                <div className="source-note">
                  <strong>판정의 범위를 확인해 주세요.</strong>
                  <p>
                    {trip.basics.mode==='demo'?'모든 수치와 시설 정보는 가상입니다.':'실제 자료의 시설·메뉴·내부 보행 정보는 미확인일 수 있습니다.'} 정보 부족은 충족으로
                    계산하지 않습니다. 실제 여행의 안전·편안함을 보증하지
                    않습니다.
                  </p>
                  <p>
                    확인된 전체 비용 {money(report.cost,trip.basics.currency)}<br />
                    숙박·지역 도착 비용 제외
                  </p>
                </div>
              </aside>
            </div>
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
            <span className="eyebrow">우리 가족의 여행</span>
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
            <section className="parent-check">
              <h2>떠나기 전에 함께 확인해요</h2>
              <p>{trip.basics.mode==='demo'?'이 일정은 가상 예시예요. 실제 여행에 사용하지 마세요.':'출발 전 미확인 시설·영업시간·동선을 직접 확인해 주세요.'}</p>
              {report.issues.map((i, n) => (
                <p key={n}>• {i.message}</p>
              ))}
              <p>
                음식 선호만 확인하며, 알레르기나 의료 식단을 판단하지 않아요.
              </p>
            </section>
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
        <AccountPanel/><FamilySync trip={trip} onTrip={t=>{setTrip(t);if(proposal){setProposal(null);if(screen==='compare'){navigate('result');setNotice('공유 일정이 갱신되어 수정안을 다시 만들어 주세요.');}}}} onOpen={()=>{setDay(1);navigate('result');}} initialCloud={initialCloud} accessToken={accessToken} hidden={screen!=='home'&&screen!=='result'}/>
      </main>
      <footer className="site-footer no-print">
        <div className="footer-brand">
          <Footprints size={20} />
          <strong>보폭.</strong>
          <span>함께 떠나는 여행, 서로의 속도로.</span>
        </div>
        <div className="footer-meta">
          <span>규칙 기반 점검 · 실제 도시 검색 · 서버 공유는 연결 후 사용</span>
          <span>
            로컬 기록은 같은 브라우저에 저장됩니다. 서버 저장·가족 링크는 서버 설정 후 사용할 수 있습니다.
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
  const {catalog}=useCatalog();if(catalog.mode==='real')return <div className="demo-banner"><Leaf size={18}/><div><strong>{catalog.sourceNotice}</strong><span>수집 {catalog.collectedAt??'미확인'} · 실제 소요 시간·계단·메뉴 확인이 필요합니다.</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 기여자 · ODbL</a></div></div>;
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
function ConditionCard({ c }: { c: Conditions }) {
  return (
    <div className="condition-card">
      <div className="condition-card-title">
        <Footprints size={24} />
        <h2>부모님 여행 조건 카드</h2>
      </div>
      <dl>
        <div>
          <dt>한 번에 걷기</dt>
          <dd>
            {c.maxWalkMin === null
              ? "시간 잘 모르겠어요"
              : `최대 ${c.maxWalkMin}분`}{" "}
            /{" "}
            {c.maxWalkM === null ? "거리 잘 모르겠어요" : `최대 ${c.maxWalkM}m`}
          </dd>
        </div>
        <div>
          <dt>쉬는 시간</dt>
          <dd>
            {c.restInterval === null
              ? "간격 잘 모르겠어요"
              : `${c.restInterval}분마다`}{" "}
            ·{" "}
            {c.restMin === null
              ? "길이 잘 모르겠어요"
              : `한 번에 ${c.restMin}분`}
          </dd>
        </div>
        <div>
          <dt>계단</dt>
          <dd>{c.avoidStairs ? "반드시 피하기" : "회피 조건 설정 안 함"}</dd>
        </div>
        <div>
          <dt>좋아하는 음식</dt>
          <dd>{c.foodLikes.join(", ") || "선택 안 함"}</dd>
        </div>
        <div>
          <dt>피할 음식</dt>
          <dd>{c.foodAvoids.join(", ") || "선택 안 함"}</dd>
        </div>
        <div>
          <dt>원하는 경험</dt>
          <dd>{c.experiences.join(", ") || "선택 안 함"}</dd>
        </div>
        <div>
          <dt>필수 경험</dt>
          <dd>{c.requiredExperiences.join(", ") || "선택 안 함"}</dd>
        </div>
        <div>
          <dt>피할 상황</dt>
          <dd>{c.avoidSituations.join(", ") || "선택 안 함"}</dd>
        </div>
        <div>
          <dt>늦어도 점심</dt>
          <dd>{c.latestLunch === null ? "설정 안 함" : time(c.latestLunch)}</dd>
        </div>
      </dl>
      <p>
        필수 조건: 걷기·휴식 수치, 계단 회피, 피할 음식·상황, 필수 경험, 점심
        마감, 예산.
        <br />
        정보가 없는 조건은 충족으로 판정하지 않습니다.
      </p>
    </div>
  );
}
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
                    {catalog.mode==='demo'?'보폭 가상 시연 데이터 v1 · 실제 조사 없음 · 가상 시나리오 설정':catalog.sourceNotice}
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
