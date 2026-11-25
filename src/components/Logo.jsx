export default function Logo({ size = 28, withText = false }) {
  return (
    <div className="flex items-center gap-2.5 select-none" data-testid="forge-logo">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="hsl(220 14% 8%)" stroke="hsl(220 10% 22%)" />
        <path d="M10 22V10h12" stroke="hsl(190 90% 45%)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 16h8" stroke="hsl(175 80% 42%)" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="22.5" cy="21.5" r="2.2" fill="hsl(190 90% 45%)" />
      </svg>
      {withText && <span className="font-semibold tracking-tight text-[17px]">Furge</span>}
    </div>
  );
}
