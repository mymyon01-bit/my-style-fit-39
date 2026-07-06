/**
 * MyMyonWordmark — canonical text wordmark "my°myon" used across every
 * top-left brand slot in the app (web + mobile). Renders as
 *   my  •  myon
 * where the • is a tiny accent-colored dot sitting between the two
 * syllables like a degree mark, matching the profile-page reference.
 *
 * Sizes are chosen so the mark reads with the same optical weight across
 * mobile top bars (sm), desktop nav (md), and auth/about heroes (lg/xl).
 */
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

interface Props {
  size?: Size;
  className?: string;
  asHeading?: boolean;
  /** Accent dot color intensity. Defaults to 70% opacity of --accent. */
  dotClassName?: string;
}

const SIZE_MAP: Record<Size, { text: string; dot: string }> = {
  xs: { text: "text-[13px]", dot: "h-[2px] w-[2px]" },
  sm: { text: "text-[15px]", dot: "h-[2.5px] w-[2.5px]" },
  md: { text: "text-[20px]", dot: "h-[3px] w-[3px]" },
  lg: { text: "text-[32px]", dot: "h-[4px] w-[4px]" },
  xl: { text: "text-5xl",   dot: "h-[5px] w-[5px]" },
};

export default function MyMyonWordmark({
  size = "sm",
  className,
  asHeading = false,
  dotClassName,
}: Props) {
  const { text, dot } = SIZE_MAP[size];
  const Tag = asHeading ? "h1" : "span";
  return (
    <Tag
      aria-label="my'myon"
      className={cn(
        "inline-flex items-baseline font-display font-light leading-none text-foreground",
        text,
        className,
      )}
    >
      <span className="tracking-[0.05em]">my</span>
      <span
        aria-hidden
        className={cn(
          "mx-[0.18em] inline-block translate-y-[-0.55em] rounded-full bg-accent/70",
          dot,
          dotClassName,
        )}
      />
      <span className="tracking-[0.05em]">myon</span>
    </Tag>
  );
}
