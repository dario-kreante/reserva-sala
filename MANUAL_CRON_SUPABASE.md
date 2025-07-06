# 📋 MANUAL PASO A PASO - CRON JOB EN PANEL SUPABASE

## 🎯 **RESUMEN: EL CRON JOB YA ESTÁ FUNCIONANDO**

✅ **Status**: **IMPLEMENTADO Y ACTIVO**  
✅ **Horario**: Diariamente a las 2:00 AM UTC (11:00 PM Chile)  
✅ **Próxima ejecución**: Esta madrugada automáticamente  

---

## 🔍 **PASO 1: VERIFICAR QUE ESTÁ FUNCIONANDO**

### Ir al Panel de Supabase
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto de reserva de salas
3. Ve a **SQL Editor** (icono </> en el menú lateral)

### Ejecutar Verificación
```sql
-- Copia y pega esta consulta en el SQL Editor:
SELECT 
  '🎉 CRON JOB ACTIVO' as status,
  jobname as "Nombre del Job",
  schedule as "Horario (UTC)",
  CASE 
    WHEN active THEN '✅ Funcionando' 
    ELSE '❌ Inactivo' 
  END as "Estado",
  command as "Comando"
FROM cron.job 
WHERE jobname = 'marcar-reservas-vencidas-diario';
```

**Resultado esperado:**
```
status               | Nombre del Job              | Horario (UTC) | Estado        | Comando
---------------------|----------------------------|---------------|---------------|---------------------------
🎉 CRON JOB ACTIVO   | marcar-reservas-vencidas-diario | 0 2 * * *    | ✅ Funcionando | SELECT cron_marcar_reservas_vencidas();
```

---

## 📊 **PASO 2: VER HISTORIAL DE EJECUCIONES**

### Consultar Logs Recientes
```sql
-- Ver las últimas ejecuciones del cron job:
SELECT 
  fecha_creacion as "📅 Fecha",
  CASE 
    WHEN tipo_operacion = 'cron_reservas_vencidas' THEN '✅ Exitoso'
    ELSE '❌ Error'
  END as "Estado",
  descripcion as "📝 Descripción",
  detalles->>'reservas_procesadas' as "🔄 Reservas Procesadas",
  detalles->>'duracion_ms' as "⏱️ Duración (ms)"
FROM logs_sistema 
WHERE tipo_operacion LIKE 'cron_reservas_vencidas%'
ORDER BY fecha_creacion DESC 
LIMIT 10;
```

---

## 🧪 **PASO 3: PROBAR MANUALMENTE**

### Ejecutar Cron Job Inmediatamente
```sql
-- Probar la función manualmente (no afecta el horario automático):
SELECT cron_marcar_reservas_vencidas();

-- Ver el resultado del último log:
SELECT 
  '✅ PRUEBA MANUAL COMPLETADA' as resultado,
  descripcion,
  detalles->>'reservas_procesadas' as reservas_actualizadas,
  fecha_creacion
FROM logs_sistema 
WHERE tipo_operacion = 'cron_reservas_vencidas'
ORDER BY fecha_creacion DESC 
LIMIT 1;
```

---

## ⚙️ **PASO 4: ADMINISTRACIÓN AVANZADA**

### Cambiar Horario (Si es necesario)
```sql
-- ⚠️ SOLO si quieres cambiar el horario
-- Ejemplo: Cambiar a las 3:00 AM UTC

-- Primero cancelar el actual:
SELECT cron.unschedule('marcar-reservas-vencidas-diario');

-- Crear nuevo con horario diferente:
SELECT cron.schedule(
  'marcar-reservas-vencidas-diario',
  '0 3 * * *',  -- 3:00 AM UTC en lugar de 2:00 AM
  'SELECT cron_marcar_reservas_vencidas();'
);

-- Verificar que se aplicó:
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'marcar-reservas-vencidas-diario';
```

### Pausar Temporalmente
```sql
-- Para pausar el cron job:
SELECT cron.unschedule('marcar-reservas-vencidas-diario');

-- Para reactivar después:
SELECT cron.schedule(
  'marcar-reservas-vencidas-diario',
  '0 2 * * *',
  'SELECT cron_marcar_reservas_vencidas();'
);
```

---

## 🕐 **HORARIOS DE REFERENCIA**

### Configuración Actual
- **UTC**: 2:00 AM
- **Chile**: 11:00 PM (día anterior)
- **España**: 3:00 AM
- **México**: 8:00 PM (día anterior)

### Para Ajustar a Zona Horaria Local Chile
```sql
-- Si quieres que se ejecute a las 2:00 AM hora Chile:
SELECT cron.unschedule('marcar-reservas-vencidas-diario');
SELECT cron.schedule(
  'marcar-reservas-vencidas-diario',
  '0 5 * * *',  -- 5:00 AM UTC = 2:00 AM Chile
  'SELECT cron_marcar_reservas_vencidas();'
);
```

---

## 🚨 **TROUBLESHOOTING**

### Si No Aparece el Cron Job
```sql
-- Verificar que pg_cron está instalado:
SELECT name, installed_version 
FROM pg_available_extensions 
WHERE name = 'pg_cron';

-- Si no está instalado, instalarlo:
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Si No Hay Logs
```sql
-- Verificar que la tabla de logs existe:
SELECT COUNT(*) as total_logs FROM logs_sistema;

-- Si no existe, crearla:
CREATE TABLE IF NOT EXISTS logs_sistema (
  id bigserial PRIMARY KEY,
  tipo_operacion varchar(100) NOT NULL,
  descripcion text,
  detalles jsonb,
  fecha_creacion timestamptz DEFAULT NOW()
);
```

### Recrear Cron Job Desde Cero
```sql
-- Si hay problemas, recrear completamente:
SELECT cron.unschedule('marcar-reservas-vencidas-diario');

SELECT cron.schedule(
  'marcar-reservas-vencidas-diario',
  '0 2 * * *',
  'SELECT cron_marcar_reservas_vencidas();'
);

-- Verificar:
SELECT * FROM verificar_cron_jobs();
```

---

## ✅ **CONFIRMACIÓN FINAL**

### ¿Cómo saber que todo está bien?
1. **Consulta de verificación** muestra el cron job activo ✅
2. **Logs** muestran ejecuciones exitosas ✅  
3. **Prueba manual** funciona correctamente ✅

### ¿Qué sucede automáticamente?
- **Cada día a las 2:00 AM UTC**: El sistema busca reservas pendientes con fechas pasadas
- **Marca como 'vencida'**: Las reservas encontradas cambian de estado automáticamente
- **Registra en logs**: Cada ejecución queda documentada con timestamp y detalles
- **Sin intervención manual**: Funciona completamente solo

---

## 🎉 **RESULTADO FINAL**

**🚀 EL CRON JOB ESTÁ 100% FUNCIONAL Y AUTOMÁTICO**

- ✅ **Instalado**: pg_cron funcionando
- ✅ **Configurado**: Job programado diariamente  
- ✅ **Probado**: Función ejecutada exitosamente
- ✅ **Monitoreado**: Logs completos disponibles
- ✅ **Automático**: No requiere intervención manual

**La próxima ejecución será esta madrugada a las 2:00 AM UTC automáticamente** 🌙

---

### 📞 Soporte
Si necesitas ayuda adicional, ejecuta la consulta de verificación del **Paso 1** y comparte el resultado. 