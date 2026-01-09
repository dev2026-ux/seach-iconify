const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const { default: PQueue } = require('p-queue');
require('dotenv').config();

const app = express();
const PORT = process?.env?.PORT || 3000;
const MAX_CONCURRENT = process?.env?.MAX_CONCURRENT || 10;
const MAX_CACHE_SIZE = process?.env?.MAX_CACHE_SIZE || 1000;
const MAX_MEMORY_MB = process?.env?.MAX_MEMORY_MB || 450; // Límite antes de reiniciar

// Middleware
app.use(cors());
app.use(express.json());

// Estado global
let browser = null;
let iconifyPage = null;
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutos

// Cola de tareas para controlar concurrencia
// Convertir MAX_CONCURRENT a número
const queue = new PQueue({ concurrency: Number(MAX_CONCURRENT) });

// Estadísticas
let stats = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  activeRequests: 0,
  errors: 0,
  cacheEvictions: 0, // Entradas eliminadas por límite
  cacheCleanups: 0   // Limpiezas automáticas ejecutadas
};

// Inicializar navegador y página permanente
async function initBrowserAndPage() {
  if (browser && iconifyPage) {
    try {
      // Verificar que la página sigue activa
      await iconifyPage.evaluate(() => true);
      return { browser, page: iconifyPage };
    } catch (e) {
      console.log('⚠️  Página cerrada, reiniciando...');
      iconifyPage = null;
    }
  }

  if (!browser) {
    console.log('🚀 Iniciando Puppeteer...');
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ]
    });
    console.log('✅ Navegador iniciado');
  }

  if (!iconifyPage) {
    console.log('📄 Creando página permanente de Iconify...');
    iconifyPage = await browser.newPage();

    // Bloquear TODOS los recursos innecesarios (máxima optimización)
    await iconifyPage.setRequestInterception(true);
    iconifyPage.on('request', (req) => {
      const resourceType = req.resourceType();
      const url = req.url();

      // Solo permitir el fetch a la API de Iconify
      if (url.includes('api.iconify.design/search')) {
        req.continue();
      } else if (['image', 'font', 'stylesheet', 'media', 'texttrack', 'eventsource', 'websocket', 'manifest', 'other'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Headers realistas
    await iconifyPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
    );

    await iconifyPage.setViewport({ width: 1280, height: 720 });

    // Navegar a Iconify una sola vez
    console.log('🌐 Navegando a Iconify (solo esta vez)...');
    await iconifyPage.goto('https://icon-sets.iconify.design/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('✅ Página permanente lista');
  }

  return { browser, page: iconifyPage };
}

// Buscar iconos usando la página permanente
async function searchIconify(query, limit = 999) {
  const cacheKey = `${query}-${limit}`;

  // Verificar caché
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      stats.cacheHits++;
      console.log(`📦 [CACHE HIT] "${query}"`);
      return cached.data;
    } else {
      cache.delete(cacheKey);
    }
  }

  stats.cacheMisses++;
  stats.activeRequests++;

  try {
    const { page } = await initBrowserAndPage();

    console.log(`🔍 [REQUEST] Buscando "${query}" (limit: ${limit})...`);

    // Ejecutar fetch directamente en la página de Iconify
    const data = await page.evaluate(async (q, l) => {
      try {
        const response = await fetch(
          `https://api.iconify.design/search?query=${q}&limit=${l}`,
          {
            headers: {
              'accept': '*/*',
              'accept-language': 'es-US,es;q=0.9',
              'Referer': 'https://icon-sets.iconify.design/'
            },
            method: 'GET'
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    }, query, limit);


    if (data.error) {
      throw new Error(data.error);
    }

    // Guardar en caché con límite
    addToCache(cacheKey, data);

    console.log(`✅ [SUCCESS] "${query}" - Total: ${data.total || 0}`);
    return data;

  } catch (error) {
    stats.errors++;
    console.error(`❌ [ERROR] "${query}":`, error.message);
    throw error;
  } finally {
    stats.activeRequests--;
  }
}

// Función para agregar al caché con límite
function addToCache(key, data) {
  // Si el caché está lleno, eliminar la entrada más antigua (FIFO)
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
    stats.cacheEvictions++;
    console.log(`🗑️ Caché lleno (${MAX_CACHE_SIZE}), eliminando: ${firstKey}`);
  }

  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Limpieza automática de caché expirado
function cleanExpiredCache() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    stats.cacheCleanups++;
    console.log(`🧹 Limpieza automática: ${cleaned} entradas expiradas eliminadas`);
  }

  return cleaned;
}

// Ejecutar limpieza cada 2 minutos
setInterval(cleanExpiredCache, 1000 * 60 * 2);

// Monitoreo de memoria cada minuto
setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const rssMB = (mem.rss / 1024 / 1024).toFixed(2);

  console.log(`📊 Memoria - Heap: ${heapMB} MB | RSS: ${rssMB} MB | Caché: ${cache.size}/${MAX_CACHE_SIZE}`);

  // Alerta si supera el 80% del límite
  const warningThreshold = MAX_MEMORY_MB * 0.8;
  if (mem.heapUsed / 1024 / 1024 > warningThreshold) {
    console.warn(`⚠️ ALERTA: Heap alto (${heapMB} MB / ${MAX_MEMORY_MB} MB límite)`);
  }

  // Reinicio automático si supera el límite
  if (mem.heapUsed / 1024 / 1024 > MAX_MEMORY_MB) {
    console.error(`💥 MEMORIA CRÍTICA (${heapMB} MB > ${MAX_MEMORY_MB} MB) - Reiniciando...`);
    process.exit(1); // PM2/Docker/Easypanel lo reiniciará automáticamente
  }
}, 60000);

