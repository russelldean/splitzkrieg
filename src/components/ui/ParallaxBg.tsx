'use client';

import { useRef, useEffect, useState } from 'react';

const IMG_W = 640;
const IMG_H = 478;
const OBJ_POS_Y = 0.65; // matches object-[center_65%]

export function ParallaxBg({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    backgroundImage: `url(${src})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 65%',
    backgroundRepeat: 'no-repeat',
  });

  useEffect(() => {
    function compute() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const elW = rect.width;
      const elH = rect.height;

      // Replicate object-cover: scale image to cover the element
      const scale = Math.max(elW / IMG_W, elH / IMG_H);
      const imgW = IMG_W * scale;
      const imgH = IMG_H * scale;

      // Replicate object-position center 65%: how far down the image is clipped
      const excessY = imgH - elH;
      const offsetY = excessY * OBJ_POS_Y;

      // For bg-fixed, position the image in the viewport so the R row
      // lines up with the bar's initial position
      const barPageTop = rect.top + window.scrollY;
      const bgPosY = barPageTop - offsetY;

      setStyle({
        backgroundImage: `url(${src})`,
        backgroundSize: `${imgW}px ${imgH}px`,
        backgroundPosition: `center ${bgPosY}px`,
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      });
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [src]);

  return <div ref={ref} className="absolute inset-0" style={style} />;
}
