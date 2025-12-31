const intakeForm = document.getElementById("intake-form");
const incomingList = document.getElementById("incoming-list");
const bucketBars = document.getElementById("bucket-bars");
const forecastGrid = document.getElementById("forecast-grid");
const loadPill = document.getElementById("load-pill");

const resultTitle = document.getElementById("result-title");
const resultSeverity = document.getElementById("result-severity");
const resultRoute = document.getElementById("result-route");
const resultWait = document.getElementById("result-wait");
const resultText = document.getElementById("result-explanation");
const resultFeatures = document.getElementById("result-features");
const resultQuestions = document.getElementById("result-questions");
const langSelect = document.getElementById("lang-select");
const i18nNodes = document.querySelectorAll("[data-i18n]");
const i18nPlaceholders = document.querySelectorAll("[data-i18n-placeholder]");
const mapStatus = document.getElementById("maps-status");
const mapContainer = document.getElementById("map");
const placesList = document.getElementById("places-list");
const locateBtn = document.getElementById("locate-btn");
const DASHBOARD_STORAGE_KEY = "dashboard_state";

let state = {
  cases: [
    {
      name: "Samuel P.",
      age: 68,
      symptoms: "Chest tightness, sweating, nausea while climbing stairs",
      severityScore: 5,
      severityLabel: "Critical",
      careRoute: "er",
      waitRange: "10-30",
      explanation: "Chest pain + exertional shortness of breath flagged for ER evaluation.",
    },
    {
      name: "Maya L.",
      age: 31,
      symptoms: "High fever, body aches, green sputum cough for 4 days",
      severityScore: 3,
      severityLabel: "Moderate",
      careRoute: "urgent_care",
      waitRange: "30-60",
      explanation: "Persistent fever with productive cough; needs in-person assessment today.",
    },
    {
      name: "Dylan R.",
      age: 24,
      symptoms: "Rash on forearms, no fever, mild itch",
      severityScore: 2,
      severityLabel: "Low",
      careRoute: "telehealth",
      waitRange: "5-20",
      explanation: "Stable vitals and localized rash suitable for virtual care.",
    },
  ],
  forecast: {
    predictedLoadNextHour: { er: 10, urgent_care: 8, telehealth: 5 },
  },
};

let sharedSBAR = "";
let clarifyState = { answers: {}, sending: false, done: false, message: "" };

const savedDashboard = loadSavedDashboardState();
if (savedDashboard?.cases?.length) {
  state = {
    cases: savedDashboard.cases,
    forecast: savedDashboard.forecast || state.forecast,
  };
  sharedSBAR = savedDashboard.lastSBAR || "";
}

const mapState = {
  map: null,
  markers: [],
  ready: false,
  lastLocation: null,
  locateBound: false,
};

let lastTriage = null;

