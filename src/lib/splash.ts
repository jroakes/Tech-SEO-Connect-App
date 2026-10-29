// First-visit splash screen. Plays once per browser session (see the
// "splash-seen" check in Layout.astro); tap to skip. Three.js is loaded only
// when the splash plays. Without WebGL, or with reduced motion, the logo
// simply fades in.

const LOGO_AT = 1800; // ms after the animation starts, as the wheel comes together
const END_AT = 3600;
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
      // The 3D wheel stands in for the logo's flat mark.
      const flatMark = logo?.querySelector<SVGElement>(".splash-mark");
      if (flatMark) flatMark.style.visibility = "hidden";
      stopAnimation = startScene(canvas, markRect);
      setTimeout(showLogo, LOGO_AT);
      setTimeout(finish, END_AT);
    })
    .catch(() => {
      clearTimeout(fallback);
      if (!fellBack) logoOnly();
    });
}
