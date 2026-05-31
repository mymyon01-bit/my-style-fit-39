import { type ReactNode } from "react";

/**
 * PageContainer — editorial max-width wrapper used by every new page.
 * Provides consistent horizontal padding and vertical rhythm so all
 * sections (Products / Fit / Feed / My) feel like one product.
 */
export default function PageContainer({
  children,
  className = "",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide" | "narrow";
}) {
  const maxW =
    size === "wide" ? "max-w-6xl" : size === "narrow" ? "max-w-2xl" : "max-w-4xl";
  return (
    <div className={`mx-auto w-full ${maxW} px-5 md:px-8 lg:px-10 ${className}`}>
      {children}
    </div>
  );
}
