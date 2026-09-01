// LEF landing — i18n (EN/ES) + reveal-on-scroll + WhatsApp links
// WhatsApp / contact number provided by the client: +57 301 324 0652.
const WHATSAPP_NUMBER = "573013240652";

const I18N = {
  en: {
    nav_what: "About LEF",
    nav_levels: "Levels",
    nav_system: "Learning system",
    nav_offer: "What we offer",
    nav_evaluation: "Evaluation",
    nav_enroll: "Enroll",
    nav_login: "Log in",
    hero_tag: "Online English Academy · Barranquilla, Colombia",
    hero_h1_1: "Speak English",
    hero_h1_2: "with fluency.",
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
    lvl_a1_m1: "Module 1 (A1.1) — Hello, World",
    lvl_a1_m1d: "Introduce yourself confidently in English from day one.",
    lvl_a1_m2: "Module 2 (A1.2) — Everyday Life",
    lvl_a1_m2d: "Talk about your life, home, and habits in English.",
    lvl_a1_m3: "Module 3 (A1.3) — My Story",
    lvl_a1_m3d: "Talk about what you did, where you were, and what you could do.",
    lvl_a2_m1: "Module 4 (A2.1) — Out and About",
    lvl_a2_m1d: "Get around any city and make plans in English.",
    lvl_a2_m2: "Module 5 (A2.2) — On the Move",
    lvl_a2_m2d: "Describe, compare, and talk about what's happening right now.",
    lvl_a2_m3: "Module 6 (A2.3) — Experience Counts",
    lvl_a2_m3d: "Talk about your experiences, share opinions, and give your point of view.",
    lvl_b1_m1: "Module 7 (B1.1) — Connecting the Dots",
    lvl_b1_m1d: "Connect the past with the present and express yourself naturally.",
    lvl_b1_m2: "Module 8 (B1.2) — Behind the Words",
    lvl_b1_m2d: "Report conversations, deduce situations, and describe processes.",
    lvl_b1_m3: "Module 9 (B1.3) — What If?",
    lvl_b1_m3d: "Speculate, debate, and handle complex situations fluently.",
    lvl_b2_m1: "Module 10 (B2.1) — The Bigger Picture",
    lvl_b2_m1d: "Master advanced structures and communicate in any context.",
    lvl_b2_m2: "Module 11 (B2.2) — Power of Words",
    lvl_b2_m2d: "Speak like a native: phrasal verbs, idioms, and high-level writing.",
    lvl_b2_m3: "Module 12 (B2.3) — Your English, Your Voice",
    lvl_b2_m3d: "Show everything you can do in English.",
    hours_p: "16 hours of class per month + 3 hours of tutoring at the end of each cycle = 19 hours of support per month. Classes Tuesday through Friday, 1 hour, fully online.",
    c1_h3: "And there's more",
    c1_p: "Learning English always has a purpose — that's why LEF offers this additional module with different focuses.",
    c1_cefr: "Extra, exclusive module",
    c1_1: "Certification exam preparation",
    c1_1d: "Practice the format, timing and strategies of international exams, with mock tests and personalized feedback.",
    c1_2: "Job interview preparation",
    c1_2d: "Mock interviews in English, industry vocabulary and direct feedback so you show up with confidence.",
    c1_3: "English-speaking culture immersion",
    c1_3d: "Culture, idioms and the nuances of real English, so you move naturally in an English-speaking environment.",
    c1_note: "This is an optional, exclusive module outside the 4 CEFR levels: you choose it based on your specific goal, and it's scheduled separately from your regular cycle by messaging us on WhatsApp.",
    c1_perk1: "Personalized sessions based on your goal: exam, interview, or cultural immersion.",
    c1_perk2: "Flexible scheduling, separate from your regular class cycle.",
    c1_perk3: "Direct support from the LEF academic team.",
    c1_perk4: "Small groups or 1-on-1 classes, at your own pace.",
    c1_perk5: "Materials and exercises focused on your specific goal.",
    claim_belief: "Learning English is more than studying — it's communicating without limits.",
    system_h2: "The LEF learning system",
    system_sub: "Three principles run through every class, every material, and every cycle.",
    pillar1_k: "Communicative Focus",
    pillar1_p: "English is used from day one. Speaking is not the final goal of the course — it is the method itself.",
    pillar2_k: "Contextualized Learning",
    pillar2_p: "Language is taught through real situations, so what you learn in class is what you use in life.",
    pillar3_k: "Continuous Progress",
    pillar3_p: "Structured cycles ensure steady improvement, with clear objectives at every stage of the journey.",
    system_note1: "At LEF, learning isn't measured by a number — it's a process of consistency where you move forward day by day.",
    system_note2: "At the end of each cycle there's a validation exam that checks your progress. It doesn't penalize you or determine whether you move up a level — it simply shows how far you've come.",
    system_point1: "You speak from day one — Communicative approach.",
    system_point2: "You practice in real situations — Contextualized learning.",
    system_point3: "You progress through cycles with clear objectives — Continuous progress.",
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
    offer_5_t: "End-of-Cycle Tutoring Sessions",
    offer_5_d: "One-on-one support at the end of each cycle to reinforce what you've learned and show that your learning is a priority for LEF.",
    offer_6_t: "Continuous Academic Support",
    offer_6_d: "An academic team available throughout your whole process, not just in class.",
    offer_point1: "Consistent contact with the language, backed by real support.",
    offer_point2: "Not just a class you attend and forget.",
    offer_point3: "Pressure-free learning, with formative assessment every cycle.",
    offer_point4: "Small groups so you actually practice, not just listen.",
    enroll_h2: "How enrollment works",
    enroll_sub: "Four simple steps, from your first message to your first class.",
    step_1: "Your details",
    step_2: "Choose your level",
    step_3: "Choose your schedule",
    step_4: "Review & confirm",
    enroll_foot: "We'll use this to confirm your spot and get in touch by WhatsApp.",
    enroll_cta: "Start on WhatsApp",
    reassure: "A system built for real progress — not just another isolated class.",
    diff_h3: "What makes LEF different?",
    diff_1: "In-house modules",
    diff_2: "A communicative approach in every class",
    diff_3: "Continuous support",
    diff_4: "Pressure-free learning",
    lp_title: "Your path to fluency — 12 modules, steady pace.",
    lp_a1: "Foundations",
    lp_a2: "Fluency",
    lp_b1: "Conversation",
    lp_b2: "Advanced mastery",
    lp_c1_tag: "Special module",
    lp_c1: "Focused",
    qualify_tag: "Where do you start?",
    qualify_h2: "Find your starting point",
    qual_q1: "Have you never spoken English before?",
    qual_a1: "You start at A1, speaking from your very first class.",
    qual_btn1: "Enroll",
    qual_q2: "Have you studied before but feel it hasn't worked?",
    qual_a2: "Groups of max. 8, flexible schedules, 1-hour classes. Formative assessment — no pressure, no elimination exams.",
    payment_t: "Payment methods",
    payment_p: "LEF accepts PSE and credit/debit card through Wompi, securely. Payment is made after enrolling, from your student portal.",
    diff_eyebrow: "What sets us apart",
    founder_role: "Founder and Academic Director",
    founder_quotes: [
      "Learning English goes beyond memorizing grammar rules or following traditional methods.",
      "Fluency isn't born from perfection, but from the consistency with which we dare to speak.",
      "At LEF we don't train students who memorize English; we shape people who think and express themselves in it.",
      "Every module we design starts from a simple question: will this actually serve a student in real life?",
      "Real progress is measured by the confidence with which someone dares to speak, not by an exam.",
      "We believe in learning that supports rather than pressures — because fear has never taught anyone to speak better."
    ],
    close_support: "Structured cycles, real conversation, and continuous support — from your first class.",
    close_cta_primary: "Enroll now",
    close_cta_secondary: "Chat on WhatsApp",
    footer_tagline: "An online structured English program for real communicative competence.",
    footer_col_program: "Program",
    footer_col_contact: "Contact",
    footer_phone: "Phone: +57 301 324 0652",
    footer_location: "Barranquilla, Colombia",
    footer_right: "Barranquilla, Colombia · 2026",
    nav_inscripcion: "Enroll",
    nav_faq: "FAQ",
    nav_privacy: "Privacy policy",
    nav_terms: "Terms of use",
    footer_col_social: "Follow us",
    footer_email: "informacion@lefcenter.com",
    testi_eyebrow: "Voices of LEF",
    testi_title: "What our students say",
    testi_1_q: "I started not even knowing how to introduce myself in English, and within months I was holding full conversations. The classes feel real, not memorized.",
    testi_1_m: "Module B1.2",
    testi_2_q: "The small groups make all the difference. My teacher knows my pace, which gives me the confidence to speak without fear of making mistakes.",
    testi_2_m: "Level A2",
    testi_3_q: "The tutoring at the end of each cycle cleared up the doubts I still had from class. You can really feel the constant support.",
    testi_3_m: "Module B2.1",
    testi_4_q: "I had never spoken English before, and I was already participating from the first class. Zero pressure, a lot of progress.",
    testi_4_m: "Level A1",
    testi_5_q: "I took the interview-prep module before a job process and showed up far more confident. Totally worth it.",
    testi_5_m: "C1 Focused module",
    testi_6_q: "The flexible schedules let me keep studying without clashing with my job. The platform is clear and easy to use.",
    testi_6_m: "Level B1",
    page_levels_eyebrow: "Program structure",
    page_levels_title: "Choose your level",
    page_levels_intro: "LEF organizes its program into 12 modules across 4 CEFR levels — from your first words to fluent, idiomatic conversation. Hover over each level to see its three modules and what they cover.",
    levels_closing: "Not sure which level fits you? You don't need to guess — we confirm it together in your first class, based on your real starting point, not a generic test.",
    page_system_eyebrow: "How LEF teaches",
    page_system_title: "The LEF learning system",
    page_system_intro: "LEF's method isn't a collection of isolated techniques — it's a system. Every class, every material, and every cycle is built on the same three pillars, so progress feels continuous instead of accidental.",
    page_offer_eyebrow: "Included in the program",
    page_offer_title: "What LEF offers",
    page_offer_intro: "Learning a language well takes more than a weekly class. LEF's offer is designed so that practice, materials, and support all point in the same direction: real, structured progress.",
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
    nav_login: "Iniciar sesión",
    hero_tag: "Academia de inglés online · Barranquilla, Colombia",
    hero_h1_1: "Habla inglés",
    hero_h1_2: "con fluidez.",
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
    lvl_a1_m1: "Módulo 1 (A1.1) — Hello, World",
    lvl_a1_m1d: "Preséntate con confianza en inglés desde el primer día.",
    lvl_a1_m2: "Módulo 2 (A1.2) — Everyday Life",
    lvl_a1_m2d: "Habla de tu vida, tu hogar y tus hábitos en inglés.",
    lvl_a1_m3: "Módulo 3 (A1.3) — My Story",
    lvl_a1_m3d: "Cuenta lo que hiciste, dónde estuviste y qué podías hacer.",
    lvl_a2_m1: "Módulo 4 (A2.1) — Out and About",
    lvl_a2_m1d: "Muévete por cualquier ciudad y haz planes en inglés.",
    lvl_a2_m2: "Módulo 5 (A2.2) — On the Move",
    lvl_a2_m2d: "Describe, compara y habla de lo que está pasando ahora.",
    lvl_a2_m3: "Módulo 6 (A2.3) — Experience Counts",
    lvl_a2_m3d: "Habla de tus experiencias, expresa opiniones y da tu punto de vista.",
    lvl_b1_m1: "Módulo 7 (B1.1) — Connecting the Dots",
    lvl_b1_m1d: "Conecta el pasado con el presente y exprésate con naturalidad.",
    lvl_b1_m2: "Módulo 8 (B1.2) — Behind the Words",
    lvl_b1_m2d: "Reporta conversaciones, deduce situaciones y describe procesos.",
    lvl_b1_m3: "Módulo 9 (B1.3) — What If?",
    lvl_b1_m3d: "Especula, debate y maneja situaciones complejas con fluidez.",
    lvl_b2_m1: "Módulo 10 (B2.1) — The Bigger Picture",
    lvl_b2_m1d: "Domina estructuras avanzadas y comunícate en cualquier contexto.",
    lvl_b2_m2: "Módulo 11 (B2.2) — Power of Words",
    lvl_b2_m2d: "Habla como nativo: phrasal verbs, idioms y escritura de alto nivel.",
    lvl_b2_m3: "Módulo 12 (B2.3) — Your English, Your Voice",
    lvl_b2_m3d: "Demuestra todo lo que puedes hacer en inglés.",
    hours_p: "16 horas de clase al mes + 3 horas de tutoría al final de cada ciclo = 19 horas de acompañamiento al mes. Clases de martes a viernes, 1 hora, modalidad virtual.",
    c1_h3: "Y hay mucho más",
    c1_p: "Aprender inglés siempre tiene un objetivo — por eso LEF ofrece este módulo adicional con distintos enfoques.",
    c1_cefr: "Módulo extra y exclusivo",
    c1_1: "Preparación para exámenes de certificación",
    c1_1d: "Practica el formato, los tiempos y las estrategias de exámenes internacionales, con simulacros y retroalimentación personalizada.",
    c1_2: "Preparación para entrevista de trabajo",
    c1_2d: "Simulacros de entrevista en inglés, vocabulario de tu sector y feedback directo para que llegues con seguridad.",
    c1_3: "Contextualización anglo",
    c1_3d: "Cultura, expresiones idiomáticas y matices del inglés real, para moverte con naturalidad en un entorno anglosajón.",
    c1_note: "Es un módulo opcional y exclusivo, fuera de los 4 niveles CEFR: lo eliges según tu objetivo puntual y se agenda aparte de tu ciclo regular, escribiéndonos por WhatsApp.",
    c1_perk1: "Sesiones personalizadas según tu objetivo: examen, entrevista o inmersión cultural.",
    c1_perk2: "Agenda flexible, aparte de tu ciclo regular de clases.",
    c1_perk3: "Acompañamiento directo del equipo académico de LEF.",
    c1_perk4: "Grupos reducidos o clases 1 a 1, según tu ritmo.",
    c1_perk5: "Material y ejercicios enfocados en tu objetivo específico.",
    claim_belief: "Aprender inglés es más que estudiar, es comunicarte sin límites.",
    system_h2: "El sistema de aprendizaje LEF",
    system_sub: "Tres principios atraviesan cada clase, cada material y cada ciclo.",
    pillar1_k: "Enfoque comunicativo",
    pillar1_p: "El inglés se usa desde el primer día. Hablar no es la meta final del curso — es el método mismo.",
    pillar2_k: "Aprendizaje contextualizado",
    pillar2_p: "El idioma se enseña a través de situaciones reales, para que lo que aprendes en clase sea lo que usas en la vida.",
    pillar3_k: "Progreso continuo",
    pillar3_p: "Ciclos estructurados aseguran una mejora constante, con objetivos claros en cada etapa del proceso.",
    system_note1: "En LEF el aprendizaje no se mide con un número — es un proceso de constancia donde avanzas día a día.",
    system_note2: "Al final de cada ciclo hay un examen de validación que verifica tu progreso. No penaliza ni determina si avanzas de nivel: solo muestra cuánto has avanzado.",
    system_point1: "Hablas desde el primer día — Enfoque comunicativo.",
    system_point2: "Practicas en situaciones reales — Aprendizaje contextualizado.",
    system_point3: "Avanzas en ciclos con objetivos claros — Progreso continuo.",
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
    offer_5_t: "Tutorías al final de cada ciclo",
    offer_5_d: "Acompañamiento individual al finalizar cada ciclo para reforzar lo aprendido y mostrar que el aprendizaje del estudiante es prioridad para LEF.",
    offer_6_t: "Acompañamiento académico continuo",
    offer_6_d: "Un equipo académico disponible durante todo tu proceso, no solo en clase.",
    offer_point1: "Contacto constante con el idioma, respaldado por acompañamiento real.",
    offer_point2: "No es solo una clase a la que asistes y luego olvidas.",
    offer_point3: "Aprendizaje sin presión, con evaluación formativa en cada ciclo.",
    offer_point4: "Grupos pequeños para que realmente practiques, no solo escuches.",
    enroll_h2: "Así funciona tu inscripción",
    enroll_sub: "Cuatro pasos simples, desde tu primer mensaje hasta tu primera clase.",
    step_1: "Tus datos",
    step_2: "Elige tu nivel",
    step_3: "Elige tu horario",
    step_4: "Revisa y confirma",
    enroll_foot: "Usaremos esta información para confirmar tu cupo y contactarte por WhatsApp.",
    enroll_cta: "Empezar por WhatsApp",
    reassure: "Un sistema pensado para que progreses de verdad — no una clase suelta más.",
    diff_h3: "¿Qué hace LEF diferente?",
    diff_1: "Módulos propios",
    diff_2: "Enfoque comunicativo en las clases",
    diff_3: "Acompañamiento continuo",
    diff_4: "Aprendizaje sin presión",
    lp_title: "Tu camino a la fluidez — 12 módulos, ritmo constante.",
    lp_a1: "Bases",
    lp_a2: "Fluidez",
    lp_b1: "Conversación",
    lp_b2: "Dominio avanzado",
    lp_c1_tag: "Módulo especial",
    lp_c1: "Focalizado",
    qualify_tag: "¿Por dónde empiezas?",
    qualify_h2: "Encuentra tu punto de partida",
    qual_q1: "¿Nunca has hablado inglés?",
    qual_a1: "Empiezas desde A1, hablando desde la primera clase.",
    qual_btn1: "Inscribirse",
    qual_q2: "¿Ya has estudiado antes pero sientes que algo no ha funcionado?",
    qual_a2: "Grupos de máx. 8, horarios flexibles, clases de 1 hora. Evaluación formativa — sin presión, sin exámenes eliminatorios.",
    payment_t: "Medios de pago",
    payment_p: "LEF acepta PSE y tarjeta de crédito/débito a través de Wompi, de forma segura. El pago se realiza después de inscribirte, desde tu portal de estudiante.",
    diff_eyebrow: "Nuestro diferencial",
    founder_role: "Fundador y Director Académico",
    founder_quotes: [
      "Aprender inglés va más allá de memorizar reglas gramaticales o seguir métodos tradicionales.",
      "La fluidez no nace de la perfección, sino de la constancia con la que nos atrevemos a hablar.",
      "En LEF no formamos estudiantes que memorizan inglés; formamos personas que piensan y se expresan en él.",
      "Cada módulo que diseñamos parte de una pregunta simple: ¿esto le servirá a un estudiante en la vida real?",
      "El verdadero progreso se mide en la confianza con la que alguien se atreve a hablar, no en un examen.",
      "Creemos en un aprendizaje que acompaña, no que presiona — porque el miedo nunca ha enseñado a nadie a hablar mejor."
    ],
    close_support: "Ciclos estructurados, conversación real y acompañamiento continuo — desde tu primera clase.",
    close_cta_primary: "Inscribirme ahora",
    close_cta_secondary: "Escríbenos por WhatsApp",
    footer_tagline: "Un programa de inglés online estructurado, diseñado para una competencia comunicativa real.",
    footer_col_program: "Programa",
    footer_col_contact: "Contacto",
    footer_phone: "Teléfono: +57 301 324 0652",
    footer_location: "Barranquilla, Colombia",
    footer_right: "Barranquilla, Colombia · 2026",
    nav_inscripcion: "Inscripción",
    nav_faq: "Preguntas frecuentes",
    nav_privacy: "Política de privacidad",
    nav_terms: "Términos de uso",
    footer_col_social: "Síguenos",
    footer_email: "informacion@lefcenter.com",
    testi_eyebrow: "Voces de LEF",
    testi_title: "Lo que dicen nuestros estudiantes",
    testi_1_q: "Empecé sin saber presentarme en inglés y en pocos meses ya sostengo conversaciones completas. Las clases se sienten reales, no memorizadas.",
    testi_1_m: "Módulo B1.2",
    testi_2_q: "Los grupos pequeños hacen la diferencia. El profesor conoce mi ritmo y eso me da confianza para hablar sin miedo a equivocarme.",
    testi_2_m: "Nivel A2",
    testi_3_q: "La tutoría al final de cada ciclo resolvió las dudas que se me quedaban pendientes en clase. Se nota el acompañamiento constante.",
    testi_3_m: "Módulo B2.1",
    testi_4_q: "Nunca había hablado inglés y desde la primera clase ya estaba participando. Cero presión, mucho progreso.",
    testi_4_m: "Nivel A1",
    testi_5_q: "Tomé el módulo de entrevistas antes de un proceso de trabajo y llegué mucho más segura. Vale totalmente la pena.",
    testi_5_m: "Módulo C1 Focalizado",
    testi_6_q: "Los horarios flexibles me permitieron seguir estudiando sin chocar con mi trabajo. La plataforma es clara y fácil de usar.",
    testi_6_m: "Nivel B1",
    page_levels_eyebrow: "Estructura del programa",
    page_levels_title: "Elige tu nivel",
    page_levels_intro: "LEF organiza su programa en 12 módulos distribuidos en 4 niveles CEFR — desde tus primeras palabras hasta una conversación fluida e idiomática. Pasa el cursor sobre cada nivel para ver sus tres módulos y qué cubren.",
    levels_closing: "¿No sabes qué nivel te corresponde? No tienes que adivinar — lo confirmamos juntos en tu primera clase, a partir de tu punto de partida real, no de un examen genérico.",
    page_system_eyebrow: "Cómo enseña LEF",
    page_system_title: "El sistema de aprendizaje LEF",
    page_system_intro: "El método de LEF no es una colección de técnicas sueltas — es un sistema. Cada clase, cada material y cada ciclo se construyen sobre los mismos tres pilares, para que el progreso se sienta continuo y no accidental.",
    page_offer_eyebrow: "Incluido en el programa",
    page_offer_title: "Qué ofrece LEF",
    page_offer_intro: "Aprender un idioma bien requiere más que una clase semanal. La oferta de LEF está pensada para que la práctica, los materiales y el acompañamiento apunten en la misma dirección: progreso real y estructurado.",
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

// Inserta el enlace "Iniciar sesión" en el header y el drawer de todas las páginas
// (una sola puerta: /login enruta a admin o portal según el rol).
function initLoginLink(){
  const ICON = '<svg class="login-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
  const headerActions = document.querySelector(".site-header .actions");
  if (headerActions && !headerActions.querySelector(".login-link")){
    const enroll = headerActions.querySelector('a[href="inscripcion.html"]');
    const a = document.createElement("a");
    a.className = "login-link";
    a.href = "login.html";
    a.setAttribute("aria-label", "Iniciar sesión");
    a.innerHTML = ICON + '<span class="login-txt" data-i18n="nav_login">Iniciar sesión</span>';
    headerActions.insertBefore(a, enroll || headerActions.querySelector(".menu-btn"));
  }
  const drawerActions = document.querySelector(".drawer-actions");
  if (drawerActions && !drawerActions.querySelector(".login-link")){
    const a = document.createElement("a");
    a.className = "login-link drawer-login";
    a.href = "login.html";
    a.setAttribute("data-i18n", "nav_login");
    a.textContent = "Iniciar sesión";
    drawerActions.appendChild(a);
  }
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

// El formulario de inscripción ahora es el asistente de 4 pasos (assets/js/lef-enroll.js),
// que habla directo con Supabase.

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

function initHeroCarousel(){
  const slides = document.querySelectorAll(".hero-slide");
  if (slides.length < 2) return;
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove("is-active");
    i = (i + 1) % slides.length;
    slides[i].classList.add("is-active");
  }, 5000);
}

function initFounderQuotes(){
  const el = document.getElementById("founder-quote");
  if (!el) return;
  let i = 0;
  const render = () => {
    const lang = document.documentElement.getAttribute("lang") || "es";
    const quotes = I18N[lang].founder_quotes;
    el.textContent = `“${quotes[i % quotes.length]}”`;
  };
  render();
  setInterval(() => {
    el.classList.add("fade-out");
    setTimeout(() => {
      i++;
      render();
      el.classList.remove("fade-out");
    }, 400);
  }, 5500);
  document.querySelectorAll(".lang-toggle button").forEach(btn => {
    btn.addEventListener("click", render);
  });
}

function initTestimonialCarousels(){
  const wraps = document.querySelectorAll(".testimonial-track-wrap");
  if (!wraps.length) return;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const SPEED = isCoarsePointer ? 55 : 22; // px per second

  wraps.forEach(wrap => {
    const track = wrap.querySelector(".testimonial-track");
    if (!track) return;

    let halfWidth = track.scrollWidth / 2;
    window.addEventListener("resize", () => { halfWidth = track.scrollWidth / 2; });

    let offset = 0;
    let dragging = false;
    let draggingSince = 0;
    let startX = 0;
    let startOffset = 0;

    function wrapOffset(v){
      if (halfWidth <= 0) return 0;
      let r = v % halfWidth;
      if (r < 0) r += halfWidth;
      return r;
    }
    function render(){
      track.style.transform = `translateX(${-offset}px)`;
    }
    function advance(deltaMs){
      if (dragging && Date.now() - draggingSince > 4000) {
        dragging = false;
        wrap.classList.remove("is-dragging");
      }
      if (!dragging && halfWidth > 0) {
        offset = wrapOffset(offset + (SPEED * deltaMs) / 1000);
        render();
      }
    }

    // Smooth path: GPU-composited transform driven by requestAnimationFrame.
    let rafLastTs = null;
    let lastAliveAt = Date.now();
    function rafTick(ts){
      if (rafLastTs !== null) advance(ts - rafLastTs);
      rafLastTs = ts;
      lastAliveAt = Date.now();
      requestAnimationFrame(rafTick);
    }
    requestAnimationFrame(rafTick);

    // Resilience path: if rAF stalls (tab treated as background/inactive by the
    // browser), setInterval keeps advancing so the carousel never freezes.
    setInterval(() => {
      const now = Date.now();
      const sinceAlive = now - lastAliveAt;
      if (sinceAlive > 200) {
        advance(sinceAlive);
        lastAliveAt = now;
      }
    }, 250);

    wrap.addEventListener("pointerdown", e => {
      dragging = true;
      draggingSince = Date.now();
      startX = e.clientX;
      startOffset = offset;
      wrap.classList.add("is-dragging");
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    });
    wrap.addEventListener("pointermove", e => {
      if (!dragging) return;
      draggingSince = Date.now();
      offset = wrapOffset(startOffset - (e.clientX - startX));
      render();
    });
    const release = () => {
      dragging = false;
      wrap.classList.remove("is-dragging");
    };
    wrap.addEventListener("pointerup", release);
    wrap.addEventListener("pointercancel", release);
    wrap.addEventListener("pointerleave", () => { if (dragging) release(); });
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLoginLink();
  initLang();
  initReveal();
  initDrawer();
  initHeroCarousel();
  initFounderQuotes();
  initTestimonialCarousels();
  document.querySelectorAll("nav.links a, .drawer nav.links a").forEach(a => {
    if (a.getAttribute("href") === location.pathname.split("/").pop() || (location.pathname.endsWith("/") && a.getAttribute("href") === "index.html")) {
      a.classList.add("active");
    }
  });
});
