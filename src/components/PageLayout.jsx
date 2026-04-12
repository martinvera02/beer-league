export default function PageLayout({ children, className = '' }) {
  return (
    <div
      className={`min-h-screen pb-24 px-4 pt-6 transition-colors duration-300 ${className}`}
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {children}
    </div>
  )
}