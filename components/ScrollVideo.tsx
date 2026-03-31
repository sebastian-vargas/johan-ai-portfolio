'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const FRAME_COUNT = 259;
const FRAME_SPEED = 1.0; // Velocidad 1 a 1 con el scroll height 
const IMAGE_SCALE = 1.0; // 1.0 Fuerza Fullscreen puro covering

export default function ScrollVideo() {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [framesLoaded, setFramesLoaded] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Track images in a ref to avoid recreating the array
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(-1);

  // Load frames
  useEffect(() => {
    let loaded = 0;
    const loadImages = async () => {
      // First phase: Load first 10 frames fast
      for (let i = 1; i <= Math.min(10, FRAME_COUNT); i++) {
        await loadImage(i);
        loaded++;
        setFramesLoaded(loaded);
      }

      setIsReady(true);

      // Second phase: Load rest in background
      for (let i = 11; i <= FRAME_COUNT; i++) {
        loadImage(i).then(() => {
          loaded++;
          setFramesLoaded(loaded);
        });
      }
    };

    const loadImage = (index: number) => {
      return new Promise((resolve) => {
        const img = new Image();
        const paddedIndex = index.toString().padStart(4, '0');
        img.src = `/frames/frame_${paddedIndex}.webp`;
        img.onload = () => {
          imagesRef.current[index - 1] = img;
          resolve(img);
        };
      });
    };

    loadImages();
  }, []);

  // GSAP AND LENIS INITIALIZATION
  useEffect(() => {
    if (!isReady) return;

    gsap.registerPlugin(ScrollTrigger);

    // Usaremos puramente el motor nativo del navegador + la interpolación matemática de GSAP para evitar bugs de hijacking

    // Canvas drawing function
    const drawFrame = (index: number) => {
      const img = imagesRef.current[index];
      const canvas = canvasRef.current;
      if (!img || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cw = window.innerWidth * window.devicePixelRatio;
      const ch = window.innerHeight * window.devicePixelRatio;

      canvas.width = cw;
      canvas.height = ch;

      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
      // Usar floor/redondeo destruye el temblor de subpíxeles liberando a la GPU para pintar ultra fluido
      const dw = Math.floor(iw * scale);
      const dh = Math.floor(ih * scale);
      const dx = Math.floor((cw - dw) / 2);
      const dy = Math.floor((ch - dh) / 2);

      // Se omite fillRect (fondo negro) logrando máxima velocidad ya que el frame cubrirá todo
      ctx.drawImage(img, dx, dy, dw, dh);
    };

    // Initial draw
    requestAnimationFrame(() => drawFrame(0));

    // Handle Resize
    const handleResize = () => {
      if (currentFrameRef.current >= 0) drawFrame(currentFrameRef.current);
      else drawFrame(0);
    };
    window.addEventListener('resize', handleResize);

    // Bind scroll to frames
    const scrollTl = ScrollTrigger.create({
      trigger: scrollContainerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5, // 1.5 Absorbe completamente el wheel jump de ratones estándar
      onUpdate: (self) => {
        const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
        const index = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);

        if (index !== currentFrameRef.current && imagesRef.current[index]) {
          currentFrameRef.current = index;
          requestAnimationFrame(() => drawFrame(index));
        }
      }
    });

    // Dark Overlay Fade
    const darkOverlay = document.getElementById("dark-overlay");
    ScrollTrigger.create({
      trigger: scrollContainerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5,
      onUpdate: (self) => {
        const p = self.progress;
        // Solo oscurece el video al final (del 85% al 100%) para la llamada a la acción. 
        // Eliminando la inconsistencia con la Sección 1.
        const enter = 0.85;
        const fadeRange = 0.15;
        let opacity = 0;

        if (p >= enter) {
          opacity = Math.min(0.85, (p - enter) / fadeRange);
        }

        if (darkOverlay) darkOverlay.style.opacity = opacity.toString();
      }
    });

    // Animate Sections
    const sections = document.querySelectorAll(".scroll-section");
    sections.forEach((section) => {
      const type = (section as HTMLElement).dataset.animation;
      const children = section.querySelectorAll(
        ".section-label, .section-heading, .section-body, .cta-button, .stat"
      );

      // Default animation
      gsap.from(children, {
        scrollTrigger: {
          trigger: section,
          start: "top 80%",   // Start when top of section hits 80% viewport
          end: "bottom 20%",
          toggleActions: "play reverse play reverse", // Animates in and out gracefully
        },
        y: type === "fade-up" ? 50 : type === "stagger-up" ? 80 : 40,
        opacity: 0,
        scale: type === "scale-up" ? 0.85 : 1,
        filter: type === "blur-up" ? "blur(8px)" : "blur(0px)",
        stagger: 0.15,
        duration: 1.0,
        ease: "power3.out"
      });
    });

    // Hero Fade Out Animation
    const heroOverlay = document.getElementById("hero-overlay");
    ScrollTrigger.create({
      trigger: scrollContainerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5,
      onUpdate: (self) => {
        const p = self.progress;
        const opacity = Math.max(0, 1 - (p / 0.06)); // Fade ultra rápido para evitar chocar con la Sección 1
        if (heroOverlay) {
          heroOverlay.style.opacity = opacity.toString();
          heroOverlay.style.pointerEvents = opacity > 0 ? "auto" : "none";
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [isReady]);

  // CSS Animations for HERO
  useEffect(() => {
    if (isReady) {
      // Trigger heroic words stagger manually if you want or rely on pure CSS
    }
  }, [isReady])

  return (
    <>
      {/* Loader */}
      {!isReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white flex-col">
          <div className="text-xl tracking-[0.2em] font-light mb-4 text-gray-400 uppercase">Obteniendo Entorno</div>
          <div className="w-64 h-1 bg-gray-800 rounded">
            <div
              className="h-full bg-white transition-all duration-300 rounded"
              style={{ width: `${(framesLoaded / Math.min(10, FRAME_COUNT)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* FIXED CANVAS WRAP */}
      <div
        ref={canvasWrapRef}
        className="fixed inset-0 z-0 bg-black"
        style={{ pointerEvents: 'none' }}
      >
        <canvas ref={canvasRef} id="canvas" className="w-full h-full object-cover" />
        {/* Película oscura permanente sobre el video (aumenta drásticamente la lectura de textos en secciones brillantes) */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* GLOBAL DARK OVERLAY */}
      <div
        id="dark-overlay"
        className="fixed inset-0 z-10 bg-black pointer-events-none transition-opacity duration-100 opacity-0"
      />

      {/* HERO OVERLAY - Fixed positioned outside scroll section */}
      <div
        id="hero-overlay"
        className="fixed inset-0 z-20 flex flex-col justify-end p-8 md:p-16 pb-24 md:pb-32"
        style={{ textShadow: '0 2px 30px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.5)' }}
      >
        <h1 className="hero-heading text-6xl md:text-[6rem] lg:text-[7rem] leading-none mb-6 text-white tracking-tighter uppercase font-display mix-blend-difference">
          <span className="block hero-word inline-block origin-bottom">Johan </span>
          <span className="block hero-word inline-block origin-bottom md:-ml-2">System Engineer</span>
        </h1>
        <p className="hero-tagline text-lg md:text-2xl text-gray-300 max-w-xl font-light tracking-wide mix-blend-difference">
          Designing digital experiences that connect, impact and evolve.
        </p>

        <div className="absolute bottom-10 right-10 text-white animate-pulse text-sm uppercase tracking-widest hidden md:block">
          [ Scroll_To_Explore ]
        </div>
      </div>

      {/* SCROLL CONTAINER (The main height forcing block) reducida a 350vh intensificando rapidez */}
      <div ref={scrollContainerRef} id="scroll-container" className="relative z-30 h-[350vh]">

        {/* SECTION 1: ABOUT */}
        <section
          className="scroll-section absolute top-[25%] w-full align-left px-8 md:px-[5vw]"
          data-animation="fade-up"
        >
          <div className="section-inner max-w-2xl text-white">
            <span className="section-label text-sm uppercase tracking-[0.2em] text-gray-400 mb-4 block">
              001 / Engineering
            </span>
            <h2 className="section-heading text-4xl md:text-[3rem] font-display uppercase leading-none mb-8">
              Systems that<br />think for themselves
            </h2>
            <p className="section-body text-xl text-gray-300 font-light leading-relaxed mb-6">
              I build systems that understand, decide, and evolve without constant human intervention.
            </p>
            <p className="section-body text-xl text-gray-300 font-light leading-relaxed">
              By embedding <strong className="text-white font-medium">Artificial Intelligence</strong> directly into the core, I enable automation, continuous learning, and real-time responsiveness. This isn’t the future—it’s the foundation on which everything else is built, allowing systems to anticipate needs, adapt dynamically, and operate intelligently.
            </p>
          </div>
        </section>

        {/* SECTION 2: FRONTEND */}
        <section
          className="scroll-section absolute top-[45%] w-full align-right px-8 md:px-[5vw] flex justify-end"
          data-animation="blur-up"
        >
          <div className="section-inner max-w-2xl text-white">
            <span className="section-label text-sm uppercase tracking-[0.2em] text-gray-400 mb-4 block">
              002 / Core Stack
            </span>
            <h2 className="section-heading text-4xl md:text-[5rem] font-display uppercase leading-none mb-8">
              AI systems
            </h2>
            <p className="section-body text-xl text-gray-300 font-light leading-relaxed mb-4">
              Modern architectures where rendering, data, and intelligence converge into a seamless layer.
            </p>
            <p className="section-body text-xl text-gray-300 font-light leading-relaxed">
              Hybrid rendering, decoupled APIs, and distributed systems designed for high performance — enhanced with <strong className="text-white font-medium">Azure OpenAI</strong>. Leveraging embeddings, natural language understanding, and contextual processing, these integrations power intelligent workflows, real-time decision-making, and dynamic, adaptive user experiences.
            </p>
          </div>
        </section>

        {/* SECTION 3: DATOS */}
        <section
          className="scroll-section section-stats absolute top-[70%] w-full px-8 flex items-center justify-center text-center"
          data-animation="stagger-up"
        >
          <div className="section-inner max-w-4xl text-white">
            <span className="section-label text-sm uppercase tracking-[0.2em] text-gray-400 mb-6 block">
              003 / The Edge
            </span>
            <h2 className="section-heading text-4xl md:text-[3.5rem] font-display uppercase leading-none mb-6 tracking-tight">
              Engineering that <br /><span className="text-gray-400">breaks boundaries</span>
            </h2>
            <p className="section-body text-xl md:text-2xl text-gray-300 font-light leading-relaxed max-w-3xl mx-auto">
              I don’t just translate technical requirements into code. I design <span className="text-white block mt-3 text-2xl font-serif italic">resilient systems</span> built to scale fast, innovate relentlessly, and leave a lasting impact on the end-user experience. Every solution is crafted to push the limits of what technology can achieve.
            </p>
          </div>
        </section>

        {/* SECTION 4: CTA (Persists at end) */}
        <section
          className="scroll-section absolute top-[90%] w-full flex items-center justify-center text-center"
          data-animation="scale-up"
          data-persist="true"
        >
          <div className="section-inner max-w-4xl text-white px-8">
            <h2 className="section-heading text-5xl md:text-[4rem] font-display uppercase leading-none mb-8">
              Start Building
            </h2>
            <a
              href="mailto:sebastian.vargas@utp.edu.co"
              className="inline-block cursor-pointer cta-button mt-8 px-12 py-5 bg-white text-black text-xs md:text-sm tracking-[0.2em] uppercase rounded-full hover:bg-gray-200 transition-colors"
            >
              Contactar a Johan
            </a>
          </div>
        </section>

      </div>
    </>
  );
}