const translations = {
  en: {
    eyebrow_intake: "Patient Intake",
    headline: "Turn messy symptoms into clear routing",
    lede: "Enter the patient’s story, vitals, or notes. Gemini structures the signal, scores severity, and routes to ER, urgent care, or telehealth with a calm rationale.",
    language_label: "Language",
    label_name: "Name",
    label_age: "Age",
    label_sex: "Sex",
    label_duration: "Duration",
    label_symptoms: "Symptoms / story",
    label_vitals: "Vitals (BP, HR, SpO2)",
    label_history: "History / meds",
    ph_name: "Jane Doe",
    ph_age: "34",
    ph_sex: "Female",
    ph_duration: "3 hours",
    ph_symptoms: "Example: Woke up with crushing chest tightness, nausea, short of breath when walking.",
    ph_vitals: "BP 150/95, HR 110, SpO2 93%",
    ph_history: "Hypertension, on lisinopril",
    cta_run: "Run triage",
    eyebrow_result: "AI Triage",
    result_waiting_title: "Waiting for input...",
    result_waiting_body: "Submit an intake to see routing, wait range, and why Gemini flagged it.",
    loading_title: "Scoring...",
    loading_body: "Consulting Gemini for structured triage.",
    triage_failed_title: "Triage failed",
    triage_failed_body: "Could not complete triage:",
    clarifying_title: "Clarifying questions to tighten severity:",
    clarifying_empty: "No clarifying questions returned.",
    clarifying_status_wait: "Answer yes/no so Gemini can tighten severity.",
    clarifying_status_done: "Sent to Gemini; severity updated if needed.",
    clarifying_cta_send: "Send answers to Gemini",
    clarifying_cta_sending: "Sending...",
    map_eyebrow: "Local routing",
    map_title: "Find your nearest hospital",
    map_lede: "Use OpenStreetMap data to jump to nearby hospitals and send patients the fastest route.",
    map_cta: "Use my location",
    map_list_title: "Hospitals nearby",
    map_list_hint: 'Tap "Use my location" to search within ~10km.',
    map_loading: "Loading map...",
    map_lib_failed: "Map library failed to load",
    map_ready: "Map ready — use your location",
    map_not_ready: "Map unavailable or still initializing",
    map_geo_missing: "Geolocation unavailable in this browser",
    map_https: "Enable HTTPS to use location",
    map_requesting: "Requesting your location...",
    map_searching: "Searching nearby hospitals...",
    map_search_hint: "Searching within ~10km...",
    map_none: "No hospitals found nearby",
    map_none_hint: "No hospitals found within ~10km.",
    map_search_failed: "Search failed",
    map_search_failed_detail: "Search failed: {error}",
    map_found: "Found {count} nearby",
    map_place_no_phone: "No phone listed",
    map_directions: "Directions",
    map_distance: "{km} km away",
    geo_blocked: "Location was blocked. Allow access to search nearby hospitals.",
    geo_unavailable: "Location unavailable. Check signal or try again.",
    geo_timeout: "Location timed out. Try again.",
    geo_error: "Could not access location.",
  },
  es: {
    eyebrow_intake: "Ingreso de pacientes",
    headline: "Convierte síntomas confusos en una ruta clara",
    lede: "Ingresa la historia, signos vitales o notas. Gemini estructura la información, puntúa la gravedad y dirige a urgencias, cuidado urgente o telemedicina con una explicación calmada.",
    language_label: "Idioma",
    label_name: "Nombre",
    label_age: "Edad",
    label_sex: "Sexo",
    label_duration: "Duración",
    label_symptoms: "Síntomas / historia",
    label_vitals: "Signos vitales (PA, FC, SpO2)",
    label_history: "Antecedentes / medicamentos",
    ph_name: "Jane Doe",
    ph_age: "34",
    ph_sex: "Femenino",
    ph_duration: "3 horas",
    ph_symptoms: "Ej: Despertó con opresión en el pecho, náuseas, falta de aire al caminar.",
    ph_vitals: "PA 150/95, FC 110, SpO2 93%",
    ph_history: "Hipertensión, en lisinopril",
    cta_run: "Ejecutar triaje",
    eyebrow_result: "Triaje AI",
    result_waiting_title: "Esperando datos...",
    result_waiting_body: "Envía el ingreso para ver la ruta, el rango de espera y la explicación.",
    loading_title: "Calculando...",
    loading_body: "Consultando a Gemini para un triaje estructurado.",
    triage_failed_title: "Triaje falló",
    triage_failed_body: "No se pudo completar el triaje:",
    clarifying_title: "Preguntas para afinar la gravedad:",
    clarifying_empty: "No se devolvieron preguntas aclaratorias.",
    clarifying_status_wait: "Responde sí/no para que Gemini ajuste la gravedad.",
    clarifying_status_done: "Enviado a Gemini; gravedad ajustada si era necesario.",
    clarifying_cta_send: "Enviar respuestas a Gemini",
    clarifying_cta_sending: "Enviando...",
    map_eyebrow: "Enrutamiento local",
    map_title: "Encuentra tu hospital más cercano",
    map_lede: "Usa datos de OpenStreetMap para saltar a los hospitales cercanos y enviar la ruta más rápida.",
    map_cta: "Usar mi ubicación",
    map_list_title: "Hospitales cercanos",
    map_list_hint: 'Toca "Usar mi ubicación" para buscar dentro de ~10km.',
    map_loading: "Cargando mapa...",
    map_lib_failed: "Error al cargar la librería del mapa",
    map_ready: "Mapa listo — usa tu ubicación",
    map_not_ready: "Mapa no disponible o iniciando",
    map_geo_missing: "Geolocalización no disponible en este navegador",
    map_https: "Habilita HTTPS para usar ubicación",
    map_requesting: "Solicitando tu ubicación...",
    map_searching: "Buscando hospitales cercanos...",
    map_search_hint: "Buscando dentro de ~10km...",
    map_none: "No se encontraron hospitales cercanos",
    map_none_hint: "No hay hospitales dentro de ~10km.",
    map_search_failed: "Búsqueda falló",
    map_search_failed_detail: "Búsqueda falló: {error}",
    map_found: "Se encontraron {count} cercanos",
    map_place_no_phone: "Sin teléfono listado",
    map_directions: "Cómo llegar",
    map_distance: "{km} km de distancia",
    geo_blocked: "La ubicación fue bloqueada. Permite acceso para buscar hospitales.",
    geo_unavailable: "Ubicación no disponible. Revisa la señal o intenta de nuevo.",
    geo_timeout: "La ubicación tardó demasiado. Intenta de nuevo.",
    geo_error: "No se pudo acceder a la ubicación.",
  },
  zh: {
    eyebrow_intake: "患者分诊",
    headline: "将混乱症状转化为清晰分诊路径",
    lede: "输入病情描述、生命体征或备注。Gemini 提取要点、评估严重度，并给出急诊/急救/远程的路线和理由。",
    language_label: "语言",
    label_name: "姓名",
    label_age: "年龄",
    label_sex: "性别",
    label_duration: "病程",
    label_symptoms: "症状 / 描述",
    label_vitals: "生命体征 (血压, 心率, 血氧)",
    label_history: "病史 / 用药",
    ph_name: "张三",
    ph_age: "34",
    ph_sex: "女性",
    ph_duration: "3 小时",
    ph_symptoms: "例：醒来时胸口压迫感，恶心，走路时气短。",
    ph_vitals: "血压150/95，心率110，血氧93%",
    ph_history: "高血压，服用降压药",
    cta_run: "开始分诊",
    eyebrow_result: "AI 分诊",
    result_waiting_title: "等待输入...",
    result_waiting_body: "提交信息以查看路线、等待范围和原因。",
    loading_title: "正在评分...",
    loading_body: "向 Gemini 请求结构化分诊。",
    triage_failed_title: "分诊失败",
    triage_failed_body: "无法完成分诊：",
    clarifying_title: "澄清问题（细化严重度）：",
    clarifying_empty: "没有返回澄清问题。",
    clarifying_status_wait: "请回答是/否，以便 Gemini 细化严重度。",
    clarifying_status_done: "已发送给 Gemini；如需已调整严重度。",
    clarifying_cta_send: "发送回答给 Gemini",
    clarifying_cta_sending: "发送中...",
    map_eyebrow: "本地路线",
    map_title: "寻找最近的医院",
    map_lede: "使用 OpenStreetMap 数据快速找到附近医院并发送最快路线。",
    map_cta: "使用我的位置",
    map_list_title: "附近的医院",
    map_list_hint: "点击“使用我的位置”搜索 ~10 公里内。",
    map_loading: "地图加载中...",
    map_lib_failed: "地图库加载失败",
    map_ready: "地图已就绪 — 使用你的位置",
    map_not_ready: "地图不可用或仍在初始化",
    map_geo_missing: "浏览器不支持地理位置",
    map_https: "请在 HTTPS 下启用定位",
    map_requesting: "正在请求你的位置...",
    map_searching: "正在搜索附近医院...",
    map_search_hint: "正在搜索约 10 公里范围内...",
    map_none: "附近没有找到医院",
    map_none_hint: "在 ~10 公里内未找到医院。",
    map_search_failed: "搜索失败",
    map_search_failed_detail: "搜索失败：{error}",
    map_found: "找到 {count} 个附近地点",
    map_place_no_phone: "没有电话号码",
    map_directions: "路线",
    map_distance: "{km} 公里外",
    geo_blocked: "位置被阻止。允许访问以搜索附近医院。",
    geo_unavailable: "位置不可用。检查信号或重试。",
    geo_timeout: "定位超时。请再试一次。",
    geo_error: "无法获取位置。",
  },
  ar: {
    eyebrow_intake: "استقبال المرضى",
    headline: "حوّل الأعراض غير الواضحة إلى مسار رعاية واضح",
    lede: "أدخل القصة أو العلامات الحيوية أو الملاحظات. Gemini يرتب الإشارات، يقيّم الشدة، ويوجه إلى الطوارئ أو الرعاية العاجلة أو الطب عن بُعد مع توضيح هادئ.",
    language_label: "اللغة",
    label_name: "الاسم",
    label_age: "العمر",
    label_sex: "الجنس",
    label_duration: "المدة",
    label_symptoms: "الأعراض / القصة",
    label_vitals: "العلامات الحيوية (ضغط، نبض، أكسجة)",
    label_history: "التاريخ الطبي / الأدوية",
    ph_name: "فلان",
    ph_age: "34",
    ph_sex: "أنثى",
    ph_duration: "3 ساعات",
    ph_symptoms: "مثال: استيقظ على ألم ضاغط في الصدر مع غثيان وضيق نفس عند المشي.",
    ph_vitals: "ضغط 150/95، نبض 110، أكسجة 93%",
    ph_history: "ارتفاع ضغط، يتناول دواءً خافضاً",
    cta_run: "بدء الفرز",
    eyebrow_result: "الفرز الآلي",
    result_waiting_title: "بانتظار البيانات...",
    result_waiting_body: "أرسل البيانات لرؤية المسار، زمن الانتظار، وسبب التوجيه.",
    loading_title: "جارٍ التقييم...",
    loading_body: "يتم سؤال Gemini لفرز مُنظم.",
    triage_failed_title: "فشل الفرز",
    triage_failed_body: "تعذر إتمام الفرز:",
    clarifying_title: "أسئلة توضيحية لتدقيق الشدة:",
    clarifying_empty: "لا توجد أسئلة توضيحية.",
    clarifying_status_wait: "أجب بنعم/لا ليتمكن Gemini من تدقيق الشدة.",
    clarifying_status_done: "أُرسلت إلى Gemini؛ تم تعديل الشدة إن لزم.",
    clarifying_cta_send: "إرسال الإجابات إلى Gemini",
    clarifying_cta_sending: "جارٍ الإرسال...",
    map_eyebrow: "التوجيه المحلي",
    map_title: "ابحث عن أقرب مستشفى",
    map_lede: "استخدم بيانات OpenStreetMap للقفز إلى المستشفيات القريبة وإرسال أسرع مسار.",
    map_cta: "استخدام موقعي",
    map_list_title: "مستشفيات قريبة",
    map_list_hint: 'اضغط "استخدام موقعي" للبحث ضمن ~10 كم.',
    map_loading: "يتم تحميل الخريطة...",
    map_lib_failed: "فشل تحميل مكتبة الخريطة",
    map_ready: "الخريطة جاهزة — استخدم موقعك",
    map_not_ready: "الخريطة غير متاحة أو ما زالت تبدأ",
    map_geo_missing: "المتصفح لا يدعم تحديد الموقع",
    map_https: "فعّل HTTPS لاستخدام الموقع",
    map_requesting: "يتم طلب موقعك...",
    map_searching: "جاري البحث عن مستشفيات قريبة...",
    map_search_hint: "بحث ضمن ~10 كم...",
    map_none: "لا توجد مستشفيات قريبة",
    map_none_hint: "لم يتم العثور على مستشفيات ضمن ~10 كم.",
    map_search_failed: "فشل البحث",
    map_search_failed_detail: "فشل البحث: {error}",
    map_found: "تم العثور على {count} قريبة",
    map_place_no_phone: "لا يوجد هاتف مسجّل",
    map_directions: "الاتجاهات",
    map_distance: "{km} كم بعيدًا",
    geo_blocked: "تم حظر الموقع. اسمح بالوصول للبحث عن مستشفيات قريبة.",
    geo_unavailable: "الموقع غير متاح. تحقق من الإشارة أو أعد المحاولة.",
    geo_timeout: "انتهت مهلة تحديد الموقع. حاول مرة أخرى.",
    geo_error: "تعذر الوصول إلى الموقع.",
  },
};

