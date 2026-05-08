import Link from "next/link";

export function ProductHuntBadge() {
  if (process.env.NEXT_PUBLIC_SHOW_PRODUCT_HUNT_BADGE !== "1") return null;

  return (
    <Link
      href="/product-hunt"
      className="inline-flex items-center gap-2 rounded-full border border-orange-300/35 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-100"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white">PH</span>
      Featured on Product Hunt
    </Link>
  );
}
