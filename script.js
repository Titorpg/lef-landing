// LEF landing — i18n (EN/ES) + reveal-on-scroll + WhatsApp links
// WhatsApp number confirmed from the live production site (lefcenter.com,
// multiple wa.me links in the raw page HTML): +57 300 123 4567.
const WHATSAPP_NUMBER = "573001234567";

const I18N = {
  en: {
    nav_what: "About LEF",
    nav_levels: "Levels",
    nav_system: "Learning system",
    nav_offer: "What we offer",
    nav_evaluation: "Evaluation",
    nav_enroll: "Enroll",
    hero_tag: "Online English Academy · Barranquilla, Colombia",
    hero_h1_1: "Speak English",
    hero_h1_2: "with a plan.",
    hero_sub: "A structured online program that combines academic clarity, contextualized practice, and measurable progress — from your first class.",
    hero_cta_primary: "Enroll now",
    hero_cta_secondary: "Chat on WhatsApp",
    hero_fact1: "4 CEFR levels",
    hero_fact2: "Max. 8 students",
    hero_fact3: "Speaking-focused",
    hero_photo_alt: "LEF student in a live video-call class",
    stat1_num: "12",
    stat1_lab: "Learning modules",
    stat2_num: "4",
    stat2_lab: "CEFR levels (A1–B2)",
    stat3_num: "8",
    stat3_lab: "Students per group, max.",
    stat4_num: "3",
    stat4_lab: "Method pillars",
    levels_h2: "Choose your level",
    levels_sub: "Twelve modules organized into four levels of the Common European Framework of Reference. Not sure which one is yours? We'll confirm it together in your first class.",
    lvl_a1_name: "Beginner",
    lvl_a2_name: "Basic",
    lvl_b1_name: "Intermediate",
    lvl_b2_name: "Upper-Intermediate",
    lvl_a1_m1: "Getting started",
    lvl_a1_m1d: "Greetings, the alphabet, numbers, everyday introductions.",
    lvl_a1_m2: "Everyday life",
    lvl_a1_m2d: "Daily routines, family, food, present simple.",
    lvl_a1_m3: "Around town",
    lvl_a1_m3d: "Directions, places in the city, past simple.",
    lvl_a2_m1: "Stories and travel",
    lvl_a2_m1d: "Past continuous, travel vocabulary, comparatives.",
    lvl_a2_m2: "Making plans",
    lvl_a2_m2d: "Future forms, invitations, superlatives.",
    lvl_a2_m3: "Opinions and advice",
    lvl_a2_m3d: "Should/shouldn't, modals, giving advice.",
    lvl_b1_m1: "Experiences",
    lvl_b1_m1d: "Present Perfect vs. Past Simple, for/since, First Conditional.",
    lvl_b1_m2: "Recounting and deducing",
    lvl_b1_m2d: "Reported speech, Past Perfect, modals of deduction.",
    lvl_b1_m3: "Speculation and debate",
    lvl_b1_m3d: "Modals of speculation, complex future forms, structured debate.",
    lvl_b2_m1: "Mixed conditionals",
    lvl_b2_m1d: "Mixed conditionals and advanced hypothetical language.",
    lvl_b2_m2: "Passive voice and precision",
    lvl_b2_m2d: "Advanced passive voice and precise reporting.",
    lvl_b2_m3: "Fluency in action",
    lvl_b2_m3d: "Idioms, phrasal verbs, and the B2 final project.",
    claim_belief: "In LEF, we believe that learning English goes beyond memorizing grammar rules or following traditional methods. We provide a dynamic, communicative and contextualized learning experience to help students use English confidently in real-life situations.",
    system_h2: "The LEF learning system",
    system_sub: "Three principles run through every class, every material, and every cycle.",
    pillar1_k: "Communicative Focus",
    pillar1_p: "English is used from day one. Speaking is not the final goal of the course — it is the method itself.",
    pillar2_k: "Contextualized Learning",
    pillar2_p: "Language is taught through real situations, so what you learn in class is what you use in life.",
    pillar3_k: "Continuous Progress",
    pillar3_p: "Structured cycles ensure steady improvement, with clear objectives at every stage of the journey.",
    ph_pillar1: "Class photo",
    ph_pillar2: "Class photo",
    ph_pillar3: "Progress screenshot",
    offer_h2: "What LEF offers",
    offer_sub: "Everything a student needs for structured, accompanied progress — not just a weekly class.",
    offer_1_t: "Live Online Classes",
    offer_1_d: "Small-group classes with a communicative approach, oriented to speaking.",
    offer_2_t: "Conversation Club",
    offer_2_d: "Extra speaking practice to build fluency and lose the fear of talking.",
    offer_3_t: "Exclusive LEF Learning Materials",
    offer_3_d: "In-house materials designed for each level of the program.",
    offer_4_t: "Academic Platform",
    offer_4_d: "Track your progress and access your class resources in one place.",
    offer_5_t: "Mid-Cycle Tutoring Sessions",
    offer_5_d: "One-on-one support halfway through each cycle to reinforce what you've learned.",
    offer_6_t: "Continuous Academic Support",
    offer_6_d: "An academic team available throughout your whole process, not just in class.",
    offer_photo_alt: "LEF study materials: book and computer",
    enroll_h2: "How enrollment works",
    enroll_sub: "Four simple steps, from your first message to your first class.",
    step_1: "Your details",
    step_2: "Choose your level",
    step_3: "Choose your schedule",
    step_4: "Review & confirm",
    enroll_foot: "We'll use this to confirm your spot and get in touch by WhatsApp.",
    enroll_cta: "Start on WhatsApp",
    reassure: "A system built for real progress — not just another isolated class.",
    eval_h2: "Evaluation & progress",
    eval_lead: "LEF follows a formative assessment model: progress is monitored continuously through participation and language performance — not through pressure.",
    eval_icon_alt: "Evaluation checklist icon",
    exam_t: "Knowledge Validation Exam",
    exam_p: "At the end of each cycle, students take a Knowledge Validation Exam to verify the achievement of learning objectives. This exam is not punitive and does not determine advancement to the next level; it is designed to support reflection, progress awareness, and learning without unnecessary pressure.",
    commit_h2: "Student commitment",
    commit_icon_alt: "Handshake with checkmark icon",
    commit_1: "Participate actively in every session",
    commit_2: "Maintain respectful communication",
    commit_3: "Attend classes consistently",
    commit_4: "Complete assigned tasks",
    commit_5: "Take responsibility for their learning",
    close_support: "Structured cycles, real conversation, and continuous support — from your first class.",
    close_cta_primary: "Enroll now",
    close_cta_secondary: "Chat on WhatsApp",
    footer_tagline: "An online structured English program for real communicative competence.",
    footer_col_program: "Program",
    footer_col_contact: "Contact",
    footer_whatsapp: "WhatsApp",
    footer_location: "Barranquilla, Colombia",
    footer_right: "Barranquilla, Colombia · 2026",
    ph_label: "Image pending",
    ph_sub: "To be placed",
    nav_inscripcion: "Enroll",
    nav_faq: "FAQ",
    nav_privacy: "Privacy policy",
    nav_terms: "Terms of use",
    footer_col_social: "Follow us",
    footer_email: "lefenglishcenter@gmail.com",
    ph_collage: "Photo pending",
    page_levels_eyebrow: "Program structure",
    page_levels_title: "Choose your level",
    page_levels_intro: "LEF organizes its program into 12 modules across 4 CEFR levels — from your first words to fluent, idiomatic conversation. Hover over each level to see its three modules and what they cover.",
    levels_closing: "Not sure which level fits you? You don't need to guess — we confirm it together in your first class, based on your real starting point, not a generic test.",
    page_system_eyebrow: "How LEF teaches",
    page_system_title: "The LEF learning system",
    page_system_intro: "LEF's method isn't a collection of isolated techniques — it's a system. Every class, every material, and every cycle is built on the same three pillars, so progress feels continuous instead of accidental.",
    system_closing: "Three pillars, one system: you speak from day one, in real situations, through cycles with clear objectives.",
    page_offer_eyebrow: "Included in the program",
    page_offer_title: "What LEF offers",
    page_offer_intro: "Learning a language well takes more than a weekly class. LEF's offer is designed so that practice, materials, and support all point in the same direction: real, structured progress.",
    offer_closing: "Every part of the offer connects back to the same idea: consistent contact with the language, backed by real support — not just a class you attend and forget.",
    page_enroll_eyebrow: "Start today",
    page_enroll_title: "Enrollment",
    page_enroll_intro: "Enrolling at LEF takes four simple steps — from sharing your details to confirming by WhatsApp. Fill in the form below and we'll get in touch to finish the process together.",
    form_name: "Full name",
    form_phone: "WhatsApp number",
    form_email: "Email",
    form_age: "Age",
    form_city: "City",
    form_level: "Level (if you know it)",
    form_level_opt: "Not sure yet — we'll confirm it in class",
    form_schedule: "Preferred schedule",
    form_schedule_opt: "No preference",
    form_schedule_morning: "Morning",
    form_schedule_afternoon: "Afternoon",
    form_schedule_evening: "Evening",
    form_submit: "Continue on WhatsApp",
    form_note: "This form doesn't submit anywhere by itself: pressing \"Continue\" opens WhatsApp with your details ready to send, so our team can confirm your spot.",
    wa_message: "Hi! I'd like to start my enrollment at LEF. Could you tell me about levels and available schedules?"
  },
  es: {
    nav_what: "Qué es LEF",
    nav_levels: "Niveles",
    nav_system: "Sis. aprendizaje",
    nav_offer: "Qué ofrecemos",
    nav_evaluation: "Evaluación",
    nav_enroll: "Inscribirme",
    hero_tag: "Academia de inglés online · Barranquilla, Colombia",
    hero_h1_1: "Habla inglés",
    hero_h1_2: "con un plan.",
    hero_sub: "Un programa online estructurado que combina claridad académica, práctica contextualizada y progreso medible — desde tu primera clase.",
    hero_cta_primary: "Inscribirme ahora",
    hero_cta_secondary: "Escríbenos por WhatsApp",
    hero_fact1: "4 niveles CEFR",
    hero_fact2: "Máx. 8 estudiantes",
    hero_fact3: "Enfoque en speaking",
    hero_photo_alt: "Estudiante de LEF en una clase en vivo por videollamada",
    stat1_num: "12",
    stat1_lab: "Módulos de aprendizaje",
    stat2_num: "4",
    stat2_lab: "Niveles CEFR (A1–B2)",
    stat3_num: "8",
    stat3_lab: "Estudiantes por grupo, máx.",
    stat4_num: "3",
    stat4_lab: "Pilares del método",
    levels_h2: "Elige tu nivel",
    levels_sub: "Doce módulos organizados en cuatro niveles del Marco Común Europeo de Referencia. ¿No sabes cuál es el tuyo? Lo confirmamos juntos en tu primera clase.",
    lvl_a1_name: "Principiante",
    lvl_a2_name: "Básico",
    lvl_b1_name: "Intermedio",
    lvl_b2_name: "Intermedio alto",
    lvl_a1_m1: "Primeros pasos",
    lvl_a1_m1d: "Saludos, el abecedario, números y presentaciones cotidianas.",
    lvl_a1_m2: "Vida cotidiana",
    lvl_a1_m2d: "Rutinas diarias, familia, comida y presente simple.",
    lvl_a1_m3: "En la ciudad",
    lvl_a1_m3d: "Direcciones, lugares de la ciudad y pasado simple.",
    lvl_a2_m1: "Historias y viajes",
    lvl_a2_m1d: "Pasado continuo, vocabulario de viajes y comparativos.",
    lvl_a2_m2: "Haciendo planes",
    lvl_a2_m2d: "Formas de futuro, invitaciones y superlativos.",
    lvl_a2_m3: "Opiniones y consejos",
    lvl_a2_m3d: "Should/shouldn't, modales y cómo dar consejos.",
    lvl_b1_m1: "Experiencias",
    lvl_b1_m1d: "Present Perfect vs. Past Simple, for/since y First Conditional.",
    lvl_b1_m2: "Contar y deducir",
    lvl_b1_m2d: "Estilo indirecto, Past Perfect y modales de deducción.",
    lvl_b1_m3: "Especulación y debate",
    lvl_b1_m3d: "Modales de especulación, futuros complejos y debate estructurado.",
    lvl_b2_m1: "Condicionales mixtos",
    lvl_b2_m1d: "Condicionales mixtos y lenguaje hipotético avanzado.",
    lvl_b2_m2: "Voz pasiva y precisión",
    lvl_b2_m2d: "Voz pasiva avanzada y reportes precisos.",
    lvl_b2_m3: "Fluidez en acción",
    lvl_b2_m3d: "Modismos, phrasal verbs y el proyecto final de B2.",
    claim_belief: "Aprender inglés va más allá de memorizar reglas. En LEF, el idioma se usa en la vida real, desde el primer día.",
    system_h2: "El sistema de aprendizaje LEF",
    system_sub: "Tres principios atraviesan cada clase, cada material y cada ciclo.",
    pillar1_k: "Enfoque comunicativo",
    pillar1_p: "El inglés se usa desde el primer día. Hablar no es la meta final del curso — es el método mismo.",
    pillar2_k: "Aprendizaje contextualizado",
    pillar2_p: "El idioma se enseña a través de situaciones reales, para que lo que aprendes en clase sea lo que usas en la vida.",
    pillar3_k: "Progreso continuo",
    pillar3_p: "Ciclos estructurados aseguran una mejora constante, con objetivos claros en cada etapa del proceso.",
    ph_pillar1: "Foto de clase",
    ph_pillar2: "Foto de clase",
    ph_pillar3: "Captura de plataforma",
    offer_h2: "Qué ofrece LEF",
    offer_sub: "Todo lo que un estudiante necesita para progresar de forma estructurada y acompañada — no solo una clase semanal.",
    offer_1_t: "Clases en vivo online",
    offer_1_d: "Clases en grupos pequeños, con enfoque comunicativo orientado al speaking.",
    offer_2_t: "Club de conversación",
    offer_2_d: "Práctica oral adicional para ganar fluidez y perder el miedo a hablar.",
    offer_3_t: "Materiales de aprendizaje exclusivos LEF",
    offer_3_d: "Material propio, diseñado para cada nivel del programa.",
    offer_4_t: "Plataforma académica",
    offer_4_d: "Seguimiento de tu progreso y acceso a tus recursos de clase en un solo lugar.",
    offer_5_t: "Tutorías a mitad de ciclo",
    offer_5_d: "Acompañamiento individual a mitad de cada ciclo para reforzar lo aprendido.",
    offer_6_t: "Acompañamiento académico continuo",
    offer_6_d: "Un equipo académico disponible durante todo tu proceso, no solo en clase.",
    offer_photo_alt: "Materiales de estudio LEF: libro y computador",
    enroll_h2: "Así funciona tu inscripción",
    enroll_sub: "Cuatro pasos simples, desde tu primer mensaje hasta tu primera clase.",
    step_1: "Tus datos",
    step_2: "Elige tu nivel",
    step_3: "Elige tu horario",
    step_4: "Revisa y confirma",
    enroll_foot: "Usaremos esta información para confirmar tu cupo y contactarte por WhatsApp.",
    enroll_cta: "Empezar por WhatsApp",
    reassure: "Un sistema pensado para que progreses de verdad — no una clase suelta más.",
    eval_h2: "Evaluación y progreso",
    eval_lead: "LEF sigue un modelo de evaluación formativa: el progreso se monitorea continuamente a través de la participación y el desempeño en el idioma — no mediante presión.",
    eval_icon_alt: "Ícono de lista de evaluación",
    exam_t: "Examen de Validación de Conocimientos",
    exam_p: "Al final de cada ciclo, los estudiantes presentan un Examen de Validación de Conocimientos para verificar el logro de los objetivos de aprendizaje. Este examen no es punitivo ni determina el avance al siguiente nivel; está diseñado para apoyar la reflexión, la conciencia del progreso y el aprendizaje sin presión innecesaria.",
    commit_h2: "Compromiso del estudiante",
    commit_icon_alt: "Ícono de apretón de manos con visto bueno",
    commit_1: "Participar activamente en cada sesión",
    commit_2: "Mantener una comunicación respetuosa",
    commit_3: "Asistir a clases de forma constante",
    commit_4: "Completar las tareas asignadas",
    commit_5: "Asumir la responsabilidad de su propio aprendizaje",
    close_support: "Ciclos estructurados, conversación real y acompañamiento continuo — desde tu primera clase.",
    close_cta_primary: "Inscribirme ahora",
    close_cta_secondary: "Escríbenos por WhatsApp",
    footer_tagline: "Un programa de inglés online estructurado, diseñado para una competencia comunicativa real.",
    footer_col_program: "Programa",
    footer_col_contact: "Contacto",
    footer_whatsapp: "WhatsApp",
    footer_location: "Barranquilla, Colombia",
    footer_right: "Barranquilla, Colombia · 2026",
    ph_label: "Imagen pendiente",
    ph_sub: "Por ubicar",
    nav_inscripcion: "Inscripción",
    nav_faq: "Preguntas frecuentes",
    nav_privacy: "Política de privacidad",
    nav_terms: "Términos de uso",
    footer_col_social: "Síguenos",
    footer_email: "lefenglishcenter@gmail.com",
    ph_collage: "Foto pendiente",
    page_levels_eyebrow: "Estructura del programa",
    page_levels_title: "Elige tu nivel",
    page_levels_intro: "LEF organiza su programa en 12 módulos distribuidos en 4 niveles CEFR — desde tus primeras palabras hasta una conversación fluida e idiomática. Pasa el cursor sobre cada nivel para ver sus tres módulos y qué cubren.",
    levels_closing: "¿No sabes qué nivel te corresponde? No tienes que adivinar — lo confirmamos juntos en tu primera clase, a partir de tu punto de partida real, no de un examen genérico.",
    page_system_eyebrow: "Cómo enseña LEF",
    page_system_title: "El sistema de aprendizaje LEF",
    page_system_intro: "El método de LEF no es una colección de técnicas sueltas — es un sistema. Cada clase, cada material y cada ciclo se construyen sobre los mismos tres pilares, para que el progreso se sienta continuo y no accidental.",
    system_closing: "Tres pilares, un solo sistema: hablas desde el primer día, en situaciones reales, dentro de ciclos con objetivos claros.",
    page_offer_eyebrow: "Incluido en el programa",
    page_offer_title: "Qué ofrece LEF",
    page_offer_intro: "Aprender un idioma bien requiere más que una clase semanal. La oferta de LEF está pensada para que la práctica, los materiales y el acompañamiento apunten en la misma dirección: progreso real y estructurado.",
    offer_closing: "Cada parte de la oferta conecta con la misma idea: contacto constante con el idioma, respaldado por acompañamiento real — no solo una clase a la que asistes y luego olvidas.",
    page_enroll_eyebrow: "Empieza hoy",
    page_enroll_title: "Inscripción",
    page_enroll_intro: "Inscribirte en LEF toma cuatro pasos simples — desde compartir tus datos hasta confirmar por WhatsApp. Completa el formulario y nos pondremos en contacto para terminar el proceso juntos.",
    form_name: "Nombre completo",
    form_phone: "Número de WhatsApp",
    form_email: "Correo electrónico",
    form_age: "Edad",
    form_city: "Ciudad",
    form_level: "Nivel (si ya lo sabes)",
    form_level_opt: "Aún no sé — lo confirmamos en clase",
    form_schedule: "Horario preferido",
    form_schedule_opt: "Sin preferencia",
    form_schedule_morning: "Mañana",
    form_schedule_afternoon: "Tarde",
    form_schedule_evening: "Noche",
    form_submit: "Continuar por WhatsApp",
    form_note: "Este formulario no se envía solo: al presionar \"Continuar\" se abre WhatsApp con tus datos listos para enviar, para que nuestro equipo confirme tu cupo.",
    wa_message: "¡Hola! Quiero iniciar mi inscripción en LEF. ¿Podrían contarme sobre los niveles y horarios disponibles?"
  }
};

