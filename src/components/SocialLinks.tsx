/**
 * SocialLinks — right-aligned social cluster for mymyon.
 * Inline SVGs (lucide-react doesn't ship social glyphs in this version).
 */
type IconProps = React.SVGProps<SVGSVGElement>;

const InstagramIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const TikTokIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M16.5 3a5.5 5.5 0 0 0 5.5 5.5v3a8.5 8.5 0 0 1-5.5-2v7.25a6.25 6.25 0 1 1-6.25-6.25c.34 0 .67.03 1 .08v3.12a3.25 3.25 0 1 0 2.25 3.05V3h3z" />
  </svg>
);

const FacebookIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2C16.4 4.1 15.4 4 14.3 4 12 4 10.5 5.4 10.5 8v2.8H8V14h2.5v8h3z" />
  </svg>
);

const TwitterIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M18.244 3H21l-6.52 7.45L22 21h-5.97l-4.68-6.12L5.96 21H3.2l6.97-7.96L2.5 3h6.12l4.23 5.6L18.244 3zm-2.09 16.2h1.64L7.92 4.7H6.16l9.994 14.5z" />
  </svg>
);

const LINKS = [
  { label: "Instagram", href: "https://instagram.com/mymyon.official", Icon: InstagramIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@mymyon.official", Icon: TikTokIcon },
  { label: "Facebook", href: "https://facebook.com/mymyon.official", Icon: FacebookIcon },
  { label: "Twitter", href: "https://twitter.com/mymyon_official", Icon: TwitterIcon },
];

interface Props {
  className?: string;
  iconClassName?: string;
}

const SocialLinks = ({ className = "", iconClassName = "h-4 w-4" }: Props) => (
  <div className={`flex items-center justify-end gap-3 ${className}`}>
    {LINKS.map(({ label, href, Icon }) => (
      <a
        key={label}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="text-foreground/55 transition-colors hover:text-primary"
      >
        <Icon className={iconClassName} />
      </a>
    ))}
  </div>
);

export default SocialLinks;