let currentLang = localStorage.getItem("lang") || "en";

function applyLanguage(lang) {
  currentLang = translations[lang] ? lang : "en";
  const dict = translations[currentLang];
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

  i18nNodes.forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });

  i18nPlaceholders.forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key]) el.placeholder = dict[key];
  });

  if (langSelect && langSelect.value !== currentLang) {
    langSelect.value = currentLang;
  }

  if (resultSeverity?.textContent === "-" && resultRoute?.textContent === "-") {
    if (resultTitle) resultTitle.textContent = t("result_waiting_title");
    if (resultText) resultText.textContent = t("result_waiting_body");
  }

  if (mapStatus?.dataset.key) {
    let vars = {};
    try {
      vars = mapStatus.dataset.vars ? JSON.parse(mapStatus.dataset.vars) : {};
    } catch (err) {
      vars = {};
    }
    setMapStatus(mapStatus.dataset.key, mapStatus.dataset.tone || "", vars);
  }

  localStorage.setItem("lang", currentLang);
}

if (langSelect) {
  langSelect.addEventListener("change", (e) => applyLanguage(e.target.value));
}

applyLanguage(currentLang);
renderAll();
bindLocateButton();
initMapsSection();

intakeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(intakeForm);
  const payload = {
    name: form.get("name") || "Unnamed patient",
    age: form.get("age") ? Number(form.get("age")) : undefined,
    sex: form.get("sex") || "",
    duration: form.get("duration") || "",
    symptoms: form.get("symptoms"),
    vitals: form.get("vitals"),
    history: form.get("history"),
  };

  setResultLoading();

  try {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Server error");
    }

    const data = await res.json();
    const triage = data.triage;

    state.cases.unshift({
      name: payload.name,
      age: payload.age,
      sex: payload.sex,
      duration: payload.duration,
      symptoms: payload.symptoms,
      severityScore: triage.severityScore,
      severityLabel: triage.severityLabel,
      careRoute: triage.careRoute,
      waitRange: triage.waitRange,
      explanation: triage.explanation,
      extractedFeatures: triage.extractedFeatures,
      history: payload.history,
      vitals: payload.vitals,
      sbar: buildSBAR(triage),
    });

    state.cases.length = Math.min(state.cases.length, 12);
    state.forecast = data.forecast || state.forecast;

    lastTriage = triage;
    renderResult(triage);
    renderSBAR(triage);
    persistDashboardState();
    renderAll();
  } catch (err) {
    renderError(err.message);
  }
});