// RUTAS DE LA API

// Health check
app.get('/health', async (req, res) => {
  let pageStatus = 'closed';

  if (iconifyPage) {
    try {
      await iconifyPage.evaluate(() => true);
      pageStatus = 'active';
    } catch (e) {
      pageStatus = 'error';
    }
  }

  res.json({
    status: 'ok',
    browser: browser ? 'running' : 'stopped',
    page: pageStatus,
    stats: {
      ...stats,
      queueSize: queue.size,
      queuePending: queue.pending,
      cacheSize: cache.size
    },
    timestamp: new Date().toISOString()
  });
});

// Búsqueda de iconos
app.get('/api/search', async (req, res) => {
  const { query, limit = 999 } = req.query;

  if (!query) {
    return res.status(400).json({
      error: 'Parámetro "query" es requerido',
      example: '/api/search?query=pizzas&limit=999'
    });
  }

  stats.totalRequests++;

  try {
    // Agregar a la cola para controlar concurrencia
    const data = await queue.add(() => searchIconify(query, parseInt(limit)));

    res.json({
      status: 'success',
      query,
      total: data.total || 0,
      icons: data.icons || [],
      collections: data.collections || {},
      cached: cache.has(`${query}-${limit}`),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en /api/search:', error.message);
    res.status(500).json({
      status: 'error',
      query,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Estadísticas del servidor
app.get('/api/stats', (req, res) => {
  res.json({
    stats: {
      ...stats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queueSize: queue.size,
      queuePending: queue.pending,
      cacheSize: cache.size,
      cacheKeys: Array.from(cache.keys())
    },
    config: {
      maxConcurrent: MAX_CONCURRENT,
      maxCacheSize: MAX_CACHE_SIZE,
      maxMemoryMB: MAX_MEMORY_MB,
      cacheTTL: CACHE_TTL / 1000 + 's',
      port: PORT
    },
    timestamp: new Date().toISOString()
  });
});

// Diagnóstico de memoria con sugerencias
app.get('/api/memory-health', (req, res) => {
  const mem = process.memoryUsage();
  const heapMB = mem.heapUsed / 1024 / 1024;
  const rssMB = mem.rss / 1024 / 1024;
  const heapPercent = (heapMB / MAX_MEMORY_MB) * 100;

  let status = 'healthy';
  let alerts = [];
  let suggestions = [];

  // Análisis de salud
  if (heapPercent > 90) {
    status = 'critical';
    alerts.push(`Memoria crítica: ${heapMB.toFixed(2)} MB (${heapPercent.toFixed(1)}% del límite)`);
    suggestions.push('ACCIÓN INMEDIATA: El servidor se reiniciará pronto');
    suggestions.push('Aumentar MAX_MEMORY_MB en variables de entorno');
    suggestions.push('Reducir MAX_CACHE_SIZE si el caché está lleno');
  } else if (heapPercent > 80) {
    status = 'warning';
    alerts.push(`Memoria alta: ${heapMB.toFixed(2)} MB (${heapPercent.toFixed(1)}% del límite)`);
    suggestions.push('Considerar limpiar caché manualmente: DELETE /api/cache');
    suggestions.push('Monitorear crecimiento en los próximos minutos');
  } else if (heapPercent > 60) {
    status = 'moderate';
    alerts.push(`Uso moderado: ${heapMB.toFixed(2)} MB (${heapPercent.toFixed(1)}% del límite)`);
  }

  // Análisis de caché
  const cachePercent = (cache.size / MAX_CACHE_SIZE) * 100;
  if (cachePercent > 90) {
    alerts.push(`Caché casi lleno: ${cache.size}/${MAX_CACHE_SIZE} (${cachePercent.toFixed(1)}%)`);
    suggestions.push('El caché está eliminando entradas automáticamente (FIFO)');
  }

  // Análisis de evictions
  if (stats.cacheEvictions > 100) {
    alerts.push(`Alto número de evictions: ${stats.cacheEvictions}`);
    suggestions.push('Considerar aumentar MAX_CACHE_SIZE para mejor rendimiento');
  }

  // Estimación de capacidad
  const avgMemoryPerRequest = cache.size > 0 ? heapMB / cache.size : 0;
  const estimatedCapacity = avgMemoryPerRequest > 0 ? Math.floor(MAX_MEMORY_MB / avgMemoryPerRequest) : 'N/A';

  res.json({
    status,
    health: {
      heapUsedMB: parseFloat(heapMB.toFixed(2)),
      heapLimitMB: MAX_MEMORY_MB,
      heapPercent: parseFloat(heapPercent.toFixed(2)),
      rssMB: parseFloat(rssMB.toFixed(2)),
      uptimeHours: parseFloat((process.uptime() / 3600).toFixed(2))
    },
    cache: {
      size: cache.size,
      limit: MAX_CACHE_SIZE,
      percent: parseFloat(cachePercent.toFixed(2)),
      evictions: stats.cacheEvictions,
      cleanups: stats.cacheCleanups
    },
    performance: {
      totalRequests: stats.totalRequests,
      cacheHitRate: stats.totalRequests > 0 ? parseFloat(((stats.cacheHits / stats.totalRequests) * 100).toFixed(2)) : 0,
      avgMemoryPerCacheEntry: cache.size > 0 ? parseFloat((heapMB / cache.size).toFixed(3)) : 0,
      estimatedMaxCacheEntries: estimatedCapacity
    },
    alerts,
    suggestions,
    timestamp: new Date().toISOString()
  });
});

// Información del caché
app.get('/api/cache-stats', (req, res) => {
  res.json({
    cacheSize: cache.size,
    cachedKeys: Array.from(cache.keys()),
    timestamp: new Date().toISOString()
  });
});

// Limpiar caché
app.delete('/api/cache', (req, res) => {
  const clearedCount = cache.size;
  cache.clear();
  res.json({
    message: 'Caché limpiado',
    clearedCount,
    timestamp: new Date().toISOString()
  });
});

// Reset stats
app.delete('/api/stats', (req, res) => {
  stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    activeRequests: 0,
    errors: 0
  };
  res.json({
    message: 'Estadísticas reseteadas',
    timestamp: new Date().toISOString()
  });
});



// Manejo de errores global
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
});

// Graceful shutdown
async function shutdown() {
  console.log('\n⚠️  Cerrando servidor gracefully...');

  if (iconifyPage) {
    await iconifyPage.close();
    console.log('✅ Página cerrada');
  }

  if (browser) {
    await browser.close();
    console.log('✅ Navegador cerrado');
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Iniciar servidor
const server = app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🎨 ICONIFY SEARCH API v2.0 OPTIMIZED    ║
║   🚀 Single Page Architecture             ║
║                                            ║
║   📍 http://localhost:${PORT}                ║
║                                            ║
║   ⚡ Performance:                          ║
║      • Una sola página permanente         ║
║      • Fetch nativo desde Iconify         ║
║      • Cola: \${MAX_CONCURRENT} requests simultáneos    ║
║      • Caché: 5 minutos                   ║
║                                            ║
║   🔍 GET /api/search?query=...            ║
║   📊 GET /api/stats                       ║
║   ❤️  GET /health                          ║
╚════════════════════════════════════════════╝
`);

  // Inicializar página al arrancar
  try {
    await initBrowserAndPage();
    console.log('\n✅ Sistema listo para recibir requests\n');
  } catch (error) {
    console.error('❌ Error inicializando:', error.message);
  }
});

// Keep alive - verificar página cada 2 minutos
setInterval(async () => {
  if (iconifyPage) {
    try {
      await iconifyPage.evaluate(() => document.title);
      console.log('✅ Keep-alive: Página activa');
    } catch (e) {
      console.log('⚠️  Keep-alive: Reiniciando página...');
      iconifyPage = null;
      await initBrowserAndPage();
    }
  }
}, 1000 * 60 * 2);

module.exports = app;
