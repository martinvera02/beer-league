# 🍺 Beer League

> La app social de competición de consumiciones. Compite con tus amigos, sube en el ranking, opera en el mercado de bebidas y destruye a la competencia con powerups.

---

## 📱 Demo

Accede a la app en producción: **[beer-league.vercel.app](https://beer-league-six.vercel.app)**

Instalable como PWA directamente desde el navegador en Android y iOS.

---

## ✨ Características principales

### 🏆 Sistema de ligas y ranking
- Crea ligas privadas y comparte el ID con tus amigos para que se unan
- Ranking en tiempo real por liga y ranking global
- Sistema de **temporadas de 10 días** con cuenta atrás dinámica
- Al finalizar cada temporada se guarda el ranking final como historial
- Reset automático mediante **GitHub Actions**

### 🍺 Consumiciones
- Registra cualquier tipo de bebida con un solo toque
- Las consumiciones se anotan automáticamente en todas tus ligas
- Los puntos se calculan en tiempo real incluyendo multiplicadores de mercado y powerups activos
- Cada consumición otorga monedas 🪙 para usar en el mercado

### 📊 Mercado de trading
- Cada tipo de bebida tiene un precio de cotización que sube y baja según las inversiones
- El precio del mercado **afecta directamente a los puntos** que da cada bebida (x0.5 — x2.0)
- Opera en **LONG** (apostar a que sube) o **SHORT** (apostar a que baja)
- Cierra posiciones para materializar tus ganancias o pérdidas
- Gráficas de precios en tiempo real con historial

### ⚡ Tienda de powerups
- **🔥 Racha Doble** — tus próximas 5 consumiciones valen el doble de puntos
- **🧊 Freeze** — congela a un jugador 24h, sus consumiciones no puntúan
- **💣 Sabotaje** — resta 10 puntos al líder de tu liga al instante
- **🛡️ Escudo** — protección contra el próximo powerup negativo
- **⚡ Turbo** — una bebida elegida vale x3 durante 2 horas

### 💬 Chat y Social
- Chat en tiempo real dentro de cada liga con soporte de imágenes
- Feed social estilo Twitter con posts e imágenes
- Historias tipo Instagram que desaparecen en 24 horas
- Likes y comentarios en tiempo real

### 👥 Gestión de grupos
- Sistema de roles: **Creador 👑**, **Admin ⚡** y **Miembro 🍺**
- El creador puede cambiar el nombre de la liga y gestionar roles
- Admins pueden expulsar miembros
- Expulsión con confirmación y modal animado

### 👤 Perfil y ajustes
- Avatar personalizable
- Estadísticas personales de consumiciones y puntos
- Cambio de nombre de usuario y contraseña
- Tema **oscuro**, **claro** y **sistema**
- Eliminación de cuenta

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 |
| Estilos | Tailwind CSS v4 |
| Animaciones | Framer Motion |
| Backend / BD | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Hosting | Vercel |
| CI/CD | GitHub Actions |
| PWA | vite-plugin-pwa |

---

## 🗄️ Estructura de la base de datos

```
profiles          — Perfiles de usuario
leagues           — Ligas / grupos
league_members    — Miembros de cada liga con rol
drinks            — Consumiciones registradas
drink_types       — Tipos de bebida y puntos base
seasons           — Temporadas activas e históricas
season_results    — Ranking final de cada temporada
wallets           — Monedero 🪙 de cada usuario
wallet_transactions — Historial de transacciones
powerup_catalog   — Catálogo de powerups disponibles
active_powerups   — Powerups comprados y en efecto
drink_market      — Precio actual de cada bebida
drink_market_history — Historial de precios para gráficas
market_positions  — Posiciones de trading abiertas/cerradas
posts             — Posts del feed social
post_likes        — Likes en posts
post_comments     — Comentarios en posts
stories           — Historias (expiran en 24h)
messages          — Mensajes del chat de liga
```

---

## 🚀 Instalación y desarrollo local

### Requisitos previos
- Node.js 22+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com) (para producción)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/beer-league.git
cd beer-league
```

### 2. Instalar dependencias

```bash
npm install --legacy-peer-deps
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon
```

### 4. Configurar la base de datos

Ejecuta los scripts SQL en el **SQL Editor de Supabase** en este orden:

1. Tablas principales (profiles, leagues, drinks, etc.)
2. Sistema de temporadas (seasons, season_results)
3. Sistema de mercado (wallets, drink_market, market_positions)
4. Sistema de powerups (powerup_catalog, active_powerups)
5. Sistema social (posts, stories, messages)
6. Funciones y triggers
7. Políticas RLS

> Los scripts completos están disponibles en la carpeta `/sql` del repositorio.

### 5. Arrancar en local

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`

---

## 📦 Despliegue en producción

### Vercel

1. Conecta tu repositorio de GitHub a Vercel
2. Añade las variables de entorno en el dashboard de Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Vercel desplegará automáticamente en cada push a `main`

### GitHub Actions (reset automático de temporadas)

Añade estos secretos en **Settings → Secrets → Actions** de tu repositorio:

| Secreto | Valor |
|---|---|
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase |

Los workflows incluidos son:
- `reset-season.yml` — comprueba y resetea la temporada cada día a las 00:00 UTC
- `delete-stories.yml` — elimina historias expiradas cada hora

---

## 📱 Instalación como PWA

### Android (Chrome)
1. Abre la URL de la app en Chrome
2. Pulsa el banner "Añadir a pantalla de inicio" o ve al menú → "Instalar aplicación"

### iPhone (Safari)
1. Abre la URL en Safari
2. Pulsa el botón de compartir 
3. Selecciona "Añadir a pantalla de inicio"

---

## 📁 Estructura del proyecto

```
beer-league/
├── public/
│   ├── icons/              ← Iconos PWA
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── Footer.jsx
│   │   ├── Navbar.jsx
│   │   ├── SeasonCountdown.jsx
│   │   └── SeasonHistory.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx
│   ├── lib/
│   │   ├── animations.js
│   │   ├── sounds.js
│   │   └── supabase.js
│   ├── pages/
│   │   ├── AddDrink.jsx
│   │   ├── GlobalRanking.jsx
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Market.jsx
│   │   ├── Profile.jsx
│   │   ├── Ranking.jsx
│   │   └── Social.jsx
│   ├── App.jsx
│   └── main.jsx
├── .github/
│   └── workflows/
│       ├── reset-season.yml
│       └── delete-stories.yml
├── .npmrc
├── vite.config.js
└── README.md
```

---

## 🔒 Seguridad

- Todas las tablas tienen **Row Level Security (RLS)** activado
- Los usuarios solo pueden modificar sus propios datos
- Las claves de API nunca se exponen en el cliente (se usan las claves `anon`)
- La `service_role` key solo se usa en GitHub Actions mediante secretos cifrados
- Las contraseñas son gestionadas íntegramente por Supabase Auth

---

## 🗺️ Roadmap

- [ ] Notificaciones push cuando alguien te supera en el ranking
- [ ] Conversión a app nativa con Capacitor (Android / iOS)
- [ ] Sistema de amigos y búsqueda de usuarios
- [ ] Estadísticas avanzadas con gráficas históricas
- [ ] Modo torneo con eliminatorias
- [ ] Tabla de logros y medallas

---

## 📄 Licencia

© 2025 **MVC Productions** · Todos los derechos reservados.

Este proyecto es de uso privado. No está permitida su reproducción, distribución o modificación sin autorización expresa de MVC Productions.

---

<div align="center">
  <p>Hecho con 🍺 y mucho café</p>
  <p><strong>MVC Productions</strong></p>
</div>
