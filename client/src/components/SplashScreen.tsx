import { useEffect, useState } from "react";
import logoPath from "@assets/tc-2_1763763013990.jpg";

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

export function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Animation sequence: 
    // - Zoom in: 600ms
    // - Bounce: 400ms
    // - Pause: 1000ms
    // - Fade out: 300ms
    // Total: 2300ms
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onAnimationComplete, 300);
    }, 2300);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-[#51AE7F] z-[9999] transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
    >
      <div className="animate-splash-sequence">
        <img
          src={logoPath}
          alt="Tech SEO Connect"
          className="w-32 h-32 md:w-48 md:h-48 object-contain"
        />
      </div>
    </div>
  );
}
