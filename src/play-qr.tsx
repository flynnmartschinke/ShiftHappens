import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** The public GitHub Pages address of the game. */
export const playUrl = "https://vetematts.github.io/ShiftHappens/";

/** A QR code for any address, drawn as one SVG path. */
export function QrCode({ text, className, label }: { text: string; className?: string; label?: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(text);
    code.make();
    const count = code.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!code.isDark(row, col)) continue;
        let end = col;
        while (end + 1 < count && code.isDark(row, end + 1)) end++;
        d += `M${col} ${row}h${end - col + 1}v1h-${end - col + 1}z`;
        col = end;
      }
    }
    return { size: count, path: d };
  }, [text]);
  return (
    <svg className={className} viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img"
      aria-label={label ?? `QR code for ${text}`} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#fff" rx={1.5} />
      <path d={path} fill="#2a2433" />
    </svg>
  );
}

export function PlayQr({ className }: { className?: string }) {
  return <QrCode text={playUrl} className={className} />;
}
