import { useEffect, useRef } from 'react';
import { makeStyles } from '@fluentui/react-components';

// Subtle animated gradient mesh, GPU-accelerated, pauses on prefers-reduced-motion.
// Uses two radial gradients at slowly drifting positions for an organic feel.
const useStyles = makeStyles({
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 0,
  },
});

export function HeroBackground() {
  const s = useStyles();
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
      ctx!.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw(t: number) {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      ctx!.clearRect(0, 0, w, h);

      const phase = reduced ? 0 : t / 6000;
      const cx1 = w * (0.3 + 0.15 * Math.sin(phase));
      const cy1 = h * (0.4 + 0.1 * Math.cos(phase * 1.2));
      const cx2 = w * (0.75 + 0.1 * Math.cos(phase * 0.8));
      const cy2 = h * (0.6 + 0.12 * Math.sin(phase * 1.5));

      const g1 = ctx!.createRadialGradient(cx1, cy1, 0, cx1, cy1, Math.max(w, h) * 0.7);
      g1.addColorStop(0, 'rgba(116, 39, 116, 0.55)');
      g1.addColorStop(1, 'rgba(116, 39, 116, 0)');
      ctx!.fillStyle = g1;
      ctx!.fillRect(0, 0, w, h);

      const g2 = ctx!.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(w, h) * 0.6);
      g2.addColorStop(0, 'rgba(155, 89, 182, 0.4)');
      g2.addColorStop(1, 'rgba(155, 89, 182, 0)');
      ctx!.fillStyle = g2;
      ctx!.fillRect(0, 0, w, h);

      if (!reduced) {
        frame = ++frame;
        raf = requestAnimationFrame(draw);
      }
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className={s.canvas} aria-hidden="true" />;
}
