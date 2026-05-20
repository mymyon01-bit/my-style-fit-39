/**
 * SocialLinks — right-aligned social cluster for mymyon.
 * Used on mobile floating above BottomNav and in Footer on desktop.
 */
import { Instagram, Facebook, Twitter } from "lucide-react";

const LINKS = [
  {
    label: "Instagram",
    href: "https://instagram.com/mymyon.official",
    Icon: Instagram,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@mymyon.official",
    // TikTok glyph via inline SVG (lucide has no tiktok)
    Icon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M16.5 3a5.5 5.5 0 0 0 5.5 5.5v3a8.5 8.5 0 0 1-5.5-2v7.25a6.25 6.25 0 1 1-6.25-6.25c.34 0 .67.03 1 .08v3.12a3.25 3.25 0 1 0 2.25 3.05V3h3z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com/mymyon.official",
    Icon: Facebook,
  },
  {
    label: "Twitter",
    href: "https://twitter.com/mymyon_official",
    Icon: Twitter,
  },
];

interface Props {
  className?: string;
  iconClassName?: string;
}

const SocialLinks = ({ className = "", iconClassName = "h-4 w-4" }: Props) => {
  return (
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
};

export default SocialLinks;