function renderAll() {
  if (incomingList || bucketBars || forecastGrid) {
    renderIncoming();
    renderBuckets();
    renderForecast();
  }
}

function renderIncoming() {
  if (!incomingList) return;
  incomingList.innerHTML = "";
  state.cases.slice(0, 6).forEach((c) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div class="title">${c.name} ${c.age ? `• ${c.age}` : ""}</div>
        <div class="meta-line">${c.symptoms}</div>
        <div class="meta-line">${c.explanation}</div>
      </div>
      <div class="align-end">
        <div class="badge ${c.careRoute}">${routeLabel(c.careRoute)}</div>
        <div class="meta-line">${c.severityLabel} • ${c.waitRange} mins</div>
      </div>
    `;
    incomingList.appendChild(div);
  });
}

function renderBuckets() {
  if (!bucketBars) return;
  bucketBars.innerHTML = "";
  const counts = { er: 0, urgent_care: 0, telehealth: 0 };

  state.cases.forEach((c) => {
    counts[c.careRoute] = (counts[c.careRoute] || 0) + 1;
  });

  [
    { key: "er", label: "Critical (ER)" },
    { key: "urgent_care", label: "Urgent" },
    { key: "telehealth", label: "Telehealth" },
  ].forEach((row) => {
    const total = Math.max(...Object.values(counts), 1);
    const pct = Math.round((counts[row.key] / total) * 100);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `
      <div class="bar-label">
        <span>${row.label}</span>
        <span>${counts[row.key]} cases</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%"></div>
      </div>
    `;
    bucketBars.appendChild(bar);
  });
}

function renderForecast() {
  if (!forecastGrid) return;
  forecastGrid.innerHTML = "";
  const load = state.forecast?.predictedLoadNextHour || {};
  const order = [
    { key: "er", label: "ER" },
    { key: "urgent_care", label: "Urgent Care" },
    { key: "telehealth", label: "Telehealth" },
  ];

  order.forEach((row) => {
    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="label">${row.label}</div>
      <div class="value">${load[row.key] ?? "—"}</div>
      <div class="small">predicted visits</div>
    `;
    forecastGrid.appendChild(card);
  });

  const sum = Object.values(load).filter(Boolean).reduce((a, b) => a + b, 0);
  if (loadPill) {
    loadPill.textContent = sum ? `Load: ${sum} predicted next hour` : "Predicted load updating";
  }
}

