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
  xs: { text: "text-[14px]", dot: "h-[3px] w-[3px]" },
  sm: { text: "text-[18px]", dot: "h-[3.5px] w-[3.5px]" },
  md: { text: "text-[22px]", dot: "h-[4px] w-[4px]" },
  lg: { text: "text-[34px]", dot: "h-[5px] w-[5px]" },
  xl: { text: "text-[52px]", dot: "h-[7px] w-[7px]" },
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
        "inline-flex items-baseline font-display font-normal italic leading-none text-foreground",
        text,
        className,
      )}
    >
      <span className="tracking-[0.01em]">my</span>
      <span
        aria-hidden
        className={cn(
          "mx-[0.14em] inline-block translate-y-[-0.55em] rounded-full bg-accent",
          dot,
          dotClassName,
        )}
      />
      <span className="tracking-[0.01em]">myon</span>
    </Tag>
  );
}
