
# 🏭 Brother Plast ERP

> Prototipo de sistema de gestión industrial para **Brother Plast SRL** — producción, depósito y expedición en un solo panel de control.

Proyecto desarrollado por **Codevia — Innovación, integración y desarrollo**, en el marco de la Práctica Profesionalizante de Integración de Sistemas — E.S.B.A. (Escuela Superior de Barrio Norte).

🔗 **Demo en vivo:** [tu-url-de-netlify.netlify.app](https://brotherplast.netlify.app/)

---

## 📋 Sobre el proyecto

Brother Plast SRL es una PyME industrial dedicada a la fabricación, almacenamiento y distribución de bobinas y bolsas de polipropileno/polietileno. Actualmente gestiona sus procesos de forma manual (papel/Excel), generando cuellos de botella de **4 a 5 horas** en la carga de camiones y falta de trazabilidad del stock.

Este prototipo explora cómo una solución digital centralizada podría transformar el circuito operativo: **producción → depósito → expedición → pedidos**, con vistas diferenciadas según el rol de cada usuario.

> ⚠️ **Nota:** este es un prototipo exploratorio de frontend con datos de demostración (mock). Todavía no está conectado a una base de datos ni a un backend real.

---

## ✨ Funcionalidades

- 🔐 **Login por rol** — acceso diferenciado para Jefe de Producción, Encargado de Depósito, Operarios, Clarkistas, Choferes y Administración
- 📊 **Panel general (Overview)** — KPIs operativos, alertas críticas, actividad de playa y últimos movimientos
- 🏗️ **Producción** — turnos de extrusión, trazabilidad de lotes, control de calidad
- 📦 **Depósito** — stock por sector, ubicaciones físicas, alertas de vencimiento de materiales biodegradables
- 🚚 **Expedición** — hojas de ruta, seguimiento de camiones en playa, estado de despachos
- 🧾 **Pedidos** — cartera de clientes, seguimiento de estado, búsqueda
- 📈 **Reportes** — cumplimiento de producción vs. plan semanal
- 🗺️ **Anatomía de interfaz** — documentación visual de los componentes del dashboard (`/anatomy`)

---

## 🛠️ Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Framework | [React 19](https://react.dev/) |
| Build tool | [Vite](https://vitejs.dev/) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com/) |
| Componentes UI | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Íconos | [Lucide React](https://lucide.dev/) |
| Notificaciones | [Sonner](https://sonner.emilkowal.ski/) |
| Tipografía | [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) (Google Fonts vía Fontsource) |
| Hosting | [Netlify](https://www.netlify.com/) (deploy automático desde GitHub) |

---

## 🚀 Cómo correrlo localmente

### Requisitos previos
- [Node.js](https://nodejs.org/) 18 o superior
- npm

### Instalación

```bash
# Cloná el repositorio
git clone https://github.com/AndyLipo/Codevia.git

# Entrá a la carpeta
cd Codevia

# Instalá las dependencias
npm install

# Corré el servidor de desarrollo
npm run dev
```

La app va a estar disponible en `http://localhost:5173`.

### Otros comandos disponibles

```bash
npm run build     # compila el proyecto para producción (carpeta /dist)
npm run preview   # sirve localmente el build de producción
npm run lint      # corre ESLint sobre el proyecto
```

---

## 📁 Estructura del proyecto

```
src/
├── components/
│   ├── common/       # Piezas reutilizables (Badge, Table, Kpi, SectionTitle...)
│   ├── layout/        # Sidebar, Topbar, Footer, AppShell
│   ├── login/         # Componentes de la pantalla de acceso
│   ├── dashboard/      # Módulos del panel (Overview, Production, Warehouse...)
│   └── ui/             # Componentes de shadcn/ui (Radix + Tailwind)
├── data/
│   └── mockData.js     # Datos de demostración (roles, módulos, tablas)
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   └── Anatomy.jsx     # Documentación visual del sistema
├── hooks/               # Hooks personalizados
├── lib/
│   └── utils.js         # Función cn() para clases condicionales
├── App.jsx
├── main.jsx
└── index.css            # Tema, variables y estilos globales
```

---

## 👥 Roles del sistema

| Rol | Enfoque |
|---|---|
| Jefe de Producción | Turnos, lotes y calidad |
| Depósito y Expedición | Stock, cargas y rutas |
| Operario de Extrusión | Registro de turno |
| Clarkista | Ubicaciones y carga |
| Chofer | Hoja de ruta y entregas |
| Administración y Ventas | Pedidos y reportes |

---

## 🗺️ Roadmap

- [ ] Definir permisos reales por rol (hoy todos ven el mismo menú)
- [ ] Módulo de recepción de insumos y proveedores
- [ ] Módulo de arqueo y facturación
- [ ] Diseño del modelo de datos (entidad-relación)
- [ ] Desarrollo del backend y API REST
- [ ] Reemplazar `mockData.js` por datos reales
- [ ] Autenticación real de usuarios

---

## 👨‍💻 Equipo — Codevia

| Nombre | Rol |
|---|---|
| María Fernanda Aranda | Project Manager / Referente |
| Analía Toscano | Integrante |
| Walter Esteban Olivera | Integrante (Programador) |
| Andrés Liporace | Integrante (Programador) |

**Institución:** E.S.B.A. — Escuela Superior de Barrio Norte
**Carrera:** Técnico Superior en Análisis de Sistemas de Computación
**Cátedra:** Práctica Profesionalizante — Integración de Sistemas
**Profesor:** Lic. Leonardo Soto

---

## 📄 Licencia

Este proyecto fue desarrollado con fines académicos en el marco de la Práctica Profesionalizante de E.S.B.A.