function renderResult(triage, { preserveClarify = false } = {}) {
  if (!triage) return;
  if (!preserveClarify) clarifyState = { answers: {}, sending: false, done: false, message: "" };
  resultTitle.textContent = `${triage.patient.name || "New patient"} • Severity ${triage.severityScore}`;
  resultSeverity.textContent = triage.severityLabel;
  resultRoute.textContent = routeLabel(triage.careRoute);
  resultWait.textContent = `${triage.waitRange} mins`;
  resultText.textContent = triage.explanation;

  resultSeverity.className = `pill ${severityClass(triage.severityScore)}`;
  resultRoute.className = `pill ${triage.careRoute}`;
  resultWait.className = "pill ghost";

  resultFeatures.innerHTML = "";
  resultQuestions.innerHTML = "";

  const extracted = triage.extractedFeatures || {};
  const featureEntries = Object.entries(extracted);

  if (!featureEntries.length) {
    resultFeatures.innerHTML = `<div class="feature"><div class="label">Signals</div><div class="value">No structured features returned.</div></div>`;
  } else {
    featureEntries.forEach(([key, value]) => {
      const block = document.createElement("div");
      block.className = "feature";
      block.innerHTML = `<div class="label">${key}</div><div class="value">${formatValue(value)}</div>`;
      resultFeatures.appendChild(block);
    });
  }

  renderClarifyingQuestions(triage);
  renderSBAR(triage);
}

function setResultLoading() {
  resultTitle.textContent = t("loading_title");
  resultSeverity.textContent = "—";
  resultRoute.textContent = "—";
  resultWait.textContent = "—";
  resultText.textContent = t("loading_body");
  resultFeatures.innerHTML = "";
  resultQuestions.innerHTML = "";
}

function renderError(message) {
  resultTitle.textContent = t("triage_failed_title");
  resultSeverity.textContent = "—";
  resultRoute.textContent = "—";
  resultWait.textContent = "—";
  resultText.textContent = `${t("triage_failed_body")} ${message}`;
  resultFeatures.innerHTML = "";
  resultQuestions.innerHTML = "";
}

function routeLabel(route) {
  if (route === "er") return "ER";
  if (route === "urgent_care") return "Urgent Care";
  return "Telehealth";
}

function severityClass(score) {
  if (score >= 4) return "severity-high";
  if (score === 3) return "severity-med";
  return "severity-low";
}

