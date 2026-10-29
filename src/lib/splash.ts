// First-visit splash screen. Plays once per browser session (see the
// "splash-seen" check in Layout.astro); tap to skip. Three.js is loaded only
// when the splash plays. Without WebGL, or with reduced motion, the logo
// simply fades in.

const LOAD_TIMEOUT = 1500; // give up on the animation if Three.js is slower than this

export function runSplash() {
  const splash = document.getElementById("splash");
  if (!splash || document.documentElement.classList.contains("splash-seen")) return;
  try {
    sessionStorage.setItem("tsc_splash_seen", "1");
  } catch {}

  const logo = document.getElementById("splash-logo");
  const canvas = document.getElementById("splash-canvas") as HTMLCanvasElement | null;
  let stopAnimation = () => {};
  let finished = false;
  let fellBack = false;

  const showLogo = () => {
    if (logo) logo.style.opacity = "1";
  };
  // The animated wheel lands on the logo's mark, which is the left 101 of the
  // logo's 320.4 viewBox units.
  const markRect = () => {
    const box = logo?.querySelector("svg")?.getBoundingClientRect() ?? new DOMRect();
    return new DOMRect(box.left, box.top, (box.width * 101) / 320.4, box.height);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";
    setTimeout(() => {
      stopAnimation();
      splash.remove();
    }, 300);
  };
  const logoOnly = () => {
    fellBack = true;
    showLogo();
    setTimeout(finish, 1200);
  };

  splash.addEventListener("click", finish);
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    logoOnly();
    return;
  }

  const fallback = setTimeout(logoOnly, LOAD_TIMEOUT);
  import("./splash-scene")
    .then(({ startScene }) => {
      if (finished || fellBack) return;
      clearTimeout(fallback);
      // The animated wheel stands in for the logo's mark, and the wordmark
      // slides in beside it once the wheel has formed.
      const flatMark = logo?.querySelector<SVGElement>(".splash-mark");
      const wordmark = logo?.querySelector<SVGElement>(".splash-word");
      if (flatMark) flatMark.style.visibility = "hidden";
      if (wordmark) {
        wordmark.style.opacity = "0";
        wordmark.style.transform = "translateX(24px)";
        // Let it slide in from past the logo's right edge without being cut off.
        wordmark.ownerSVGElement?.style.setProperty("overflow", "visible");
      }
      showLogo();
      const scene = startScene(canvas, markRect);
      stopAnimation = scene.stop;
      setTimeout(() => {
        if (!wordmark) return;
        wordmark.style.transition = "opacity 700ms ease-out, transform 700ms cubic-bezier(0.22, 1, 0.36, 1)";
        wordmark.style.opacity = "1";
        wordmark.style.transform = "none";
      }, scene.wordmarkAt);
      setTimeout(finish, scene.endAt);
    })
    .catch(() => {
      clearTimeout(fallback);
      if (!fellBack) logoOnly();
    });
}
