import { useEffect, useRef } from "react";

/** Fixed backing dimensions keep ink intact when the viewport changes size. */
export function SignatureCanvas({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || drawing.current) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled && !drawing.current) context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
    return () => { cancelled = true; };
  }, [value]);

  const finish = () => {
    if (!drawing.current || !ref.current) return;
    drawing.current = false;
    onChange(ref.current.toDataURL("image/png"));
  };

  return (
    <canvas
      ref={ref}
      width={1000}
      height={400}
      aria-label="אזור ציור חתימה"
      className="w-full h-[200px] bg-transparent cursor-crosshair touch-none"
      onPointerDown={(event) => {
        event.preventDefault();
        const canvas = event.currentTarget;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.setPointerCapture(event.pointerId);
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * canvas.width / rect.width;
        const y = (event.clientY - rect.top) * canvas.height / rect.height;
        context.lineWidth = 2 * canvas.width / rect.width;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "#000";
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 0.1, y + 0.1);
        context.stroke();
        drawing.current = true;
      }}
      onPointerMove={(event) => {
        if (!drawing.current) return;
        const canvas = event.currentTarget;
        const context = canvas.getContext("2d");
        if (!context) return;
        const rect = canvas.getBoundingClientRect();
        context.lineTo((event.clientX - rect.left) * canvas.width / rect.width,
          (event.clientY - rect.top) * canvas.height / rect.height);
        context.stroke();
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    />
  );
}