function t(key, vars = {}) {
  const dict = translations[currentLang] || translations.en;
  const base = dict[key] || translations.en[key];
  if (!base) return key;
  return base.replace(/\{(\w+)\}/g, (match, token) => {
    if (token in vars) return vars[token];
    return match;
  });
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function renderClarifyingQuestions(triage) {
  if (!resultQuestions) return;
  resultQuestions.innerHTML = "";
  const questions = Array.isArray(triage?.clarifyingQuestions)
    ? triage.clarifyingQuestions.filter(Boolean).slice(0, 3)
    : [];

  if (!questions.length) {
    resultQuestions.innerHTML = `<div class="question-item">${t("clarifying_empty")}</div>`;
    return;
  }

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = t("clarifying_title");
  resultQuestions.appendChild(title);

  const status = document.createElement("div");
  status.className = "meta-line clarifying-status";
  status.textContent = t("clarifying_status_wait");
  resultQuestions.appendChild(status);

  questions.forEach((q, idx) => {
    const row = document.createElement("div");
    row.className = "question-item interactive";
    const text = document.createElement("div");
    text.className = "question-text";
    text.textContent = q;

    const controls = document.createElement("div");
    controls.className = "answer-controls";

    ["yes", "no"].forEach((choice) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-pill ghost-btn small";
      btn.textContent = choice === "yes" ? "Yes" : "No";
      btn.dataset.questionIndex = idx;
      btn.dataset.choice = choice;
      if (clarifyState.answers[idx] === (choice === "yes")) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", () => handleClarifyAnswer(triage, questions, idx, choice === "yes"));
      controls.appendChild(btn);
    });

    row.appendChild(text);
    row.appendChild(controls);
    resultQuestions.appendChild(row);
  });

  if (clarifyState.sending) {
    status.textContent = t("clarifying_cta_sending");
  } else if (clarifyState.done) {
    status.textContent = t("clarifying_status_done");
  }
  if (clarifyState.message) {
    status.textContent = clarifyState.message;
  }
}

function setClarifyAnswer(index, value) {
  clarifyState.answers = { ...clarifyState.answers, [index]: value };
}

function handleClarifyAnswer(triage, questions, index, value) {
  setClarifyAnswer(index, value);
  renderClarifyingQuestions(triage);
  submitClarifyingAnswers(questions, triage);
}

async function submitClarifyingAnswers(questions, triage) {
  if (!triage || clarifyState.sending) return;
  clarifyState.sending = true;
  clarifyState.done = false;
  clarifyState.message = "";
  renderClarifyingQuestions(triage);
  try {
    const payload = {
      symptoms: triage.patient?.symptoms,
      clarifyingQuestions: questions,
      answers: clarifyState.answers,
      baseSeverity: triage.severityScore,
      baseRoute: triage.careRoute,
      baseWaitRange: triage.waitRange,
      patient: triage.patient,
    };

    const res = await fetch("/api/clarify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Clarify error");
    }

    const data = await res.json();
    const updated = data.triage || {};
    const merged = {
      ...triage,
      severityScore: updated.severityScore ?? triage.severityScore,
      severityLabel: updated.severityLabel ?? triage.severityLabel,
      careRoute: updated.careRoute ?? triage.careRoute,
      waitRange: updated.waitRange ?? triage.waitRange,
      explanation: updated.explanation || triage.explanation,
    };

    lastTriage = merged;
    state.cases[0] = {
      ...(state.cases[0] || {}),
      severityScore: merged.severityScore,
      severityLabel: merged.severityLabel,
      careRoute: merged.careRoute,
      waitRange: merged.waitRange,
      explanation: merged.explanation,
      sbar: buildSBAR(merged),
    };
    clarifyState.sending = false;
    clarifyState.done = true;
    clarifyState.message = "";
    renderResult(merged, { preserveClarify: true });
    renderSBAR(merged);
    persistDashboardState();
    renderAll();
  } catch (err) {
    // Fall back client-side so UX isn't blocked if clarify API is unreachable.
    const fallback = fallbackClarifyClient(triage, clarifyState.answers);
    const merged = {
      ...triage,
      severityScore: fallback.severityScore,
      severityLabel: fallback.severityLabel,
      careRoute: fallback.careRoute,
      waitRange: fallback.waitRange,
      explanation: fallback.explanation,
    };
    lastTriage = merged;
    state.cases[0] = {
      ...(state.cases[0] || {}),
      severityScore: merged.severityScore,
      severityLabel: merged.severityLabel,
      careRoute: merged.careRoute,
      waitRange: merged.waitRange,
      explanation: merged.explanation,
      sbar: buildSBAR(merged),
    };
    clarifyState.sending = false;
    clarifyState.done = true;
    clarifyState.message = "Clarify service unavailable; used local fallback.";
    renderResult(merged, { preserveClarify: true });
    renderSBAR(merged);
    persistDashboardState();
    renderAll();
  }
}

function fallbackClarifyClient(triage, answers) {
  const yesCount = Object.values(answers || {}).filter(Boolean).length;
  const severityScore = clamp((triage?.severityScore || 2) + yesCount, 1, 5);
  const careRoute = routeFromSeverity(severityScore);
  const waitRange = waitRangeFor(careRoute, severityScore);
  const explanation =
    yesCount > 0
      ? `Follow-up answers increased concern (${yesCount} yes). Severity adjusted locally.`
      : "Clarify service unavailable; keeping prior severity.";
  return {
    severityScore,
    severityLabel: severityLabel(severityScore),
    careRoute,
    waitRange,
    explanation,
  };
}

