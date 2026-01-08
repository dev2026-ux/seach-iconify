# Guía de Despliegue en Easypanel

Esta guía te ayudará a desplegar IconifySearch en Easypanel usando Docker.

## 📋 Requisitos Previos

- Cuenta en Easypanel
- Acceso a tu servidor/VPS
- Repositorio Git (opcional pero recomendado)

## 🚀 Método 1: Despliegue desde Repositorio Git (Recomendado)

### Paso 1: Subir tu código a Git

```bash
# Si aún no tienes un repositorio
git init
git add .
git commit -m "Initial commit"
git remote add origin <tu-repositorio-url>
git push -u origin main
```

### Paso 2: Crear Aplicación en Easypanel

1. Inicia sesión en Easypanel
2. Ve a tu proyecto
3. Click en **"Create Service"**
4. Selecciona **"App"**
5. Elige **"From Source"**

### Paso 3: Configurar el Servicio

**General:**
- **Name**: `iconify-search`
- **Source**: Tu repositorio Git
- **Branch**: `main` (o la rama que uses)

**Build:**
- **Build Method**: `Dockerfile`
- **Dockerfile Path**: `./Dockerfile`

**Deployment:**
- **Port**: `3000`

### Paso 4: Variables de Entorno

Agrega estas variables de entorno en Easypanel:

```env
PORT=3000
NODE_ENV=production
MAX_CONCURRENT=10
```

### Paso 5: Recursos

Configura los recursos recomendados:

- **Memory**: 512MB - 1GB (mínimo 512MB)
- **CPU**: 0.5 - 1 vCPU

### Paso 6: Desplegar

1. Click en **"Deploy"**
2. Espera a que el build termine (puede tomar 3-5 minutos la primera vez)
3. Verifica que el estado sea **"Running"**

## 🚀 Método 2: Despliegue Manual con Docker

Si prefieres usar Docker directamente en tu servidor:

### Paso 1: Conectar a tu servidor

```bash
ssh usuario@tu-servidor
```

### Paso 2: Clonar el repositorio

```bash
git clone <tu-repositorio-url>
cd IconifySearch
```

### Paso 3: Construir y ejecutar

```bash
# Usando docker-compose (recomendado)
docker-compose up -d

# O usando Docker directamente
docker build -t iconify-search .
docker run -d \
  --name iconify-search \
  -p 3000:3000 \
  -e PORT=3000 \
  -e MAX_CONCURRENT=10 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  iconify-search
```

## ✅ Verificación del Despliegue

Una vez desplegado, verifica que todo funcione:

### 1. Health Check

```bash
curl https://tu-dominio.com/health
```

Deberías recibir:
```json
{
  "status": "ok",
  "browser": "running",
  "page": "active",
  "stats": {...}
}
```

### 2. Búsqueda de Iconos

```bash
curl "https://tu-dominio.com/api/search?query=star&limit=10"
```

### 3. Estadísticas

```bash
curl https://tu-dominio.com/api/stats
```

## 🔧 Configuración Avanzada

### Aumentar Concurrencia

Para más usuarios simultáneos, aumenta `MAX_CONCURRENT`:

```env
MAX_CONCURRENT=20  # Para 100-200 usuarios
```

**Nota**: Aumenta también la memoria asignada proporcionalmente.

### Dominio Personalizado

En Easypanel:
1. Ve a **"Domains"**
2. Agrega tu dominio
3. Configura el DNS según las instrucciones

### SSL/HTTPS

Easypanel configura SSL automáticamente con Let's Encrypt.

## 📊 Monitoreo

### Logs en Easypanel

1. Ve a tu servicio
2. Click en **"Logs"**
3. Verás los logs en tiempo real

### Logs con Docker

```bash
# Ver logs
docker logs iconify-search

# Seguir logs en tiempo real
docker logs -f iconify-search
```

### Métricas

Accede a las estadísticas del servidor:
```
https://tu-dominio.com/api/stats
```

## 🐛 Troubleshooting

### El contenedor no inicia

**Verifica los logs:**
```bash
docker logs iconify-search
```

**Problemas comunes:**
- Falta de memoria (aumenta a 1GB)
- Puerto 3000 ya en uso
- Dependencias de Puppeteer faltantes (el Dockerfile las incluye)

### Error "Target closed" o página no responde

El servidor tiene auto-reconexión. Espera 2-3 minutos y reintenta.

### Out of Memory

1. Aumenta la memoria asignada en Easypanel
2. Reduce `MAX_CONCURRENT` a 5 o menos
3. Limpia el caché: `curl -X DELETE https://tu-dominio.com/api/cache`

### Requests muy lentos

- El primer request después de inactividad puede tardar ~1s (warmup)
- Verifica el health check: `/health`
- Revisa las estadísticas: `/api/stats`

## 🔐 Seguridad

### Recomendaciones

1. **No expongas endpoints sensibles** si no los necesitas
2. **Usa HTTPS** (Easypanel lo configura automáticamente)
3. **Limita el rate limiting** si esperas mucho tráfico (considera usar un reverse proxy)

### Variables de Entorno Sensibles

Si necesitas agregar variables sensibles:
1. Usa el panel de Easypanel (no las subas a Git)
2. Nunca subas el archivo `.env` a Git

## 📈 Escalabilidad

### Recursos Recomendados por Carga

| Usuarios Simultáneos | RAM | CPU | MAX_CONCURRENT |
|---------------------|-----|-----|----------------|
| 50-100 | 512MB | 0.5 | 10 |
| 100-200 | 1GB | 1 | 20 |
| 300-500 | 2GB | 2 | 50 |

### Múltiples Instancias

Para alta disponibilidad, considera:
1. Desplegar múltiples instancias
2. Usar un load balancer
3. Implementar caché compartido (Redis)

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs
2. Verifica el health check
3. Consulta las estadísticas del servidor
4. Revisa la documentación de Easypanel

## 🎯 Endpoints Disponibles

Una vez desplegado, tendrás acceso a:

- `GET /health` - Health check
- `GET /api/search?query=...&limit=...` - Búsqueda de iconos
- `GET /api/stats` - Estadísticas del servidor
- `GET /api/cache-stats` - Información del caché
- `DELETE /api/cache` - Limpiar caché
- `DELETE /api/stats` - Resetear estadísticas

---

**¡Listo!** Tu API de búsqueda de iconos Iconify está desplegada y lista para usar. 🎉
