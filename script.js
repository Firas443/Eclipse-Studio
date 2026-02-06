document.documentElement.classList.add("js");

/* ---------------------------------
   STARFIELD (HERO ONLY)
   - canvas sized to heroWrap
   - pause when hero off-screen
   - DPR capped
---------------------------------- */
const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d", { alpha: true });

const heroWrap = document.querySelector(".heroWrap");

let W = 0, H = 0;
let DPR = 1;
let SCALE = 0.8;
let stars = [];

const SPEED = 0.55;
const BASE_ALPHA = 0.16;
let STAR_COUNT = 120;

function computeCounts(w, h) {
  const area = w * h;
  const isSmall = w < 900;
  STAR_COUNT = isSmall ? 85 : 120;
  if (area > 2200000) STAR_COUNT -= 20;
}

function makeStar(randomY = false) {
  return {
    x: Math.random() * W,
    y: randomY ? Math.random() * H : -20,
    r: Math.random() * 1.1 + 0.35,
    a: BASE_ALPHA + Math.random() * 0.18,
    v: Math.random() * 32 + 14,
    drift: Math.random() * 10 - 5,
    seed: Math.random() * 1000
  };
}

function resizeStars() {
  if (!heroWrap) return;

  // size = hero only
  const rect = heroWrap.getBoundingClientRect();
  const heroW = Math.max(1, Math.floor(rect.width));
  const heroH = Math.max(1, Math.floor(rect.height));

  DPR = Math.min(1.25, window.devicePixelRatio || 1);
  SCALE = heroW < 900 ? 0.75 : 0.82;

  computeCounts(heroW, heroH);

  const cw = Math.floor(heroW * DPR * SCALE);
  const ch = Math.floor(heroH * DPR * SCALE);

  canvas.width = cw;
  canvas.height = ch;

  // CSS already sets 100%, but keep it explicit
  canvas.style.width = heroW + "px";
  canvas.style.height = heroH + "px";

  W = cw;
  H = ch;

  stars = Array.from({ length: STAR_COUNT }, () => makeStar(true));
}

window.addEventListener("resize", resizeStars, { passive: true });
resizeStars();

/* Pause logic: tab hidden OR hero not visible */
let running = true;
let heroVisible = true;

document.addEventListener("visibilitychange", () => {
  running = !document.hidden;
});

if (heroWrap) {
  const heroIO = new IntersectionObserver(
    (entries) => {
      heroVisible = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0.05 }
  );
  heroIO.observe(heroWrap);
}

let last = performance.now();
function drawStars(now) {
  requestAnimationFrame(drawStars);

  // Only animate when it matters
  if (!running || !heroVisible) return;

  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];

    s.y += s.v * dt * SPEED;
    s.x += s.drift * dt * 0.25;

    if (s.y > H + 30) stars[i] = makeStar(false);
    if (s.x < -40) s.x = W + 40;
    if (s.x > W + 40) s.x = -40;

    const tw = 0.6 + Math.sin(now * 0.0016 + s.seed) * 0.4;
    const alpha = Math.min(0.9, s.a * (0.8 + tw * 0.7));

    ctx.beginPath();
    ctx.fillStyle = `rgba(248,247,255,${alpha})`;
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

requestAnimationFrame(drawStars);

/* --------------------------------------------
   2) Specks around the sculpture (less)
--------------------------------------------- */
const specks = document.getElementById("specks");
if (specks) {
  const N = 20; // reduced
  for (let i = 0; i < N; i++) {
    const d = document.createElement("i");
    d.style.left = (Math.random() * 100).toFixed(2) + "%";
    d.style.top = (Math.random() * 100).toFixed(2) + "%";
    d.style.animationDelay = (Math.random() * 6).toFixed(2) + "s";
    d.style.opacity = (0.18 + Math.random() * 0.35).toFixed(2);
    specks.appendChild(d);
  }
}

/* --------------------------------------------
   3) Parallax (throttled + lighter)
--------------------------------------------- */
const visual = document.getElementById("visual");
const sculpture = document.getElementById("sculpture");
const bloom = document.getElementById("bloom");
const beltGlow = document.getElementById("beltGlow");
const iris = document.getElementById("iris");
const ring1 = document.getElementById("ring1");
const ring2 = document.getElementById("ring2");
const ring3 = document.getElementById("ring3");