function renderSBAR(triage) {
  if (!triage) {
    sharedSBAR = "";
    persistDashboardState();
    return;
  }
  const sbarString = buildSBAR(triage);
  sharedSBAR = sbarString;
  persistDashboardState();
}

function buildSBAR(triage) {
  const patient = triage.patient || {};
  const age = patient.age ? `${patient.age}-year-old` : "Age not provided";
  const sex = patient.sex || "sex not provided";
  const duration = patient.duration || "unspecified duration";
  const chief = patient.symptoms || "No chief complaint provided";
  const vitals = describeVitals(patient.vitals);
  const history = patient.history || "Not provided";
  const severityLine = `Severity labeled ${triage.severityLabel} (route: ${routeLabel(triage.careRoute)}, wait ${triage.waitRange} mins).`;

  const features = triage.extractedFeatures || {};
  const featureSummary = Object.keys(features).length
    ? Object.entries(features)
        .map(([k, v]) => `${k}: ${formatValue(v)}`)
        .join("; ")
    : "";

  const clarifying = Array.isArray(triage.clarifyingQuestions) ? triage.clarifyingQuestions.filter(Boolean) : [];
  const clarifyingLine = clarifying.length ? clarifying.join(" | ") : "None provided";

  return [
    `Situation: ${age} ${sex} presenting with ${chief} for ${duration}.`,
    `Background: Vitals ${vitals}. History: ${history}.`,
    `Assessment: ${severityLine} ${triage.explanation || ""}${featureSummary ? ` Key signals: ${featureSummary}.` : ""}`,
    `Recommendation: Route to ${routeLabel(triage.careRoute)}; monitor for escalation. Clarifying Qs: ${clarifyingLine}.`,
  ].join("\n");
}

function describeVitals(vitals) {
  if (!vitals) return "not provided";
  if (typeof vitals === "string") return vitals || "not provided";
  if (typeof vitals === "object") {
    const entries = Object.entries(vitals).map(([k, v]) => `${k}: ${v}`);
    return entries.length ? entries.join(", ") : "not provided";
  }
  return String(vitals);
}