function waLink(lang){
  const text = encodeURIComponent(I18N[lang].wa_message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

function applyLang(lang){
  const dict = I18N[lang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-alt]").forEach(el => {
    const key = el.getAttribute("data-i18n-alt");
    if (dict[key] !== undefined) el.setAttribute("alt", dict[key]);
  });
  document.querySelectorAll(".wa-target").forEach(el => {
    el.setAttribute("href", waLink(lang));
  });
  document.documentElement.setAttribute("lang", lang);
  document.querySelectorAll(".lang-toggle button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
  try { localStorage.setItem("lef-lang", lang); } catch (e) {}
}

function initLang(){
  let lang = "es";
  try {
    const saved = localStorage.getItem("lef-lang");
    if (saved === "en" || saved === "es") lang = saved;
  } catch (e) {}
  applyLang(lang);
  document.querySelectorAll(".lang-toggle button").forEach(btn => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });
}

function initDrawer(){
  const btn = document.querySelector(".menu-btn");
  const drawer = document.querySelector(".drawer");
  const overlay = document.querySelector(".drawer-overlay");
  const closeBtn = document.querySelector(".drawer-close");
  if (!btn || !drawer || !overlay) return;
  const open = () => { drawer.classList.add("open"); overlay.classList.add("open"); btn.classList.add("open"); document.body.style.overflow = "hidden"; };
  const close = () => { drawer.classList.remove("open"); overlay.classList.remove("open"); btn.classList.remove("open"); document.body.style.overflow = ""; };
  btn.addEventListener("click", () => drawer.classList.contains("open") ? close() : open());
  overlay.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
}