let tx = 0, ty = 0, cx = 0, cy = 0;
let raf = 0;

function parallaxMove(e) {
  if (!visual) return;
  const r = visual.getBoundingClientRect();
  const x = (e.clientX - (r.left + r.width / 2)) / r.width;
  const y = (e.clientY - (r.top + r.height / 2)) / r.height;
  tx = Math.max(-0.6, Math.min(0.6, x));
  ty = Math.max(-0.6, Math.min(0.6, y));
  if (!raf) raf = requestAnimationFrame(parallaxTick);
}

function parallaxTick() {
  raf = 0;
  cx += (tx - cx) * 0.08;
  cy += (ty - cy) * 0.08;

  if (sculpture) sculpture.style.transform = `translate(${cx * 10}px, ${cy * 8}px)`;
  if (bloom) bloom.style.transform = `translate(${cx * 14}px, ${cy * 10}px)`;
  if (beltGlow) beltGlow.style.transform = `translate(calc(-50% + ${cx * 8}px), calc(-50% + ${cy * 6}px))`;

  if (ring1) ring1.style.transform = `rotateX(${64 + cy * 5}deg) rotateZ(${20 + cx * 9}deg)`;
  if (ring2) ring2.style.transform = `rotateX(${74 + cy * 6}deg) rotateZ(${-18 + cx * 10}deg)`;
  if (ring3) ring3.style.transform = `rotateX(${56 + cy * 4}deg) rotateZ(${52 + cx * 7}deg)`;

  if (iris) iris.style.filter = `blur(.2px) drop-shadow(0 0 ${20 + Math.abs(cx) * 10}px rgba(226,190,255,.20))`;
}

const fine = window.matchMedia && window.matchMedia("(pointer:fine)").matches;
if (fine) window.addEventListener("mousemove", parallaxMove, { passive: true });

/* --------------------------------------------
   4) Reveal (safe: never hides content)
--------------------------------------------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) e.target.classList.add("isVisible");
  }
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach(el => io.observe(el));

/* --------------------------------------------
   5) Portfolio filters
--------------------------------------------- */
const filterBtns = document.querySelectorAll(".filter");
const projects = document.querySelectorAll(".project");

function setActive(btn) {
  filterBtns.forEach(b => {
    b.classList.toggle("isActive", b === btn);
    b.setAttribute("aria-selected", b === btn ? "true" : "false");
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    setActive(btn);
    const f = btn.dataset.filter;
    projects.forEach(card => {
      const cat = card.dataset.cat;
      const show = (f === "all") || (cat === f);
      card.style.display = show ? "" : "none";
    });
  });
});

/* --------------------------------------------
   6) Mobile menu
--------------------------------------------- */
const menuBtn = document.querySelector(".menuBtn");
const mobileNav = document.getElementById("mobileNav");
const closeNav = document.getElementById("closeNav");

function openNav() {
  if (!mobileNav || !menuBtn) return;
  mobileNav.style.display = "block";
  mobileNav.setAttribute("aria-hidden", "false");
  menuBtn.setAttribute("aria-expanded", "true");
}
function hideNav() {
  if (!mobileNav || !menuBtn) return;
  mobileNav.style.display = "none";
  mobileNav.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false");
}
if (menuBtn) menuBtn.addEventListener("click", openNav);
if (closeNav) closeNav.addEventListener("click", hideNav);
if (mobileNav) {
  mobileNav.addEventListener("click", (e) => {
    if (e.target === mobileNav) hideNav();
  });
  mobileNav.querySelectorAll("a").forEach(a => a.addEventListener("click", hideNav));
}

/* --------------------------------------------
   7) Footer year
--------------------------------------------- */
const y = document.getElementById("year");
if (y) y.textContent = new Date().getFullYear();


