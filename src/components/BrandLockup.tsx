export default function BrandLockup({ className = '' }: { className?: string }) {
  return <span className={`brand-lockup ${className}`.trim()}>
    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" aria-hidden="true" />
    <span>workflow</span>
  </span>;
}
