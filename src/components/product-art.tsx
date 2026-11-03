import type { ProductArt as Art } from "@/lib/types";
import { cx } from "./ui";

// Stylised product renders driven by structured data (shape + colours).
// They stand in for studio photography until real assets are supplied;
// swap this component for <Image> once photos exist.

const W = "#ffffff";

function Shape({ art }: { art: Art }) {
  const { body, accent } = art;
  switch (art.shape) {
    case "perfume":
      return (
        <g>
          <rect x="168" y="96" width="64" height="44" rx="6" fill={accent} />
          <rect x="182" y="136" width="36" height="20" fill={accent} opacity=".75" />
          <rect x="128" y="152" width="144" height="170" rx="22" fill={body} />
          <rect x="140" y="164" width="18" height="146" rx="9" fill={W} opacity=".16" />
          <rect x="160" y="214" width="80" height="44" rx="4" fill={W} opacity=".9" />
          <rect x="174" y="230" width="52" height="4" rx="2" fill={body} opacity=".7" />
          <rect x="184" y="240" width="32" height="3" rx="1.5" fill={body} opacity=".35" />
        </g>
      );
    case "tube":
      return (
        <g>
          <path d="M150 92h100l-8 196H158z" fill={body} />
          <rect x="150" y="84" width="100" height="14" rx="3" fill={body} stroke={accent} strokeOpacity=".2" />
          <rect x="164" y="104" width="12" height="176" rx="6" fill={W} opacity=".35" />
          <rect x="168" y="168" width="64" height="62" rx="6" fill={accent} opacity=".92" />
          <rect x="180" y="186" width="40" height="4" rx="2" fill={W} opacity=".85" />
          <rect x="186" y="198" width="28" height="3" rx="1.5" fill={W} opacity=".55" />
          <rect x="164" y="286" width="72" height="40" rx="10" fill={accent} />
        </g>
      );
    case "balm":
      return (
        <g>
          <rect x="172" y="110" width="56" height="96" rx="10" fill={accent} />
          <rect x="182" y="120" width="8" height="76" rx="4" fill={W} opacity=".4" />
          <rect x="166" y="200" width="68" height="124" rx="12" fill={body} />
          <rect x="178" y="214" width="10" height="96" rx="5" fill={W} opacity=".22" />
          <rect x="186" y="246" width="28" height="36" rx="3" fill={W} opacity=".85" />
        </g>
      );
    case "candle":
      return (
        <g>
          <rect x="120" y="150" width="160" height="172" rx="18" fill={body} />
          <ellipse cx="200" cy="154" rx="80" ry="16" fill={accent} />
          <ellipse cx="200" cy="154" rx="64" ry="10" fill={accent} stroke={body} strokeOpacity=".15" />
          <path d="M200 152v-22" stroke={body} strokeWidth="4" strokeLinecap="round" />
          <rect x="132" y="168" width="14" height="140" rx="7" fill={W} opacity=".12" />
          <rect x="150" y="222" width="100" height="50" rx="4" fill={accent} opacity=".95" />
          <rect x="172" y="240" width="56" height="4" rx="2" fill={body} opacity=".7" />
          <rect x="182" y="250" width="36" height="3" rx="1.5" fill={body} opacity=".35" />
        </g>
      );
    case "diffuser":
      return (
        <g>
          {[-26, -14, -4, 6, 16, 28].map((a, i) => (
            <line key={i} x1="200" y1="180" x2={200 + a * 2.2} y2={64 + (i % 2) * 14} stroke={accent} strokeWidth="4" strokeLinecap="round" />
          ))}
          <rect x="184" y="164" width="32" height="26" rx="4" fill={body} opacity=".85" />
          <path d="M146 214c0-16 20-24 54-24s54 8 54 24v94c0 9-7 16-16 16h-76c-9 0-16-7-16-16z" fill={body} />
          <rect x="158" y="214" width="14" height="96" rx="7" fill={W} opacity=".18" />
          <rect x="166" y="240" width="68" height="40" rx="4" fill={W} opacity=".88" />
          <rect x="180" y="256" width="40" height="4" rx="2" fill={body} opacity=".7" />
        </g>
      );
    case "spray":
      return (
        <g>
          <path d="M178 82h44v20h22l10 14h-46v14h-30z" fill={accent} stroke={body} strokeOpacity=".25" strokeWidth="2" />
          <rect x="176" y="126" width="48" height="30" rx="4" fill={body} opacity=".85" />
          <rect x="146" y="150" width="108" height="174" rx="20" fill={body} />
          <rect x="158" y="162" width="14" height="150" rx="7" fill={W} opacity=".18" />
          <rect x="166" y="212" width="68" height="62" rx="5" fill={accent} opacity=".95" />
          <rect x="178" y="232" width="44" height="4" rx="2" fill={body} opacity=".7" />
          <rect x="186" y="244" width="28" height="3" rx="1.5" fill={body} opacity=".35" />
        </g>
      );
    case "car":
      return (
        <g>
          <rect x="214" y="92" width="40" height="30" rx="5" fill={accent} />
          <path d="M140 150c0-20 14-30 34-30h86v202H140z" fill={body} />
          <path d="M152 150h40c8 0 12 6 12 12v18h-52z" fill={W} opacity=".14" />
          <rect x="152" y="196" width="12" height="114" rx="6" fill={W} opacity=".14" />
          <rect x="168" y="214" width="78" height="62" rx="5" fill={accent} />
          <rect x="180" y="232" width="54" height="5" rx="2.5" fill={W} opacity=".9" />
          <rect x="180" y="244" width="34" height="3" rx="1.5" fill={W} opacity=".6" />
        </g>
      );
    case "box":
    default:
      return (
        <g>
          <rect x="104" y="176" width="192" height="146" rx="8" fill={body} />
          <rect x="96" y="150" width="208" height="40" rx="6" fill={body} />
          <rect x="96" y="150" width="208" height="40" rx="6" fill="#000" opacity=".06" />
          <rect x="188" y="150" width="24" height="172" fill={accent} />
          <path d="M200 150c-24-34-62-36-62-14 0 14 30 14 62 14zm0 0c24-34 62-36 62-14 0 14-30 14-62 14z" fill="none" stroke={accent} strokeWidth="10" strokeLinejoin="round" />
          <rect x="116" y="196" width="12" height="114" rx="6" fill={W} opacity=".14" />
        </g>
      );
  }
}

export function ProductArt({ art, className, label }: { art: Art; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("block h-full w-full", className)}
      style={{ background: art.bg }}
    >
      <ellipse cx="200" cy="330" rx="104" ry="12" fill="#000" opacity=".08" />
      <Shape art={art} />
    </svg>
  );
}
