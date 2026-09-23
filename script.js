// LEF landing — i18n (EN/ES) + reveal-on-scroll + WhatsApp links
// WhatsApp / contact number provided by the client: +57 317 396 2244.
const WHATSAPP_NUMBER = "573173962244";

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
    lvl_a1_cefr: "Modules 1–3",
    lvl_a2_name: "Basic",
    lvl_a2_cefr: "Modules 4–6",
    lvl_b1_name: "Intermediate",
    lvl_b1_cefr: "Modules 7–9",
    lvl_b2_name: "Upper-Intermediate",
    lvl_b2_cefr: "Modules 10–12",
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
    payment_p: "LEF accepts payment by bank transfer/QR (Bre-B key @lefcenter, no fees) or through Wompi (credit/debit card, PSE, Nequi, Bancolombia Button, and other methods the platform enables), securely. Payment is made after enrolling, from your student portal.",
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
    footer_phone: "Phone: +57 317 396 2244",
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
    wa_message: "Hi! I'd like to start my enrollment at LEF. Could you tell me about levels and available schedules?",
    faq_eyebrow: "Have questions?",
    faq_h1: "Frequently asked questions",
    faq_intro: "The most common answers about enrollment, payments, your student portal, schedules and how the program works. If you can't find what you're looking for, message us on WhatsApp and we'll answer you directly.",
    faq_cat_enroll: "Enrollment",
    faq_q1: "How do I enroll at LEF?",
    faq_a1: "Fill out the form on our <a href=\"inscripcion.html\" style=\"color:var(--azul);\">Enrollment page</a> or message us on WhatsApp. The form is a request: it doesn't create any charge. Our team reviews it, contacts you to confirm your level and schedule, and gives you the username and password for your student portal, where you'll see your monthly fee to pay it.",
    faq_q2: "Do I need to take a placement test before starting?",
    faq_a2: "It's not mandatory. If you're not sure about your level, we'll confirm it together in your first class — no admission exam, no pressure.",
    faq_q3: "Can I change my schedule or level after enrolling?",
    faq_a3: "Yes. Message us on WhatsApp and we'll coordinate the change based on group and schedule availability at that time.",
    faq_cat_pay: "Payments",
    faq_q4: "What payment methods do you accept?",
    faq_a4: "You can pay by bank transfer or QR (Bre-B key <strong>@lefcenter</strong>, no fees) or by card through our <strong>Wompi</strong> payment gateway. Both options are in your student portal, under “Billing” → “Pay now”.",
    faq_q5: "How much does each module cost?",
    faq_a5: "Each module has a fixed monthly fee. We confirm it when you enroll and you can always see it in your portal, under “Billing”, together with what you've paid and the pending balance.",
    faq_q6: "Can I pay in installments?",
    faq_a6: "Yes. Your module becomes active with the first installment, and under “Billing” you can see how much is left. Card payments through Wompi are recorded automatically; if you pay by bank transfer, send us the receipt on WhatsApp and we'll record it.",
    faq_q7: "Do I get a receipt for each payment?",
    faq_a7: "Yes. Each payment generates a receipt with a consecutive number (for example, RC25), with the date, amount, method and the payer's details. You'll find it in your portal, under “Billing” → “Payment history”.",
    faq_q8: "Can someone else pay for me?",
    faq_a8: "Yes. The student and the payer can be different people (for example, a parent or guardian). For each payment we record the payer's name and ID document, because the payment record belongs to that person.",
    faq_q9: "Is the Wompi payment gateway secure?",
    faq_a9: "Yes. Wompi is a certified payment platform in Colombia that processes your information securely with encryption. LEF doesn't store your card or account details.",
    faq_cat_portal: "Your student portal",
    faq_q10: "How do I access my portal?",
    faq_a10: "With the email and password LEF gives you, from “Sign in” at lefcenter.com. When you sign in you land on your Home, where you see LEF news, your module, your next class, your payments and your progress.",
    faq_q11: "What happens when I finish a module?",
    faq_a11: "When your cycle's end date passes, the module is marked as completed ✓ in your history. In “My course” you'll see the option to enroll in the next module: its monthly fee is generated and it's activated with your first payment. You can also ask LEF to enroll you.",
    faq_q12: "Do I lose the materials of modules I've already finished?",
    faq_a12: "No. In “My resources” you always have the book and resources for the module you're taking and for every module you've already completed.",
    faq_cat_sched: "Schedules and groups",
    faq_q13: "What schedules do you offer?",
    faq_a13: "We offer morning, afternoon and evening slots. When you enroll you tell us your availability and we set up a group or schedule that works for you.",
    faq_q14: "How many students are in each group?",
    faq_a14: "Groups are small, with a maximum of 8 students, so everyone has real space to speak and practice in every class.",
    faq_q15: "What happens if I miss a class?",
    faq_a15: "We understand that things come up. Message us on WhatsApp to let us know and we'll tell you the options available for your cycle.",
    faq_cat_class: "Classes and platform",
    faq_q16: "What do I need to take the classes?",
    faq_a16: "You just need a computer or phone with a camera, microphone and a stable internet connection. Classes are taught live by video call.",
    faq_q17: "How do I know if I'm making progress?",
    faq_a17: "Your progress is assessed continuously during classes. At the end of each cycle there's a Knowledge Validation Exam, which is not punitive: it's designed to reinforce your learning, not to pressure you. In your portal you can see how many of the 12 modules you've completed.",
    faq_q18: "Do you offer any kind of certificate?",
    faq_a18: "When you complete the modules of your level you can request a progress certificate. Message us on WhatsApp for more details about your particular case.",
    terms_eyebrow: "Before you enroll",
    terms_h1: "Terms of use",
    terms_meta: "Last updated: September 2026 · Document under review, subject to adjustments by LEF's legal team.",
    terms_h2_1: "1. Acceptance of these terms",
    terms_p1_1: "By using this website, submitting an enrollment request, starting the process on WhatsApp or signing in to your student portal, you accept these terms of use together with our <a href=\"politica-privacidad.html\" style=\"color:var(--azul);\">privacy policy</a>. If the student is a minor, their parent or legal guardian accepts them on their behalf.",
    terms_h2_2: "2. Description of the service",
    terms_p2_1: "LEF (Learn English Fluently) is a structured online English program based in Barranquilla, Colombia. It combines live classes, a conversation club, proprietary materials, tutoring and continuous support, organized into 4 CEFR levels (A1–B2) and 12 modules. Every student has an online portal to check their course, payments, study resources and LEF news.",
    terms_h2_3: "3. Enrollment process",
    terms_p3_1: "The form on our <a href=\"inscripcion.html\" style=\"color:var(--azul);\">Enrollment</a> page is a <strong>request</strong>: on its own it does not create any charge or reserve a spot. Our team reviews it and contacts you on WhatsApp to confirm your level and schedule. Once confirmed, LEF creates your enrollment, your student portal account and the monthly fee for your module. You can also start the process directly on WhatsApp.",
    terms_h2_4: "4. Your portal account",
    terms_p4_1: "Your username and password are personal and non-transferable. You are responsible for keeping them private and for any activity carried out with your account; if you suspect someone else is using it, let us know right away so we can lock it and give you new access. LEF may temporarily suspend access in case of misuse of the platform or unpaid monthly fees, as described in section 10.",
    terms_h2_5: "5. Use of the platform and materials",
    terms_p5_1: "LEF's study materials, digital books, exercises and exclusive resources are provided for your personal use as a student. In the “My resources” section of your portal you have the materials for the module you are currently taking and for every module you have already completed. Reproducing, distributing, reselling or sharing these materials outside LEF without prior authorization is not allowed.",
    terms_h2_6: "6. Student commitment",
    terms_p6_1: "As a LEF student, you commit to:",
    terms_p6_2_li1: "Actively participate in every session.",
    terms_p6_2_li2: "Keep respectful communication with teachers and classmates.",
    terms_p6_2_li3: "Attend classes consistently.",
    terms_p6_2_li4: "Complete the assigned tasks.",
    terms_p6_2_li5: "Take responsibility for your own learning.",
    terms_h2_7: "7. Groups and schedules",
    terms_p7_1: "Groups have a maximum of 8 students. Schedule or level changes depend on group availability at the time of the request, and are coordinated on WhatsApp.",
    terms_h2_8: "8. Modules, cycles and moving to the next module",
    terms_p8_1: "Each module is taken during a cycle with a start and end date. When the cycle's end date passes:",
    terms_p8_2_li1: "The module is recorded as completed in your history and that cycle's groups are closed.",
    terms_p8_2_li2: "You can enroll in the next module from your portal (“My course”) or ask LEF to do it; its monthly fee is generated and the module is activated with your first payment.",
    terms_p8_2_li3: "A module you have already completed cannot be enrolled in again.",
    terms_p8_2_li4: "If no payment for that module had been recorded by the end of the cycle, the enrollment for that cycle is cancelled and does not count as a completed module.",
    terms_h2_9: "9. Assessment and progress",
    terms_p9_1: "LEF follows a formative assessment model: progress is monitored continuously through participation and language performance. At the end of each cycle there is a Knowledge Validation Exam, which is not punitive and does not on its own determine level advancement. Teachers may record notes about your progress to support you better.",
    terms_h2_10: "10. Payments",
    terms_p10_1_li1: "Each module has a <strong>fixed monthly fee</strong>, which we tell you when you enroll and which you can always see in your portal (“Billing”), together with what has been paid and the balance.",
    terms_p10_1_li2: "You can pay by bank transfer or QR (Bre-B key <strong>@lefcenter</strong>) or by card through our <strong>Wompi</strong> payment gateway, using the methods Wompi has enabled for LEF.",
    terms_p10_1_li3: "You can pay in <strong>installments</strong>: your module becomes active with the first installment, and the pending balance is shown in your portal until the monthly fee is complete.",
    terms_p10_1_li4: "Wompi payments are recorded automatically. Bank transfer payments are recorded once LEF receives and validates your receipt (send it on WhatsApp).",
    terms_p10_1_li5: "Each payment generates a <strong>receipt with a consecutive number</strong>, kept in your payment history. The payer may be someone other than the student (for example, a guardian); their details are recorded on the receipt.",
    terms_p10_1_li6: "Recorded payments are not deleted: if there is an error, it is corrected with a documented reversal entry.",
    terms_p10_1_li7: "If there are overdue monthly fees, LEF may freeze the account until they are brought up to date.",
    terms_h2_11: "11. Changes, cancellations and rescheduling",
    terms_p11_1: "If you need to cancel your spot, change your schedule or reschedule a class, write to us on WhatsApp as early as possible. Each request is evaluated according to the current cycle and group availability.",
    terms_h2_12: "12. Limitation of liability",
    terms_p12_1: "LEF is not liable for service interruptions caused by internet, power or student device failures, by failures of third-party services (payment gateway, hosting, digital book viewer), or by force majeure beyond our control.",
    terms_h2_13: "13. Changes to these terms",
    terms_p13_1: "We may update these terms of use to reflect changes in the program, the platform or applicable regulations. The date of the last update is shown at the top of this document.",
    terms_h2_14: "14. Governing law",
    terms_p14_1: "These terms are governed by the laws of the Republic of Colombia.",
    terms_h2_15: "15. Contact",
    terms_p15_1: "For questions about these terms, write to us at <a href=\"mailto:informacion@lefcenter.com\" style=\"color:var(--azul);\">informacion@lefcenter.com</a> or on WhatsApp (+57 317 396 2244).",
    privacy_eyebrow: "Your data, your rights",
    privacy_h1: "Privacy policy",
    privacy_meta: "Last updated: September 2026 · Document under review, subject to adjustments by LEF's legal team.",
    privacy_h2_1: "1. Who we are",
    privacy_p1_1: "This policy applies to the website and platform of <strong>LEF — Learn English Fluently</strong> (student portal and administrative panel), an online English academy based in Barranquilla, Colombia. LEF is responsible for processing the personal data you share with us through the enrollment form, the portal, WhatsApp or email.",
    privacy_h2_2: "2. What data we collect",
    privacy_p2_1: "Depending on your relationship with LEF, we may collect:",
    privacy_p2_2_li1: "Student identification and contact details: full name, ID document type and number, WhatsApp/phone, email, age and city.",
    privacy_p2_2_li2: "Enrollment request preferences: estimated English level, module and preferred schedule.",
    privacy_p2_2_li3: "Payer details, when the payer is someone other than the student: name, ID document type and number, email and phone.",
    privacy_p2_2_li4: "Academic information: enrollment number, completed and current modules, group, schedule, teacher and progress notes recorded by teachers.",
    privacy_p2_2_li5: "Payment information: amounts, dates, methods, receipt number and status. LEF does not receive or store your card details.",
    privacy_p2_2_li6: "Account data: sign-in email, profile photo (optional) and technical sign-in records needed to keep your account secure.",
    privacy_p2_3: "The site stores your language preference in your browser's local storage and, if you sign in, your active session (so you are not asked for your password on every page). We do not use advertising tracking cookies or third-party analytics.",
    privacy_h2_3: "3. How we use your data",
    privacy_p3_1: "We use your information exclusively to:",
    privacy_p3_2_li1: "Manage your request, your enrollment and your portal account.",
    privacy_p3_2_li2: "Coordinate your level, schedule and group, and keep a record of the modules you take.",
    privacy_p3_2_li3: "Generate your monthly fees, record your payments, issue receipts and keep the accounting records required by law.",
    privacy_p3_2_li4: "Give you access to your course, your study resources and LEF news in the portal.",
    privacy_p3_2_li5: "Send you communications about your account (sign-in credentials, password recovery, payment or class notices) by email or WhatsApp.",
    privacy_p3_2_li6: "Protect your account and the platform against unauthorized or automated access.",
    privacy_p3_2_li7: "Answer your questions and provide academic support.",
    privacy_p3_3: "We do not sell, rent or share your personal data with third parties for commercial purposes unrelated to LEF.",
    privacy_h2_4: "4. Who can see your data",
    privacy_p4_1_li1: "You, from your student portal.",
    privacy_p4_1_li2: "LEF's administrative team, to manage enrollments, groups and payments.",
    privacy_p4_1_li3: "The teacher assigned to your group: they see your name, contact details and module, and may record notes about your progress. They do not see your payment information.",
    privacy_h2_5: "5. Providers that help us deliver the service",
    privacy_p5_1: "To run the platform we use providers that process data on LEF's behalf (data processors), only for the stated purpose:",
    privacy_p5_2_li1: "<strong>Supabase</strong>: database, sign-in and file storage.",
    privacy_p5_2_li2: "<strong>Vercel</strong>: website hosting.",
    privacy_p5_2_li3: "<strong>Wompi</strong>: card payment processing.",
    privacy_p5_2_li4: "<strong>Resend</strong>: sending account emails (credentials and password recovery).",
    privacy_p5_2_li5: "<strong>Cloudflare Turnstile</strong>: verifying that whoever signs in is a person and not an automated program.",
    privacy_p5_2_li6: "<strong>Heyzine</strong>: viewer for the digital books you see in “My resources”.",
    privacy_p5_2_li7: "<strong>Google Workspace</strong> (Classroom and Calendar): used by teachers with their LEF accounts to plan their classes; LEF does not send your platform information to Google this way.",
    privacy_p5_3: "Some of these providers have servers outside Colombia. By accepting this policy you authorize that international data transfer, which is made solely to deliver the service and with providers that apply recognized security measures.",
    privacy_h2_6: "6. Online payments",
    privacy_p6_1: "When you pay by card through <strong>Wompi</strong>, your payment method details are processed directly by Wompi and are not stored by LEF; Wompi applies its own security and privacy policies. If you pay by bank transfer or QR, the transaction happens between your bank and LEF's account. In both cases LEF only records what is needed for your account and the accounting records: amount, date, method, status, receipt number and the payer's details.",
    privacy_h2_7: "7. Legal basis",
    privacy_p7_1: "Your data is processed based on your express authorization, given when you submit the enrollment request, write to us voluntarily or use the portal, in accordance with Colombia's <strong>Law 1581 of 2012</strong> and Decree 1377 of 2013 (personal data protection / Habeas Data), and on compliance with legal, accounting and tax obligations.",
    privacy_h2_8: "8. Your rights as data subject",
    privacy_p8_1: "Under Law 1581 of 2012, you have the right to:",
    privacy_p8_2_li1: "Know, update and correct your personal data.",
    privacy_p8_2_li2: "Request proof of the authorization given to LEF.",
    privacy_p8_2_li3: "Be informed about how your data has been used.",
    privacy_p8_2_li4: "Request deletion of your data when there is no legal duty or obligation to keep it.",
    privacy_p8_2_li5: "Revoke the authorization given at any time.",
    privacy_p8_2_li6: "Access your personal data free of charge.",
    privacy_p8_2_li7: "File complaints with the Superintendence of Industry and Commerce (SIC) for violations of the law.",
    privacy_p8_3: "To exercise any of these rights, write to us at <a href=\"mailto:informacion@lefcenter.com\" style=\"color:var(--azul);\">informacion@lefcenter.com</a> or on WhatsApp (+57 317 396 2244), stating your request. You can also update some of your data yourself (name, photo and password) from “My account” in the portal.",
    privacy_h2_9: "9. Data retention",
    privacy_p9_1: "We keep your data for as long as your relationship with LEF lasts and for the additional time needed to meet legal or academic obligations. If your account is deleted, your enrollment and access are removed, but payment records are kept as accounting support for the period required by law (up to 10 years for commercial books and records), without being linked back to an active account. You can request deletion of the rest of your data at any time, as described in section 8.",
    privacy_h2_10: "10. Minors",
    privacy_p10_1: "If the student is a minor, enrollment and authorization to process their data are given by their parent or legal guardian, who is usually also the payer. We process minors' data respecting their best interests and only for the educational purposes described.",
    privacy_h2_11: "11. Information security",
    privacy_p11_1: "We apply reasonable measures to protect your data: passwords are stored encrypted by our sign-in provider (nobody at LEF can see them), each person only accesses what corresponds to their role (student, teacher or administrator), and changes to payments are recorded in a log that cannot be edited or deleted. No internet channel is 100% secure, so we cannot guarantee absolute security.",
    privacy_h2_12: "12. Changes to this policy",
    privacy_p12_1: "This policy may be updated to reflect changes in our practices, the platform or applicable regulations. The date of the last update is shown at the top of this document.",
    privacy_h2_13: "13. Contact",
    privacy_p13_1: "If you have questions about this privacy policy, write to us at <a href=\"mailto:informacion@lefcenter.com\" style=\"color:var(--azul);\">informacion@lefcenter.com</a> or on WhatsApp (+57 317 396 2244).",
    wz: {
      step_data: "Your details", step_level: "Your level", step_time: "Time slot", step_review: "Review",
      h1: "Tell us about yourself",
      sub1: "We'll use this information to contact you on WhatsApp and continue your process.",
      name: "Student's full name", doctype: "Document type", docnum: "Document number",
      phone: "WhatsApp number", email: "Email address", age: "Age", city: "City",
      doc_ti: "Identity card (TI, for minors)", doc_cc: "Citizenship ID (CC)", doc_ce: "Foreign resident ID (CE)", doc_pp: "Passport",
      continue: "Continue →", back: "← Back",
      err_step1: "Check the name, document, WhatsApp number, and email.",
      h2: "Which English level do you identify with best?",
      sub2: "It's just a reference for your advisor — it doesn't set your final module. We'll confirm it with you before starting.",
      lvl_beginner_label: "Beginner", lvl_beginner_range: "A1 – A2",
      lvl_beginner_desc: "You know the basics: greeting, introducing yourself, counting, talking about your routine. You find it hard to hold a full conversation in English.",
      lvl_intermediate_label: "Intermediate", lvl_intermediate_range: "B1 – B2",
      lvl_intermediate_desc: "You can talk about everyday topics, understand simple texts or videos, and share your opinion, even if you make mistakes.",
      lvl_advanced_label: "Advanced", lvl_advanced_range: "C1 and above",
      lvl_advanced_desc: "You communicate fluently on most topics, understand complex content, and want to refine your level.",
      h3: "What time slot would you like for your classes?",
      sub3: "This is also a preference, not a booking — availability depends on the open cycle and may vary.",
      time_morning_label: "Morning", time_morning_range: "6:00 a.m. – 12:00 p.m.",
      time_morning_desc: "Ideal if you study or work in the afternoon or evening.",
      time_afternoon_label: "Afternoon", time_afternoon_range: "12:00 p.m. – 6:00 p.m.",
      time_afternoon_desc: "The most requested slot — make sure it doesn't clash with lunch or school pick-up.",
      time_evening_label: "Evening", time_evening_range: "6:00 p.m. – 9:00 p.m.",
      time_evening_desc: "Designed for those who work or study during the day.",
      note3: "The slot you choose helps us coordinate with you, but the final schedule is confirmed based on the spots and groups available at the time of your enrollment — it may not exactly match what you selected here.",
      h4: "Review and submit",
      sub4: "Make sure everything is correct. This is a pre-enrollment request: no enrollment number is generated yet. An LEF advisor will review your details and contact you on WhatsApp to continue.",
      row_name: "Name", row_doc: "Document", row_wa: "WhatsApp", row_email: "Email",
      row_level: "Level (your self-assessment)", row_time: "Preferred time slot",
      consent: "I agree that LEF may contact me by WhatsApp and email to follow up on my request.",
      submit: "Submit request", submitting: "Sending…",
      done_h: "Thank you! We received your request",
      done_sub: "An LEF advisor will contact you soon on WhatsApp to continue your enrollment process. You can also message us right now.",
      done_level: "Level", done_wa: "Message us on WhatsApp",
      err_recent: "We already received a request from you in the last few hours. Our team will contact you soon — or message us on WhatsApp.",
      err_missing: "Required information is missing. Check the name, WhatsApp number, and email.",
      err_generic: "We couldn't send your request. Try again or message us on WhatsApp.",
      wa_result: "Hi! I just submitted my pre-enrollment request at LEF.\nName: {name}\nLevel I identify with: {level}\nMy preferred time slot: {time}\nI'll be waiting for an advisor to reach out to me."
    }
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
    lvl_a1_cefr: "Módulos 1–3",
    lvl_a2_name: "Básico",
    lvl_a2_cefr: "Módulos 4–6",
    lvl_b1_name: "Intermedio",
    lvl_b1_cefr: "Módulos 7–9",
    lvl_b2_name: "Intermedio alto",
    lvl_b2_cefr: "Módulos 10–12",
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
    payment_p: "LEF acepta pago por transferencia/QR bancario (llave Bre-B @lefcenter, sin comisión) o a través de Wompi (tarjeta de crédito/débito, PSE, Nequi, Botón Bancolombia y demás medios que la plataforma habilite), de forma segura. El pago se realiza después de inscribirte, desde tu portal de estudiante.",
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
    footer_phone: "Teléfono: +57 317 396 2244",
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
    wa_message: "¡Hola! Quiero iniciar mi inscripción en LEF. ¿Podrían contarme sobre los niveles y horarios disponibles?",
    faq_eyebrow: "¿Tienes dudas?",
    faq_h1: "Preguntas frecuentes",
    faq_intro: "Las respuestas más comunes sobre inscripción, pagos, tu portal de estudiante, horarios y cómo funciona el programa. Si no encuentras lo que buscas, escríbenos por WhatsApp y te respondemos directamente.",
    faq_cat_enroll: "Inscripción",
    faq_q1: "¿Cómo me inscribo en LEF?",
    faq_a1: "Completa el formulario de nuestra <a href=\"inscripcion.html\" style=\"color:var(--azul);\">página de Inscripción</a> o escríbenos por WhatsApp. El formulario es una solicitud: no genera ningún cobro. Nuestro equipo la revisa, te contacta para confirmar tu nivel y horario, y te entrega el usuario y la contraseña de tu portal de estudiante, donde verás tu mensualidad para pagarla.",
    faq_q2: "¿Necesito hacer un examen de nivel antes de empezar?",
    faq_a2: "No es obligatorio. Si no estás seguro de tu nivel, lo confirmamos juntos en tu primera clase — sin examen de admisión ni presión.",
    faq_q3: "¿Puedo cambiar mi horario o nivel después de inscribirme?",
    faq_a3: "Sí. Escríbenos por WhatsApp y coordinamos el cambio según la disponibilidad de grupos y horarios en ese momento.",
    faq_cat_pay: "Pagos",
    faq_q4: "¿Qué métodos de pago aceptan?",
    faq_a4: "Puedes pagar por transferencia o QR bancario (llave Bre-B <strong>@lefcenter</strong>, sin comisión) o con tarjeta a través de nuestra pasarela de pagos <strong>Wompi</strong>. Ambas opciones están en tu portal de estudiante, en “Facturación” → “Pagar ahora”.",
    faq_q5: "¿Cuánto cuesta cada módulo?",
    faq_a5: "Cada módulo tiene una mensualidad de valor fijo. Te la confirmamos al inscribirte y siempre la ves en tu portal, en “Facturación”, junto con lo que llevas pagado y el saldo pendiente.",
    faq_q6: "¿Puedo pagar en abonos?",
    faq_a6: "Sí. Desde el primer abono tu módulo queda activo, y en “Facturación” ves cuánto te falta. Los pagos con tarjeta por Wompi se registran solos; si pagas por transferencia, envíanos el comprobante por WhatsApp y lo registramos.",
    faq_q7: "¿Recibo un comprobante de cada pago?",
    faq_a7: "Sí. Cada pago genera un recibo con número consecutivo (por ejemplo, RC25), con la fecha, el valor, el método y los datos de quien pagó. Lo encuentras en tu portal, en “Facturación” → “Historial de pagos”.",
    faq_q8: "¿Otra persona puede pagar por mí?",
    faq_a8: "Sí. El estudiante y quien paga pueden ser personas distintas (por ejemplo, un padre, madre o acudiente). En cada pago registramos el nombre y el documento de quien paga, porque es a esa persona a quien corresponde el soporte del pago.",
    faq_q9: "¿Es segura la pasarela de pagos Wompi?",
    faq_a9: "Sí. Wompi es una plataforma de pagos certificada en Colombia que procesa tu información de forma cifrada. LEF no almacena los datos de tu tarjeta ni de tu cuenta.",
    faq_cat_portal: "Tu portal de estudiante",
    faq_q10: "¿Cómo entro a mi portal?",
    faq_a10: "Con el correo y la contraseña que te entrega LEF, desde “Iniciar sesión” en lefcenter.com. Al entrar llegas a tu Inicio, donde ves las novedades de LEF, tu módulo, tu próxima clase, tus pagos y tu progreso.",
    faq_q11: "¿Qué pasa cuando termino un módulo?",
    faq_a11: "Cuando termina la fecha de tu ciclo, el módulo queda completado ✓ en tu historial. En “Mi curso” te aparece la opción de matricularte en el siguiente módulo: se genera su mensualidad y se activa con tu primer pago. También puedes pedirle a LEF que te matricule.",
    faq_q12: "¿Pierdo el material de los módulos que ya terminé?",
    faq_a12: "No. En “Mis recursos” siempre tienes el libro y los recursos del módulo que estás cursando y de todos los que ya completaste.",
    faq_cat_sched: "Horarios y grupos",
    faq_q13: "¿Qué horarios manejan?",
    faq_a13: "Ofrecemos franjas en la mañana, la tarde y la noche. Al inscribirte nos cuentas tu disponibilidad y armamos un grupo u horario que se ajuste a ti.",
    faq_q14: "¿Cuántos estudiantes hay por grupo?",
    faq_a14: "Los grupos son pequeños, de máximo 8 estudiantes, para que cada persona tenga espacio real para hablar y practicar en cada clase.",
    faq_q15: "¿Qué pasa si falto a una clase?",
    faq_a15: "Entendemos que pueden surgir imprevistos. Escríbenos por WhatsApp para avisarnos y te contamos las opciones disponibles según tu ciclo.",
    faq_cat_class: "Clases y plataforma",
    faq_q16: "¿Qué necesito para tomar las clases?",
    faq_a16: "Solo necesitas un computador o celular con cámara, micrófono y conexión estable a internet. Las clases se dictan en vivo por videollamada.",
    faq_q17: "¿Cómo sé si estoy progresando?",
    faq_a17: "Tu progreso se evalúa de forma continua durante las clases. Al final de cada ciclo hay un Examen de Validación de Conocimientos, que no es punitivo: está diseñado para reforzar tu aprendizaje, no para presionarte. En tu portal ves cuántos de los 12 módulos llevas completados.",
    faq_q18: "¿Ofrecen algún tipo de constancia o certificado?",
    faq_a18: "Al completar los módulos de tu nivel puedes solicitar una constancia de progreso. Escríbenos por WhatsApp para más detalles sobre tu caso particular.",
    terms_eyebrow: "Antes de inscribirte",
    terms_h1: "Términos de uso",
    terms_meta: "Última actualización: septiembre de 2026 · Documento en revisión, sujeto a ajustes por el equipo legal de LEF.",
    terms_h2_1: "1. Aceptación de estos términos",
    terms_p1_1: "Al usar este sitio web, enviar una solicitud de inscripción, iniciar el proceso por WhatsApp o ingresar a tu portal de estudiante, aceptas estos términos de uso junto con nuestra <a href=\"politica-privacidad.html\" style=\"color:var(--azul);\">política de privacidad</a>. Si el estudiante es menor de edad, los acepta su padre, madre o acudiente.",
    terms_h2_2: "2. Descripción del servicio",
    terms_p2_1: "LEF (Learn English Fluently) es un programa de inglés online estructurado, con sede en Barranquilla, Colombia. Combina clases en vivo, club de conversación, materiales propios, tutorías y acompañamiento continuo, organizado en 4 niveles CEFR (A1–B2) y 12 módulos. Cada estudiante tiene un portal en línea donde consulta su curso, sus pagos, sus recursos de estudio y las novedades de LEF.",
    terms_h2_3: "3. Proceso de inscripción",
    terms_p3_1: "El formulario de nuestra página de <a href=\"inscripcion.html\" style=\"color:var(--azul);\">Inscripción</a> es una <strong>solicitud</strong>: no genera cobros ni reserva un cupo por sí sola. Nuestro equipo la revisa y te contacta por WhatsApp para confirmar tu nivel y horario. Al confirmarse, LEF crea tu matrícula, tu cuenta en el portal de estudiante y la mensualidad de tu módulo. También puedes iniciar el proceso directamente por WhatsApp.",
    terms_h2_4: "4. Tu cuenta en el portal",
    terms_p4_1: "Tu usuario y contraseña son personales e intransferibles. Eres responsable de mantenerlos en reserva y de la actividad que se realice con tu cuenta; si sospechas que alguien más la usa, avísanos de inmediato para bloquearla y darte acceso nuevo. LEF puede suspender temporalmente el acceso en caso de uso indebido de la plataforma o de mensualidades pendientes, según el punto 10.",
    terms_h2_5: "5. Uso de la plataforma y los materiales",
    terms_p5_1: "Los materiales de estudio, libros digitales, ejercicios y recursos exclusivos de LEF se entregan para tu uso personal como estudiante. En la sección “Mis recursos” de tu portal tienes el material del módulo que estás cursando y el de todos los módulos que ya completaste. No está permitido reproducir, distribuir, revender ni compartir estos materiales fuera de LEF sin autorización previa.",
    terms_h2_6: "6. Compromiso del estudiante",
    terms_p6_1: "Como estudiante de LEF, te comprometes a:",
    terms_p6_2_li1: "Participar activamente en cada sesión.",
    terms_p6_2_li2: "Mantener una comunicación respetuosa con profesores y compañeros.",
    terms_p6_2_li3: "Asistir a clases de forma constante.",
    terms_p6_2_li4: "Completar las tareas asignadas.",
    terms_p6_2_li5: "Asumir la responsabilidad de tu propio aprendizaje.",
    terms_h2_7: "7. Grupos y horarios",
    terms_p7_1: "Los grupos son de máximo 8 estudiantes. Los cambios de horario o de nivel están sujetos a la disponibilidad de grupos en el momento de la solicitud, y se coordinan por WhatsApp.",
    terms_h2_8: "8. Módulos, ciclos y paso al siguiente módulo",
    terms_p8_1: "Cada módulo se cursa en un ciclo con fecha de inicio y de fin. Cuando termina la fecha del ciclo:",
    terms_p8_2_li1: "El módulo queda registrado como completado en tu historial y los grupos de ese ciclo se cierran.",
    terms_p8_2_li2: "Puedes matricularte en el siguiente módulo desde tu portal (“Mi curso”) o pedírselo a LEF; se genera su mensualidad y el módulo se activa con tu primer pago.",
    terms_p8_2_li3: "Un módulo que ya completaste no se vuelve a matricular.",
    terms_p8_2_li4: "Si al terminar el ciclo no se había registrado ningún pago de ese módulo, la inscripción de ese ciclo se cancela y no cuenta como módulo cursado.",
    terms_h2_9: "9. Evaluación y progreso",
    terms_p9_1: "LEF sigue un modelo de evaluación formativa: el progreso se monitorea de forma continua a través de la participación y el desempeño en el idioma. Al final de cada ciclo se presenta un Examen de Validación de Conocimientos, que no es punitivo ni determina por sí solo el avance de nivel. Los profesores pueden registrar anotaciones sobre tu progreso para acompañarte mejor.",
    terms_h2_10: "10. Pagos",
    terms_p10_1_li1: "Cada módulo tiene una <strong>mensualidad de valor fijo</strong>, que te informamos al inscribirte y que siempre ves en tu portal (“Facturación”), junto con lo pagado y el saldo.",
    terms_p10_1_li2: "Puedes pagar por transferencia o QR bancario (llave Bre-B <strong>@lefcenter</strong>) o con tarjeta a través de nuestra pasarela <strong>Wompi</strong>, con los medios que Wompi tenga habilitados para LEF.",
    terms_p10_1_li3: "Puedes pagar en <strong>abonos</strong>: desde el primer abono tu módulo queda activo, y el saldo pendiente se muestra en tu portal hasta completar la mensualidad.",
    terms_p10_1_li4: "Los pagos con Wompi se registran automáticamente. Los pagos por transferencia se registran cuando LEF recibe y valida tu comprobante (envíalo por WhatsApp).",
    terms_p10_1_li5: "Cada pago genera un <strong>recibo con número consecutivo</strong>, que queda en tu historial de pagos. Quien paga puede ser una persona distinta al estudiante (por ejemplo, un acudiente); sus datos se registran en el recibo.",
    terms_p10_1_li6: "Los pagos registrados no se borran: si hay un error, se corrige con un asiento de reverso que queda documentado.",
    terms_p10_1_li7: "Si hay mensualidades vencidas, LEF puede congelar la cuenta hasta que se pongan al día.",
    terms_h2_11: "11. Cambios, cancelaciones y reprogramaciones",
    terms_p11_1: "Si necesitas cancelar tu cupo, cambiar de horario o reprogramar una clase, escríbenos por WhatsApp con la mayor anticipación posible. Cada solicitud se evalúa según el ciclo en curso y la disponibilidad de grupos.",
    terms_h2_12: "12. Limitación de responsabilidad",
    terms_p12_1: "LEF no se hace responsable por interrupciones del servicio derivadas de fallas de conexión a internet, de energía eléctrica o de dispositivos del estudiante, de fallas de servicios de terceros (pasarela de pagos, alojamiento, visor de libros digitales), ni por causas de fuerza mayor ajenas a nuestro control.",
    terms_h2_13: "13. Modificaciones de estos términos",
    terms_p13_1: "Podemos actualizar estos términos de uso para reflejar cambios en el programa, en la plataforma o en la normativa aplicable. La fecha de la última actualización se indica al inicio de este documento.",
    terms_h2_14: "14. Ley aplicable",
    terms_p14_1: "Estos términos se rigen por las leyes de la República de Colombia.",
    terms_h2_15: "15. Contacto",
    terms_p15_1: "Para preguntas sobre estos términos, escríbenos a <a href=\"mailto:informacion@lefcenter.com\" style=\"color:var(--azul);\">informacion@lefcenter.com</a> o por WhatsApp (+57 317 396 2244).",
    privacy_eyebrow: "Tus datos, tus derechos",
    privacy_h1: "Política de privacidad",
    privacy_meta: "Última actualización: septiembre de 2026 · Documento en revisión, sujeto a ajustes por el equipo legal de LEF.",
    privacy_h2_1: "1. Quiénes somos",
    privacy_p1_1: "Esta política aplica al sitio web y a la plataforma de <strong>LEF — Learn English Fluently</strong> (portal de estudiantes y panel administrativo), academia de inglés online con sede en Barranquilla, Colombia. LEF es responsable del tratamiento de los datos personales que nos compartes por el formulario de inscripción, el portal, WhatsApp o correo electrónico.",
    privacy_h2_2: "2. Qué datos recopilamos",
    privacy_p2_1: "Según tu relación con LEF, podemos recopilar:",
    privacy_p2_2_li1: "Datos de identificación y contacto del estudiante: nombre completo, tipo y número de documento de identidad, WhatsApp/teléfono, correo, edad y ciudad.",
    privacy_p2_2_li2: "Preferencias de la solicitud de inscripción: nivel de inglés estimado, módulo y horario de interés.",
    privacy_p2_2_li3: "Datos de quien paga, si es una persona distinta al estudiante: nombre, tipo y número de documento, correo y teléfono.",
    privacy_p2_2_li4: "Información académica: matrícula, módulos cursados y en curso, grupo, horario, profesor y anotaciones de progreso que registran los profesores.",
    privacy_p2_2_li5: "Información de pagos: valores, fechas, métodos, número de recibo y estado. LEF no recibe ni guarda los datos de tu tarjeta.",
    privacy_p2_2_li6: "Datos de tu cuenta: correo de acceso, foto de perfil (opcional) y registros técnicos de inicio de sesión necesarios para la seguridad de la cuenta.",
    privacy_p2_3: "El sitio guarda en el almacenamiento local de tu navegador tu preferencia de idioma y, si inicias sesión, tu sesión activa (para no pedirte la contraseña en cada página). No usamos cookies de rastreo publicitario ni analítica de terceros.",
    privacy_h2_3: "3. Para qué usamos tus datos",
    privacy_p3_1: "Usamos tu información exclusivamente para:",
    privacy_p3_2_li1: "Gestionar tu solicitud, tu matrícula y tu cuenta en el portal.",
    privacy_p3_2_li2: "Coordinar tu nivel, horario y grupo, y llevar el historial de los módulos que cursas.",
    privacy_p3_2_li3: "Generar tus mensualidades, registrar tus pagos, emitir recibos y llevar el registro contable que exige la ley.",
    privacy_p3_2_li4: "Darte acceso a tu curso, tus recursos de estudio y las novedades de LEF en el portal.",
    privacy_p3_2_li5: "Enviarte comunicaciones sobre tu cuenta (credenciales de acceso, recuperación de contraseña, avisos de pago o de clases) por correo o WhatsApp.",
    privacy_p3_2_li6: "Proteger tu cuenta y la plataforma frente a accesos no autorizados o automatizados.",
    privacy_p3_2_li7: "Responder tus preguntas y darte soporte académico.",
    privacy_p3_3: "No vendemos, alquilamos ni compartimos tus datos personales con terceros para fines comerciales ajenos a LEF.",
    privacy_h2_4: "4. Quién puede ver tus datos",
    privacy_p4_1_li1: "Tú, desde tu portal de estudiante.",
    privacy_p4_1_li2: "El equipo administrativo de LEF, para gestionar inscripciones, grupos y pagos.",
    privacy_p4_1_li3: "El profesor asignado a tu grupo: ve tu nombre, datos de contacto y módulo, y puede registrar anotaciones sobre tu progreso. No ve tu información de pagos.",
    privacy_h2_5: "5. Proveedores que nos ayudan a prestar el servicio",
    privacy_p5_1: "Para operar la plataforma usamos proveedores que tratan datos por cuenta de LEF (encargados del tratamiento), solo para la función indicada:",
    privacy_p5_2_li1: "<strong>Supabase</strong>: base de datos, inicio de sesión y almacenamiento de archivos.",
    privacy_p5_2_li2: "<strong>Vercel</strong>: alojamiento del sitio web.",
    privacy_p5_2_li3: "<strong>Wompi</strong>: procesamiento de pagos con tarjeta.",
    privacy_p5_2_li4: "<strong>Resend</strong>: envío de correos de la cuenta (credenciales y recuperación de contraseña).",
    privacy_p5_2_li5: "<strong>Cloudflare Turnstile</strong>: verificación de que quien inicia sesión es una persona y no un programa automatizado.",
    privacy_p5_2_li6: "<strong>Heyzine</strong>: visor de los libros digitales que ves en “Mis recursos”.",
    privacy_p5_2_li7: "<strong>Google Workspace</strong> (Classroom y Calendar): lo usan los profesores con sus cuentas de LEF para planear sus clases; LEF no envía tu información de la plataforma a Google por esta vía.",
    privacy_p5_3: "Algunos de estos proveedores tienen servidores fuera de Colombia. Al aceptar esta política autorizas esa transferencia internacional de datos, que se hace únicamente para prestar el servicio y con proveedores que aplican medidas de seguridad reconocidas.",
    privacy_h2_6: "6. Pagos en línea",
    privacy_p6_1: "Cuando pagas con tarjeta a través de <strong>Wompi</strong>, la información de tu medio de pago la procesa directamente Wompi y no la almacena LEF; Wompi aplica sus propias políticas de seguridad y privacidad. Si pagas por transferencia o QR bancario, la transacción ocurre entre tu banco y la cuenta de LEF. En ambos casos LEF solo registra lo necesario para tu cuenta y el soporte contable: valor, fecha, método, estado, número de recibo y los datos de quien paga.",
    privacy_h2_7: "7. Base legal",
    privacy_p7_1: "El tratamiento de tus datos se basa en tu autorización expresa, otorgada al enviar la solicitud de inscripción, al escribirnos voluntariamente o al usar el portal, conforme a la <strong>Ley 1581 de 2012</strong> y el Decreto 1377 de 2013 de Colombia (régimen de protección de datos personales / Habeas Data), y en el cumplimiento de obligaciones legales, contables y tributarias.",
    privacy_h2_8: "8. Tus derechos como titular de los datos",
    privacy_p8_1: "De acuerdo con la Ley 1581 de 2012, tienes derecho a:",
    privacy_p8_2_li1: "Conocer, actualizar y rectificar tus datos personales.",
    privacy_p8_2_li2: "Solicitar prueba de la autorización otorgada a LEF.",
    privacy_p8_2_li3: "Ser informado sobre el uso que se le ha dado a tus datos.",
    privacy_p8_2_li4: "Solicitar la supresión de tus datos cuando no exista un deber legal u obligación de conservarlos.",
    privacy_p8_2_li5: "Revocar la autorización otorgada en cualquier momento.",
    privacy_p8_2_li6: "Acceder de forma gratuita a tus datos personales.",
    privacy_p8_2_li7: "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.",
    privacy_p8_3: "Para ejercer cualquiera de estos derechos, escríbenos a <a href=\"mailto:informacion@lefcenter.com\" style=\"color:var(--azul);\">informacion@lefcenter.com</a> o por WhatsApp (+57 317 396 2244), indicando tu solicitud. Varios de tus datos (nombre, foto y contraseña) también los puedes actualizar tú mismo desde “Mi cuenta” en el portal.",
    privacy_h2_9: "9. Conservación de tus datos",
    privacy_p9_1: "Conservamos tus datos mientras dure tu relación con LEF y el tiempo adicional necesario para cumplir obligaciones legales o académicas. Si se elimina tu cuenta, se borran tu inscripción y tu acceso, pero los registros de pagos se conservan como soporte contable durante el término que exige la ley (hasta 10 años para los libros y papeles de comercio), sin volver a vincularse a una cuenta activa. Puedes solicitar la supresión del resto de tus datos en cualquier momento, según el punto 8.",
    privacy_h2_10: "10. Menores de edad",
    privacy_p10_1: "Si el estudiante es menor de edad, la inscripción y la autorización para el tratamiento de sus datos las otorga su padre, madre o acudiente legal, quien normalmente es también la persona que paga. Tratamos los datos de menores respetando su interés superior y solo para los fines educativos descritos.",
    privacy_h2_11: "11. Seguridad de la información",
    privacy_p11_1: "Aplicamos medidas razonables para proteger tus datos: las contraseñas se guardan cifradas por nuestro proveedor de inicio de sesión (nadie en LEF puede verlas), cada persona solo accede a lo que le corresponde según su rol (estudiante, profesor o administrador), y los cambios sobre pagos quedan anotados en un registro que no se puede editar ni borrar. Ningún medio por internet es 100% seguro, por lo que no podemos garantizar seguridad absoluta.",
    privacy_h2_12: "12. Cambios a esta política",
    privacy_p12_1: "Esta política puede actualizarse para reflejar cambios en nuestras prácticas, en la plataforma o en la normativa aplicable. La fecha de la última actualización se indica al inicio de este documento.",
    privacy_h2_13: "13. Contacto",
    privacy_p13_1: "Si tienes preguntas sobre esta política de privacidad, escríbenos a <a href=\"mailto:informacion@lefcenter.com\" style=\"color:var(--azul);\">informacion@lefcenter.com</a> o por WhatsApp (+57 317 396 2244).",
    wz: {
      step_data: "Tus datos", step_level: "Tu nivel", step_time: "Franja horaria", step_review: "Revisar",
      h1: "Cuéntanos sobre ti",
      sub1: "Usaremos esta información para contactarte por WhatsApp y continuar tu proceso.",
      name: "Nombre completo del estudiante", doctype: "Tipo de documento", docnum: "Número de documento",
      phone: "Número de WhatsApp", email: "Correo electrónico", age: "Edad", city: "Ciudad",
      doc_ti: "Tarjeta de identidad", doc_cc: "Cédula de ciudadanía", doc_ce: "Cédula de extranjería", doc_pp: "Pasaporte",
      continue: "Continuar →", back: "← Atrás",
      err_step1: "Revisa el nombre, el documento, el WhatsApp y el correo.",
      h2: "¿Con cuál nivel de inglés te identificas mejor?",
      sub2: "Es solo una referencia para tu asesor — no define tu módulo final. Lo confirmamos contigo antes de empezar.",
      lvl_beginner_label: "Principiante", lvl_beginner_range: "A1 – A2",
      lvl_beginner_desc: "Conoces lo básico: saludar, presentarte, contar, hablar de tu rutina. Te cuesta mantener una conversación completa en inglés.",
      lvl_intermediate_label: "Intermedio", lvl_intermediate_range: "B1 – B2",
      lvl_intermediate_desc: "Puedes conversar sobre temas cotidianos, entender textos o videos sencillos, y dar tu opinión, aunque cometas errores.",
      lvl_advanced_label: "Avanzado", lvl_advanced_range: "C1 en adelante",
      lvl_advanced_desc: "Te comunicas con fluidez en la mayoría de los temas, entiendes contenido complejo y buscas perfeccionar tu nivel.",
      h3: "¿En qué franja horaria te gustaría tomar tus clases?",
      sub3: "También es una preferencia, no una reserva — la disponibilidad depende del ciclo abierto y puede variar.",
      time_morning_label: "Mañana", time_morning_range: "6:00 a.m. – 12:00 p.m.",
      time_morning_desc: "Ideal si estudias o trabajas en jornada de tarde o noche.",
      time_afternoon_label: "Tarde", time_afternoon_range: "12:00 p.m. – 6:00 p.m.",
      time_afternoon_desc: "La franja más solicitada — revisa que no choque con almuerzo o salida del colegio.",
      time_evening_label: "Noche", time_evening_range: "6:00 p.m. – 9:00 p.m.",
      time_evening_desc: "Pensada para quienes trabajan o estudian durante el día.",
      note3: "La franja que elijas nos ayuda a coordinar contigo, pero el horario final se confirma según los cupos y grupos disponibles al momento de tu inscripción — puede que no coincida exactamente con lo que elegiste aquí.",
      h4: "Revisa y envía",
      sub4: "Verifica que todo esté correcto. Esto es una solicitud de pre-inscripción: no se genera matrícula todavía. Un asesor de LEF revisará tus datos y te contactará por WhatsApp para continuar.",
      row_name: "Nombre", row_doc: "Documento", row_wa: "WhatsApp", row_email: "Correo",
      row_level: "Nivel (tu autoevaluación)", row_time: "Franja preferida",
      consent: "Acepto que LEF me contacte por WhatsApp y correo para dar seguimiento a mi solicitud.",
      submit: "Enviar solicitud", submitting: "Enviando…",
      done_h: "¡Gracias! Recibimos tu solicitud",
      done_sub: "Un asesor de LEF se pondrá en contacto contigo pronto por WhatsApp para continuar con tu proceso de inscripción. También puedes escribirnos tú ahora.",
      done_level: "Nivel", done_wa: "Escríbenos por WhatsApp",
      err_recent: "Ya recibimos una solicitud tuya en las últimas horas. Nuestro equipo te contactará pronto — o escríbenos por WhatsApp.",
      err_missing: "Faltan datos obligatorios. Revisa el nombre, el WhatsApp y el correo.",
      err_generic: "No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.",
      wa_result: "¡Hola! Acabo de enviar mi solicitud de pre-inscripción en LEF.\nNombre: {name}\nNivel con el que me identifico: {level}\nFranja horaria de mi preferencia: {time}\nQuedo atento(a) a que un asesor se comunique conmigo."
    }
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
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
  document.querySelectorAll(".wa-target").forEach(el => {
    el.setAttribute("href", waLink(lang));
  });
  document.documentElement.setAttribute("lang", lang);
  document.querySelectorAll(".lang-toggle button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
  try { localStorage.setItem("lef-lang", lang); } catch (e) {}
  document.dispatchEvent(new CustomEvent("lef:langchange", { detail: { lang } }));
}

window.LEF_I18N = I18N;

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
