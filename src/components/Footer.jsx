export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <div
      className="text-center py-3 text-xs"
      style={{ color: 'var(--text-hint)' }}
    >
      © {year} MVC Productions · Todos los derechos reservados
    </div>
  )
}