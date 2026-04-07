# SolarIA — Viabilidad Inmobiliaria con IA

Herramienta de análisis de solares con conexión a la API del Catastro y Claude AI.

## Despliegue en Vercel (paso a paso)

### 1. Sube el proyecto a GitHub

1. Ve a **github.com** y haz clic en el botón verde **"New"** (repositorio nuevo)
2. Ponle nombre: `solaria`
3. Déjalo en **Public** o **Private** (como prefieras)
4. NO marques ninguna casilla adicional
5. Haz clic en **"Create repository"**
6. GitHub te mostrará instrucciones. Haz clic en **"uploading an existing file"**
7. Arrastra todos los archivos de esta carpeta al navegador
8. Escribe un mensaje: `Primera versión de SolarIA`
9. Haz clic en **"Commit changes"**

### 2. Despliega en Vercel

1. Ve a **vercel.com** y entra con tu cuenta
2. Haz clic en **"Add New Project"**
3. Busca y selecciona el repositorio `solaria`
4. Haz clic en **"Import"**
5. Vercel detectará automáticamente que es un proyecto Next.js
6. **MUY IMPORTANTE — Antes de hacer clic en Deploy:**
   - Busca la sección **"Environment Variables"**
   - Haz clic en **"Add"**
   - Name: `ANTHROPIC_API_KEY`
   - Value: (pega aquí tu clave que empieza por `sk-ant-...`)
   - Haz clic en **"Add"**
7. Ahora haz clic en **"Deploy"**
8. Espera 2-3 minutos mientras Vercel construye la app
9. ¡Listo! Vercel te dará una URL pública como `solaria-xxx.vercel.app`

### 3. Usar la app

Abre la URL en cualquier navegador, PC, tablet o móvil.

Para encontrar la referencia catastral de un solar:
1. Ve a **sedecatastro.gob.es**
2. Haz clic en "Consulta de datos catastrales"
3. Busca por dirección
4. Copia la referencia catastral (20 caracteres)
5. Pégala en SolarIA

## Coste estimado de uso

- Cada análisis completo de solar: ~0,02€
- Con un uso de 50 análisis al mes: ~1€/mes
- Puedes poner un límite en console.anthropic.com → Settings → Limits

## Estructura del proyecto

```
solaria/
├── pages/
│   ├── index.js          # Interfaz principal
│   ├── _app.js           # App wrapper
│   └── api/
│       ├── catastro.js   # Proxy API Catastro (sin CORS)
│       └── claude.js     # Llamadas a Claude AI
├── lib/
│   └── model.js          # Modelo financiero
├── package.json
└── next.config.js
```
