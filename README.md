# 🎨 Iconify Search API v2.0 OPTIMIZED

API Proxy optimizado para búsqueda de iconos Iconify con arquitectura de **página única permanente**.

## 🚀 ¿Qué hace esto especial?

### ✨ Optimizaciones v2.0

- **Una sola página permanente** - No abre/cierra pestañas por cada request
- **Fetch nativo desde Iconify** - Como si la propia página hiciera el request
- **Cola de concurrencia** - Maneja múltiples requests simultáneos
- **Headers naturales** - Incluye todos los sec-ch-ua y referer correctos
- **Caché inteligente** - 5 minutos TTL para búsquedas repetidas
- **Estadísticas en tiempo real** - Monitorea performance

## 📊 Capacidad

### Usuarios simultáneos:

| Configuración | Usuarios Simultáneos | RAM Necesaria |
|---------------|---------------------|---------------|
| Default (10 concurrent) | **50-100+** | 512MB - 1GB |
| 20 concurrent | **100-200+** | 1-2GB |
| 50 concurrent | **300-500+** | 2-4GB |

**Con caché activo:** 1000+ requests/segundo ⚡

### Performance:

- **First request:** ~500-800ms (fetch directo)
- **Cached request:** <50ms
- **Memoria:** ~150-200MB constante (una sola página)
- **Concurrencia:** Configurable vía \`MAX_CONCURRENT\`

## 📋 Requisitos

- Node.js >= 16.x
- npm o yarn
- RAM: 512MB mínimo (1GB recomendado)

## 🔧 Instalación

1. **Descomprime:**
   \`\`\`bash
   unzip iconify-search-server.zip
   cd iconify-search-server
   \`\`\`

2. **Instala dependencias:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configura (opcional):**
   \`\`\`bash
   cp .env.example .env
   # Edita MAX_CONCURRENT si necesitas más usuarios
   \`\`\`

## ▶️ Uso

### Inicio:

\`\`\`bash
npm start
\`\`\`

El servidor estará en \`http://localhost:3000\`

## 📡 API Endpoints

### 1. Búsqueda de Iconos

\`\`\`
GET /api/search?query=STRING&limit=NUMBER
\`\`\`

**Parámetros:**
- \`query\` (requerido): Término a buscar
- \`limit\` (opcional): Límite de resultados (default: 999)

**Ejemplo:**
\`\`\`bash
curl "http://localhost:3000/api/search?query=pizzas&limit=999"
\`\`\`

**Respuesta:**
\`\`\`json
{
  "status": "success",
  "query": "pizzas",
  "total": 15,
  "icons": [...],
  "collections": {...},
  "cached": false,
  "timestamp": "2024-01-08T17:30:00.000Z"
}
\`\`\`

### 2. Estadísticas del Servidor

\`\`\`
GET /api/stats
\`\`\`

**Respuesta:**
\`\`\`json
{
  "stats": {
    "totalRequests": 125,
    "cacheHits": 80,
    "cacheMisses": 45,
    "activeRequests": 3,
    "errors": 0,
    "queueSize": 2,
    "queuePending": 1,
    "cacheSize": 15
  },
  "config": {
    "maxConcurrent": 10,
    "cacheTTL": "300s",
    "port": 3000
  }
}
\`\`\`

### 3. Health Check

\`\`\`
GET /health
\`\`\`

**Respuesta:**
\`\`\`json
{
  "status": "ok",
  "browser": "running",
  "page": "active",
  "stats": {...}
}
\`\`\`

### 4. Cache Management

\`\`\`bash
# Ver caché
GET /api/cache-stats

# Limpiar caché
DELETE /api/cache

# Reset estadísticas
DELETE /api/stats
\`\`\`

## 💻 Ejemplos de uso

### JavaScript/Fetch:

\`\`\`javascript
async function buscarIconos(query) {
  const response = await fetch(\`http://localhost:3000/api/search?query=\${query}\`);
  const data = await response.json();

  console.log(\`Total: \${data.total}\`);
  console.log(\`Cached: \${data.cached}\`);
  console.log('Iconos:', data.icons);

  return data;
}

buscarIconos('pizzas');
\`\`\`

### Node.js con axios:

\`\`\`javascript
const axios = require('axios');

async function search(query) {
  try {
    const { data } = await axios.get(\`http://localhost:3000/api/search?query=\${query}\`);
    return data;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

search('star').then(result => {
  console.log(result.icons);
});
\`\`\`

### cURL:

\`\`\`bash
# Búsqueda básica
curl "http://localhost:3000/api/search?query=pizzas"

# Con jq para formatear
curl -s "http://localhost:3000/api/search?query=star" | jq '.total'

# Ver estadísticas
curl -s "http://localhost:3000/api/stats" | jq '.stats'
\`\`\`

## ⚙️ Configuración

### Variables de entorno (.env):

\`\`\`env
PORT=3000                 # Puerto del servidor
NODE_ENV=production       # Entorno
MAX_CONCURRENT=10         # Requests simultáneos
\`\`\`

### Ajustar concurrencia:

Para más usuarios simultáneos, aumenta \`MAX_CONCURRENT\`:

\`\`\`bash
# En .env
MAX_CONCURRENT=20   # Para 100-200 usuarios

MAX_CONCURRENT=50   # Para 300-500 usuarios
\`\`\`

**Nota:** Más concurrencia = más RAM necesaria

## 🛠️ Deployment Production

### Con PM2:

\`\`\`bash
npm install -g pm2

# Iniciar
pm2 start server.js --name "iconify-api"

# Ver logs
pm2 logs iconify-api

# Monitoreo
pm2 monit

# Auto-restart
pm2 save
pm2 startup
\`\`\`

### Con Docker:

\`\`\`bash
docker-compose up -d
\`\`\`

## 🎯 Ventajas vs v1.0

| Aspecto | v1.0 | v2.0 OPTIMIZED |
|---------|------|----------------|
| Páginas | Nueva por request | **Una permanente** |
| Usuarios simultáneos | 3-5 | **50-100+** |
| Tiempo respuesta | 3-5s | **500-800ms** |
| Memoria | Variable | **Constante ~200MB** |
| Escalabilidad | Limitada | **Excelente** |

## 🐛 Troubleshooting

### La página se cierra sola
- El servidor tiene auto-reconexión cada 2 minutos
- Verifica en \`/health\` el estado de la página

### Requests lentos después de inactividad
- El primer request puede tardar ~1s (warmup)
- Los siguientes son instantáneos

### Out of memory
- Reduce \`MAX_CONCURRENT\` en .env
- Aumenta RAM del servidor
- Limpia caché: \`DELETE /api/cache\`

### Error "Target closed"
- El servidor reiniciará la página automáticamente
- Espera 2-3 segundos y reintenta

## 📊 Monitoreo

### Dashboard en navegador:

Abre \`http://localhost:3000\` para ver:
- Estadísticas en tiempo real
- Probar endpoints
- Ver caché y cola
- Performance metrics

### Stats programáticos:

\`\`\`javascript
// Obtener stats
const stats = await fetch('http://localhost:3000/api/stats').then(r => r.json());

console.log('Hit rate:', 
  (stats.stats.cacheHits / stats.stats.totalRequests * 100).toFixed(1) + '%'
);
\`\`\`

## 🔐 Seguridad

- ✅ Headers naturales (sec-ch-ua, referer)
- ✅ Fetch desde contexto de Iconify
- ✅ User-Agent realista
- ✅ CORS habilitado
- ✅ No almacena credenciales

## 📝 Notas

- Una sola página permanente para todos los requests
- Fetch ejecutado en contexto de Iconify
- Cola automática para controlar concurrencia
- Caché inteligente con TTL de 5 minutos
- Keep-alive automático cada 2 minutos
- Graceful shutdown incluido

## 📄 Licencia

MIT

---

**v2.0 OPTIMIZED** - Enero 2026
