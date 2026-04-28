/**
 * ShootingStar — small star with a comet-like tail trailing behind it.
 * Used to label the "Stars Received" stat across profile views.
 * Tappable: the parent toggles the textual label between this icon and "Received".
 */
interface Props {
  size?: number;
  className?: string;
}

const ShootingStarIcon = ({ size = 16, className = "" }: Props) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    className={className}
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="ss-tail" x1="0" y1="32" x2="20" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.95" />
      </linearGradient>
    </defs>
    {/* Comet tail */}
    <path
      d="M2 30 Q10 24 18 16"
      stroke="url(#ss-tail)"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M5 28 Q11 24 16 19"
      stroke="url(#ss-tail)"
      strokeWidth="1.2"
      strokeLinecap="round"
      fill="none"
      opacity="0.6"
    />
    {/* Star */}
    <path
      d="M22 4 l2.4 5.4 5.6 .6 -4.2 4.0 1.2 5.6 -5 -2.9 -5 2.9 1.2 -5.6 -4.2 -4.0 5.6 -.6 z"
      fill="currentColor"
    />
  </svg>
);

export default ShootingStarIcon;