/* --------------------------------------------
   8) language Toggle
--------------------------------------------- */
// ===================== i18n (EN / FR) =====================
const I18N = {
  en: {
    // Brand
    "brand.name": "Eclipse Studio",
    "brand.tagline": "Freelance Creative Agency",

    // Nav
    "nav.about": "About",
    "nav.services": "Services",
    "nav.tools": "Tools",
    "nav.portfolio": "Portfolio",
    "nav.process": "Process",
    "nav.contact": "Contact",
    "mobileNav.title": "Navigation",

    // Hero
    "hero.chip": `<span class="spark" aria-hidden="true"></span>Premium creative studio — Quietly powerful`,
    "hero.title": "Eclipse Studio",
    "hero.subtitle": `We craft <b>websites</b>, <b>Flutter apps</b>, <b>video edits</b>, <b>brand visuals</b>, and <b>3D</b> — focused, restrained, and built to last.`,
    "hero.meta": "Web • Flutter • Design • Video • 3D",
    "hero.viewWork": ` <span class="icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7 17L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M9 7h8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>View Work`,
    "hero.contact": "Contact",

    // Hero cards + whisper
    "heroCard.web.k": `<span class="pip"></span>Web Design`,
    "heroCard.web.v": "Glass UI, sharp hierarchy, memorable layouts.",
    "heroCard.flutter.k": `<span class="pip"></span>Flutter`,
    "heroCard.flutter.v": "Clean flows, responsive screens, smooth motion.",
    "heroCard.visual.k": `<span class="pip"></span>Visual Craft`,
    "heroCard.visual.v": "Branding, edits, 3D — made to feel premium.",
    "hero.whisper": "Space bends.",

    // About
    "about.eyebrow": "About",
    "about.title": "Small studio, Big finish",
    "about.lead": `Eclipse Studio is a freelance agency focused on clean aesthetics, storytelling, and high-end polish.
We build websites that feel considered, apps that move smoothly, and visuals people remember without trying.`,
    "about.believe.title": "What we believe",
    "about.believe.body": "Great design is quiet confidence — clear structure, strong contrast, and details you only notice when they’re gone.",
    "about.believe.p1": "Clarity",
    "about.believe.p2": "Presence",
    "about.believe.p3": "Impact",
    "about.get.title": "What you get",
    "about.get.l1": "Modern layout & personalized UI",
    "about.get.l2": "Responsive design (mobile → desktop)",
    "about.get.l3": "Assets optimized & clean structure",
    "about.get.l4": "Micro-interactions that feel alive",
    "about.best.title": "Best for",
    "about.best.l1": "Landing pages that convert",
    "about.best.l2": "Personal brands & portfolios",
    "about.best.l3": "Business websites & product pages",
    "about.best.l4": "UI kits & app design systems",

    // Services
    "services.eyebrow": "Services",
    "services.title": "One studio, Multiple disciplines",
    "services.lead": "Pick what you need — or combine them for a cohesive launch.",

    "svc.web.title": "Websites",
    "svc.web.body": "Landing pages, portfolios, and business sites — structured for clarity, designed to feel premium.",
    "svc.web.t1": "UI/UX",
    "svc.web.t2": "Web Design",
    "svc.web.t3": "Front-end",

    "svc.flutter.title": "Flutter Apps",
    "svc.flutter.body": "Mobile apps with smooth flow, modern screens, and layouts ready for production.",
    "svc.flutter.t1": "Flutter",
    "svc.flutter.t2": "Mobile UI",
    "svc.flutter.t3": "Flow",

    "svc.video.title": "Video Montage",
    "svc.video.body": "Short-form edits with rhythm, clean subtitles, and pacing that keeps attention.",
    "svc.video.t1": "Reels",
    "svc.video.t2": "Short-form",
    "svc.video.t3": "Subtitles",

    "svc.graphic.title": "Graphic Design",
    "svc.graphic.body": "Branding packs, social visuals, identity systems that look consistent everywhere.",
    "svc.graphic.t1": "Branding",
    "svc.graphic.t2": "Posters",
    "svc.graphic.t3": "Social",

    "svc.model3d.title": "3D Models",
    "svc.model3d.body": "Product renders, scene models, and stylized assets for modern visuals.",
    "svc.model3d.t1": "3D",
    "svc.model3d.t2": "Render",
    "svc.model3d.t3": "Assets",

    "svc.launch.title": "Full Launch Kit",
    "svc.launch.body": "Website, brand, visuals, and motion — one direction, one clear identity.",
    "svc.launch.t1": "System",
    "svc.launch.t2": "Consistency",
    "svc.launch.t3": "Impact",

    // Tools
    "tools.eyebrow": "Tools & Technologies",
    "tools.title": "Clean stack, Fast delivery",
    "tools.lead": "We choose tools that keep things consistent, scalable, and easy to maintain.",
    "tools.web.title": "Web",
    "tools.web.p1": "HTML",
    "tools.web.p2": "CSS",
    "tools.web.p3": "JavaScript",
    "tools.web.p4": "Responsive",
    "tools.web.p5": "Animations",
    "tools.apps.title": "Apps",
    "tools.apps.p1": "Flutter",
    "tools.apps.p2": "Dart",
    "tools.apps.p3": "UI Systems",
    "tools.apps.p4": "State Patterns",
    "tools.design.title": "Design",
    "tools.design.p1": "Figma",
    "tools.design.p2": "Design Tokens",
    "tools.design.p3": "Brand Systems",
    "tools.design.p4": "Prototyping",
    "tools.video3d.title": "Video / 3D",
    "tools.video3d.p1": "After Effects",
    "tools.video3d.p2": "Premiere",
    "tools.video3d.p3": "Blender",
    "tools.video3d.p4": "Rendering",

    // Portfolio section
    "portfolio.eyebrow": "Portfolio",
    "portfolio.title": "Selected web design projects",
    "portfolio.lead": "Curated web design concepts — built to feel real, clear, and intentional.",

    "filters.all": "All",
    "filters.landing": "Landing",
    "filters.portfolio": "Portfolio",
    "filters.ecom": "E-commerce",
    "filters.saas": "SaaS",

    "projects.btn": "View Case Study",

    "p1.title": "Restaurant Landing",
    "p1.badge": "Web",
    "p1.desc": "Premium menu spotlight & reservations push. Designed for clarity and trust.",
    "p1.tag1": "Landing Page",
    "p1.tag2": "UI/UX",
    "p1.tag3": "Conversion",

    "p2.title": "Personal Brand Portfolio",
    "p2.badge": "Web + Identity",
    "p2.desc": "A memorable site built around personality, story, and hireable presence.",
    "p2.tag1": "Portfolio",
    "p2.tag2": "Branding",
    "p2.tag3": "Story",

    "p3.title": "NeonOps SaaS Website",
    "p3.badge": "Web App",
    "p3.desc": "Crisp sections, product clarity, and a dashboard-style visual language.",
    "p3.tag1": "SaaS",
    "p3.tag2": "UI System",
    "p3.tag3": "Trust",

    "p4.title": "LuxCart E-commerce",
    "p4.badge": "Shop",
    "p4.desc": "Product focus, fast scanning, and a checkout flow designed to reduce friction.",
    "p4.tag1": "E-commerce",
    "p4.tag2": "Conversion",
    "p4.tag3": "Product UI",

    "p5.title": "Aurora Event Landing",
    "p5.badge": "Web",
    "p5.desc": "A bold landing with clear sections, RSVP focus, and premium typography rhythm.",
    "p5.tag1": "Landing Page",
    "p5.tag2": "Layout",
    "p5.tag3": "Story",

    // Process
    "process.eyebrow": "Process",
    "process.title": "Simple steps, Clean results",
    "process.lead": "No chaos. Just clarity — from first message to final delivery.",

    "process.s1.title": "Direction",
    "process.s1.body": "We align on goals, references, and the desired tone: premium, minimal, cosmic.",
    "process.s1.p1": "Brief",
    "process.s1.p2": "Mood",
    "process.s1.p3": "Scope",

    "process.s2.title": "Design",
    "process.s2.body": "Layout, typography, spacing, and components — crafted for clarity and rhythm.",
    "process.s2.p1": "UI Kit",
    "process.s2.p2": "Hierarchy",
    "process.s2.p3": "Polish",

    "process.s3.title": "Build",
    "process.s3.body": "Responsive implementation with smooth interactions and performance-friendly effects.",
    "process.s3.p1": "Responsive",
    "process.s3.p2": "Motion",
    "process.s3.p3": "Clean Code",

    "process.s4.title": "Deliver",
    "process.s4.body": "A meticulous final pass — every detail refined, every asset polished, ready for handoff.",
    "process.s4.p1": "QA",
    "process.s4.p2": "Consistency",
    "process.s4.p3": "Handoff",

    // Footer
    "footer.title": "Let’s build something you’ll be proud to put your name on.",
    "footer.sub": "If you have an idea (or even a rough draft), send it. We reply with a clear direction and what we’d do first.",
    "footer.emailLabel": "EMAIL",
    "footer.phoneLabel": "PHONE",
    "footer.elsewhereLabel": "ELSEWHERE",
    "footer.behance": "Behance",
    "footer.facebook": "Facebook",
    "footer.mini": "Eclipse Studio — websites, Flutter apps, video edits, design & 3D.",
    "footer.viewProjects": "View projects",
    "footer.rights": "© <span id=\"year\"></span> Eclipse Studio. All rights reserved.",
    "footer.note": "Built with restraint, precision, and a touch of the cosmic.",

    // Trust keys
    "trust.response.k": "Response",
    "trust.response.v": "Clear, Direct, Reliable",
    "trust.style.k": "Style",
    "trust.style.v": "Minimal, intentional, premium",
    "trust.delivery.k": "Delivery",
    "trust.delivery.v": "Finished, Refined, Ready",
  },

  fr: {
    // Brand
    "brand.name": "Eclipse Studio",
    "brand.tagline": "Agence créative freelance",

    // Nav
    "nav.about": "À propos",
    "nav.services": "Services",
    "nav.tools": "Outils",
    "nav.portfolio": "Portfolio",
    "nav.process": "Processus",
    "nav.contact": "Contact",
    "mobileNav.title": "Navigation",

    // Hero
    "hero.chip": `<span class="spark" aria-hidden="true"></span>Studio créatif premium — puissant en toute discrétion`,
    "hero.title": "Eclipse Studio",
    "hero.subtitle": `Nous créons des <b>sites web</b>, des <b>apps Flutter</b>, du <b>montage vidéo</b>, une <b>identité visuelle</b> et de la <b>3D</b> — minimal, précis, et éternel.`,
    "hero.meta": "Web • Flutter • Design • Vidéo • 3D",
    "hero.viewWork": ` <span class="icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7 17L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M9 7h8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>Voir les projets`,
    "hero.contact": "Nous Contacter",

    // Hero cards + whisper
    "heroCard.web.k": `<span class="pip"></span>Web design`,
    "heroCard.web.v": "UI personnalisé, hiérarchie claire, mises en page méticuleuse.",
    "heroCard.flutter.k": `<span class="pip"></span>Flutter`,
    "heroCard.flutter.v": "Parcours clairs, réponse rapide , fluidité.",
    "heroCard.visual.k": `<span class="pip"></span>Art visuel`,
    "heroCard.visual.v": "Branding, montage, 3D — une finition premium.",
    

    // About
    "about.eyebrow": "À propos",
    "about.title": "Petit studio, grand rendu",
    "about.lead": `Eclipse Studio est une agence freelance axée sur l’esthétique épurée, le storytelling et les finitions haut de gamme.
Nous créons des sites réfléchis, des apps fluides et des visuels qu’on retient sans effort.`,
    "about.believe.title": "Notre conviction",
    "about.believe.body": "Le bon design, c’est une confiance silencieuse — structure claire, contraste fort, et des détails que l'on ne remarque que lorsqu'ils disparaissent.",
    "about.believe.p1": "Clarté",
    "about.believe.p2": "Présence",
    "about.believe.p3": "Impact",
    "about.get.title": "Ce que vous obtenez",
    "about.get.l1": "Mise en page moderne & UI personnalisée",
    "about.get.l2": "Design adaptable (mobile → desktop)",
    "about.get.l3": "Ressources optimisées & structure propre",
    "about.get.l4": "Micro-interactions vivantes",
    "about.best.title": "Idéal pour",
    "about.best.l1": "Pages de destination (Landing pages) qui convertissent",
    "about.best.l2": "Marques personnelles & portfolios",
    "about.best.l3": "Sites business & pages produit",
    "about.best.l4": "Kits UI & systèmes de design d'applications",

    // Services
    "services.eyebrow": "Services",
    "services.title": "Un studio, plusieurs disciplines",
    "services.lead": "Choisissez ce dont vous avez besoin — ou combinez-les pour un lancement complet.",

    "svc.web.title": "Sites web",
    "svc.web.body": "Landing pages, portfolios et sites business — structurés pour la clarté, conçus pour l'excellence.",
    "svc.web.t1": "UI/UX",
    "svc.web.t2": "Web design",
    "svc.web.t3": "Front-end",

    "svc.flutter.title": "Applications Flutter",
    "svc.flutter.body": "Apps mobiles fluides , interfaces prêts pour la production.",
    "svc.flutter.t1": "Flutter",
    "svc.flutter.t2": "UI mobile",
    "svc.flutter.t3": "Flow",

    "svc.video.title": "Montage vidéo",
    "svc.video.body": "Formats courts rythmés, sous-titres nets et un tempo qui capte l'attention.",
    "svc.video.t1": "Reels",
    "svc.video.t2": "Formats courts",
    "svc.video.t3": "Sous-titres",

    "svc.graphic.title": "Design graphique",
    "svc.graphic.body": "Branding packs, systèmes d'identité cohérents.",
    "svc.graphic.t1": "Branding",
    "svc.graphic.t2": "Affiches",
    "svc.graphic.t3": "Social",

    "svc.model3d.title": "Modèles 3D",
    "svc.model3d.body": "Rendus de produits, modélisation de scènes, et ressources stylisés pour des visuels modernes.",
    "svc.model3d.t1": "3D",
    "svc.model3d.t2": "Rendu",
    "svc.model3d.t3": "Assets",

    "svc.launch.title": "Kit de lancement",
    "svc.launch.body": "Site, branding, visuels et motion design — une seule direction, une identité claire.",
    "svc.launch.t1": "Système",
    "svc.launch.t2": "Cohérence",
    "svc.launch.t3": "Impact",

    // Tools
    "tools.eyebrow": "Outils & Technologies",
    "tools.title": "Stack propre, livraison rapide",
    "tools.lead": "Nous choisissons des outils qui garantissent cohérence, évolutivité et facilité de maintenance.",
    "tools.web.title": "Web",
    "tools.web.p1": "HTML",
    "tools.web.p2": "CSS",
    "tools.web.p3": "JavaScript",
    "tools.web.p4": "Réactif",
    "tools.web.p5": "Animations",
    "tools.apps.title": "Apps",
    "tools.apps.p1": "Flutter",
    "tools.apps.p2": "Dart",
    "tools.apps.p3": "Systèmes UI",
    "tools.apps.p4": "Patterns d’état",
    "tools.design.title": "Design",
    "tools.design.p1": "Figma",
    "tools.design.p2": "Design tokens",
    "tools.design.p3": "Systèmes de marque",
    "tools.design.p4": "Prototype",
    "tools.video3d.title": "Vidéo / 3D",
    "tools.video3d.p1": "After Effects",
    "tools.video3d.p2": "Premiere",
    "tools.video3d.p3": "Blender",
    "tools.video3d.p4": "Render",

    // Portfolio
    "portfolio.eyebrow": "Portfolio",
    "portfolio.title": "Projets web design ",
    "portfolio.lead": "Concepts web design — pensés pour être clairs, crédibles et marquants.",

    "filters.all": "Tout",
    "filters.landing": "Page d'acceuil",
    "filters.portfolio": "Portfolio",
    "filters.ecom": "E-commerce",
    "filters.saas": "SaaS",

    "projects.btn": "Voir le projet",

    "p1.title": "Page d'acceuil restaurant",
    "p1.badge": "Web",
    "p1.desc": "Mise en avant d'un menu premium qui incitate à la réservation. Mis au point pour la clarté et la confiance.",
    "p1.tag1": "Page d'acceuil",
    "p1.tag2": "UI/UX",
    "p1.tag3": "Conversion",

    "p2.title": "Portfolio  de marque personnelle",
    "p2.badge": "Web + Identité",
    "p2.desc": "Un site mémorable axé sur la personnalité, l'histoire et la présence professionnelle..",
    "p2.tag1": "Portfolio",
    "p2.tag2": "Branding",
    "p2.tag3": "Histoire",

    "p3.title": "Site SaaS NeonOps",
    "p3.badge": "Web App",
    "p3.desc": "Sections nettes, clarté du produit et langage visuel de type tableau de bord.",
    "p3.tag1": "SaaS",
    "p3.tag2": "Système UI",
    "p3.tag3": "Confiance",

    "p4.title": "E-commerce LuxCart",
    "p4.badge": "Boutique",
    "p4.desc": "Boutique de produits,lecture rapide, et un checkout pensé pour réduire la friction.",
    "p4.tag1": "E-commerce",
    "p4.tag2": "Conversion",
    "p4.tag3": "UI produit",

    "p5.title": "Landing événement Aurora",
    "p5.badge": "Web",
    "p5.desc": "Une landing audacieuse, sections claires, RSVP au centre, typographie premium.",
    "p5.tag1": "Landing page",
    "p5.tag2": "Mise en page",
    "p5.tag3": "Récit",

    // Process
    "process.eyebrow": "Process",
    "process.title": "Étapes simples, rendu clean",
    "process.lead": "Pas de chaos. Juste de la clarté — du premier message à la livraison.",

    "process.s1.title": "Direction",
    "process.s1.body": "On s’aligne sur les objectifs, les références et le ton : premium, minimal, cosmique.",
    "process.s1.p1": "Brief",
    "process.s1.p2": "Mood",
    "process.s1.p3": "Scope",

    "process.s2.title": "Design",
    "process.s2.body": "Layout, typo, spacing, composants — travaillés pour la clarté et le rythme.",
    "process.s2.p1": "UI kit",
    "process.s2.p2": "Hiérarchie",
    "process.s2.p3": "Polish",

    "process.s3.title": "Build",
    "process.s3.body": "Implémentation responsive avec interactions fluides et effets performants.",
    "process.s3.p1": "Responsive",
    "process.s3.p2": "Motion",
    "process.s3.p3": "Code propre",

    "process.s4.title": "Livrer",
    "process.s4.body": "Dernière passe méticuleuse — détails raffinés, assets polis, prêt à livrer.",
    "process.s4.p1": "QA",
    "process.s4.p2": "Cohérence",
    "process.s4.p3": "Handoff",

    // Footer
    "footer.title": "Construisons quelque chose dont vous serez fier d’y mettre votre nom.",
    "footer.sub": "Si vous avez une idée (même brouillon), envoyez-la. On répond avec une direction claire et la première étape.",
    "footer.emailLabel": "EMAIL",
    "footer.phoneLabel": "TÉLÉPHONE",
    "footer.elsewhereLabel": "AUSSI",
    "footer.behance": "Behance",
    "footer.facebook": "Facebook",
    "footer.mini": "Eclipse Studio — sites web, apps Flutter, montage vidéo, design & 3D.",
    "footer.viewProjects": "Voir les projets",
    "footer.rights": "© <span id=\"year\"></span> Eclipse Studio. Tous droits réservés.",
    "footer.note": "Construit avec retenue, précision, et une touche cosmique.",

    // Trust
    "trust.response.k": "Réponse",
    "trust.response.v": "Claire, directe, fiable",
    "trust.style.k": "Style",
    "trust.style.v": "Minimal, intentionnel, premium",
    "trust.delivery.k": "Livraison",
    "trust.delivery.v": "Finie, raffinée, prête",
  }
};

function applyLanguage(lang) {
  const dict = I18N[lang] || I18N.en;

  document.documentElement.lang = lang;

  const toggle = document.getElementById("langToggle");
  if (toggle) toggle.setAttribute("data-active", lang);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = dict[key];
    if (val == null) return;

    // Keep HTML when needed (bold tags, svg icon, spans...)
    el.innerHTML = val;
  });

  localStorage.setItem("lang", lang);
}

function initLanguageToggle() {
  const toggle = document.getElementById("langToggle");
  if (!toggle) return;

  const saved = localStorage.getItem("lang");
  const browser = (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
  const startLang = saved || browser;

  applyLanguage(startLang);

  toggle.addEventListener("click", () => {
    const current = document.documentElement.lang === "fr" ? "fr" : "en";
    applyLanguage(current === "fr" ? "en" : "fr");
  });

  toggle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle.click();
    }
  });
}

// Ensure it runs even if other script.js code exists
document.addEventListener("DOMContentLoaded", initLanguageToggle);
