// First-visit splash screen. Plays once per browser session (see the
// "splash-seen" check in Layout.astro); tap to skip. Three.js is loaded only
// when the splash plays. Without WebGL, or with reduced motion, the logo
// simply fades in.

const LOGO_AT = 1700; // ms after the animation starts
const END_AT = 3000;
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
    if (!logo) return;
    logo.style.opacity = "1";
    logo.style.transform = "scale(1)";
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
      stopAnimation = startScene(canvas);
      setTimeout(showLogo, LOGO_AT);
      setTimeout(finish, END_AT);
    })
    .catch(() => {
      clearTimeout(fallback);
      if (!fellBack) logoOnly();
    });
}