function loadSavedDashboardState() {
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function persistDashboardState() {
  try {
    localStorage.setItem(
      DASHBOARD_STORAGE_KEY,
      JSON.stringify({
        cases: state.cases,
        forecast: state.forecast,
        lastSBAR: sharedSBAR || "",
      })
    );
  } catch (err) {
    // ignore
  }
}

async function initMapsSection() {
  if (!mapStatus || !mapContainer || !placesList) return;

  setMapStatus("map_loading", "ghost");
  if (locateBtn) locateBtn.disabled = true;

  if (!window.L) {
    setMapStatus("map_lib_failed", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  mapState.map = L.map(mapContainer, { zoomControl: true }).setView(
    { lat: 37.773972, lng: -122.431297 },
    12
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapState.map);

  mapState.ready = true;
  setMapStatus("map_ready", "ghost");
  mapContainer.querySelector(".map-placeholder")?.remove();
  if (locateBtn) locateBtn.disabled = false;

  setTimeout(() => mapState.map.invalidateSize(), 200);
}

function requestLocation() {
  if (!mapState.map || !mapState.ready) {
    setMapStatus("map_not_ready", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  if (!navigator.geolocation) {
    setMapStatus("map_geo_missing", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  if (!window.isSecureContext && !location.hostname.includes("localhost")) {
    setMapStatus("map_https", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  setMapStatus("map_requesting", "ghost");
  if (locateBtn) locateBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (locateBtn) locateBtn.disabled = false;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      mapState.lastLocation = coords;
      mapState.map.setView(coords, 13);
      searchHospitals(coords);
    },
    (err) => {
      console.warn("Geolocation blocked", err);
      const geoKey = geoErrorMessage(err);
      setMapStatus(geoKey, "muted");
      placesList.innerHTML = `<div class="meta-line">${t(geoKey)}</div>`;
      if (locateBtn) locateBtn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function bindLocateButton() {
  if (!locateBtn || mapState.locateBound) return;
  locateBtn.addEventListener("click", requestLocation);
  mapState.locateBound = true;
}

async function searchHospitals(origin) {
  setMapStatus("map_searching", "ghost");
  placesList.innerHTML = `<div class="meta-line">${t("map_search_hint")}</div>`;
  clearMarkers();

  const query = `[out:json];
    (
      node["amenity"="hospital"](around:10000,${origin.lat},${origin.lng});
      way["amenity"="hospital"](around:10000,${origin.lat},${origin.lng});
      relation["amenity"="hospital"](around:10000,${origin.lat},${origin.lng});
    );
    out center tags;`;

  try {
    const data = await fetchHospitals(query);
    const places =
      data.elements
        ?.map((el) => {
          const tags = el.tags || {};
          const coords =
            el.type === "node"
              ? { lat: el.lat, lon: el.lon }
              : el.center
              ? { lat: el.center.lat, lon: el.center.lon }
              : null;
          if (!coords?.lat || !coords?.lon) return null;
          const distanceKm = origin ? haversineKm(origin, { lat: coords.lat, lng: coords.lon }) : null;
          return {
            name: tags.name || "Hospital",
            address: formatAddress(tags),
            phone: tags.phone || tags["contact:phone"] || "",
            lat: coords.lat,
            lon: coords.lon,
            distanceKm,
          };
        })
        .filter(Boolean) || [];

    if (!places.length) {
      setMapStatus("map_none", "muted");
      placesList.innerHTML = `<div class="meta-line">${t("map_none_hint")}</div>`;
      return;
    }

    const sorted = places
      .filter((p) => typeof p.distanceKm === "number")
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .concat(places.filter((p) => p.distanceKm === null));

    const limited = sorted.slice(0, 10);
    limited.forEach((place) => {
      const directionsUrl = origin ? buildDirectionsLink(origin, place) : null;
      const popupHtml = [
        `<strong>${escapeHtml(place.name)}</strong>`,
        escapeHtml(place.address),
        directionsUrl ? `<a href="${directionsUrl}" target="_blank" rel="noopener">Directions</a>` : "",
      ]
        .filter(Boolean)
        .join("<br>");

      const marker = L.marker([place.lat, place.lon], { title: place.name })
        .addTo(mapState.map)
        .bindPopup(popupHtml);
      mapState.markers.push(marker);
    });

    const bounds = L.latLngBounds(limited.map((p) => [p.lat, p.lon]));
    mapState.map.fitBounds(bounds, { padding: [20, 20] });

    renderPlaces(limited, origin);
    setMapStatus("map_found", "online", { count: limited.length });
  } catch (err) {
    console.error("Hospital search failed", err);
    setMapStatus("map_search_failed", "muted");
    placesList.innerHTML = `<div class="meta-line">${t("map_search_failed_detail", { error: err.message })}</div>`;
  }
}

function renderPlaces(places, origin) {
  placesList.innerHTML = "";
  places.forEach((place) => {
    const distanceKm = origin ? haversineKm(origin, { lat: place.lat, lng: place.lon }) : place.distanceKm;
    const contact = place.phone ? place.phone : t("map_place_no_phone");
    const directionsUrl = origin ? buildDirectionsLink(origin, place) : null;

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="title">${escapeHtml(place.name)}</div>
      <div class="meta-line">${escapeHtml(place.address)}</div>
      <div class="meta-line">${escapeHtml(contact)}</div>
      ${distanceKm ? `<div class="distance">${t("map_distance", { km: distanceKm.toFixed(1) })}</div>` : ""}
      ${directionsUrl ? `<a class="meta-line" href="${directionsUrl}" target="_blank" rel="noopener">${t("map_directions")}</a>` : ""}
    `;
    placesList.appendChild(item);
  });
}

function clearMarkers() {
  mapState.markers.forEach((m) => {
    if (m.remove) {
      m.remove();
    } else if (m.setMap) {
      m.setMap(null);
    }
  });
  mapState.markers = [];
}

function setMapStatus(textOrKey, tone, vars = {}) {
  if (!mapStatus) return;
  const text = t(textOrKey, vars);
  mapStatus.textContent = text;
  mapStatus.dataset.key = textOrKey;
  mapStatus.dataset.tone = tone || "";
  mapStatus.dataset.vars = vars && Object.keys(vars).length ? JSON.stringify(vars) : "";
  mapStatus.className = tone ? `pill ${tone}` : "pill";
}

async function fetchHospitals(query) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let lastError = null;

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("All Overpass endpoints failed");
}

function buildDirectionsLink(origin, place) {
  if (!origin || !place) return null;
  const oLat = origin.lat.toFixed(6);
  const oLng = origin.lng.toFixed(6);
  const dLat = place.lat.toFixed(6);
  const dLng = place.lon.toFixed(6);
  return `https://www.openstreetmap.org/directions?engine=graphhopper_car&route=${oLat},${oLng};${dLat},${dLng}`;
}

function formatAddress(tags = {}) {
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:place"];
  const parts = [tags["addr:housenumber"], tags["addr:street"], city, tags["addr:state"]];
  const address = parts.filter(Boolean).join(", ");
  return address || tags.address || "Address unavailable";
}

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function geoErrorMessage(err) {
  if (!err || typeof err.code !== "number") return "geo_error";
  if (err.code === err.PERMISSION_DENIED) return "geo_blocked";
  if (err.code === err.POSITION_UNAVAILABLE) return "geo_unavailable";
  if (err.code === err.TIMEOUT) return "geo_timeout";
  return "geo_error";
}