function initEnrollForm(){
  const form = document.getElementById("enroll-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const lang = document.documentElement.getAttribute("lang") || "es";
    const data = new FormData(form);
    const name = (data.get("name") || "").toString().trim();
    const phone = (data.get("phone") || "").toString().trim();
    const email = (data.get("email") || "").toString().trim();
    const age = (data.get("age") || "").toString().trim();
    const city = (data.get("city") || "").toString().trim();
    const level = (data.get("level") || "").toString().trim();
    const schedule = (data.get("schedule") || "").toString().trim();
    const lines = lang === "en"
      ? [
          "Hi! I'd like to enroll at LEF.",
          name && `Name: ${name}`,
          phone && `WhatsApp: ${phone}`,
          email && `Email: ${email}`,
          age && `Age: ${age}`,
          city && `City: ${city}`,
          level && `Level: ${level}`,
          schedule && `Preferred schedule: ${schedule}`
        ]
      : [
          "¡Hola! Quiero inscribirme en LEF.",
          name && `Nombre: ${name}`,
          phone && `WhatsApp: ${phone}`,
          email && `Correo: ${email}`,
          age && `Edad: ${age}`,
          city && `Ciudad: ${city}`,
          level && `Nivel: ${level}`,
          schedule && `Horario preferido: ${schedule}`
        ];
    const text = encodeURIComponent(lines.filter(Boolean).join("\n"));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank", "noopener");
  });
}

function initReveal(){
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("on");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: .08 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  initLang();
  initReveal();
  initDrawer();
  initEnrollForm();
  document.querySelectorAll("nav.links a, .drawer nav.links a").forEach(a => {
    if (a.getAttribute("href") === location.pathname.split("/").pop() || (location.pathname.endsWith("/") && a.getAttribute("href") === "index.html")) {
      a.classList.add("active");
    }
  });
});
