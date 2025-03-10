# Instrucciones para importar usuarios desde Excel

## Descripción

Este documento proporciona instrucciones para importar usuarios desde un archivo Excel a la base de datos del sistema de reserva de salas. El proceso utiliza un script SQL que procesa los datos de los usuarios y los inserta en la tabla `usuarios` de Supabase.

## Requisitos previos

- Acceso al panel de administración de Supabase
- Permisos para ejecutar scripts SQL en la base de datos
- Datos de usuarios en formato Excel con las columnas: RUT, DV, NOMBRE, CENTRO COSTO BASE, EMAIL, Rol

## Proceso de importación

### 1. Preparación del script

El script `importar_usuarios.sql` ya contiene los datos de los usuarios proporcionados en el archivo Excel. Si necesitas importar usuarios adicionales o diferentes, debes modificar la sección de inserción de datos en la tabla temporal:

```sql
-- Insertar los datos del Excel en la tabla temporal
INSERT INTO temp_usuarios (rut, dv, nombre_completo, centro_costo, email, rol) VALUES
('6454895', '6', 'MOYANO DIAZ EMILIO EDMUNDO', 'FPS310001', 'EMOYANO@UTALCA.CL', 'USUARIO'),
-- Añadir más usuarios aquí...
```

### 2. Ejecución del script

1. Accede al panel de administración de Supabase
2. Ve a la sección "SQL Editor"
3. Crea un nuevo script o abre uno existente
4. Copia y pega el contenido del archivo `importar_usuarios.sql`
5. Ejecuta el script haciendo clic en el botón "Run"

### 3. Verificación de resultados

El script mostrará un resumen al finalizar, indicando cuántos usuarios se insertaron y cuántos errores ocurrieron. Además, realizará una consulta para mostrar los usuarios insertados.

## Detalles del script

El script realiza las siguientes operaciones:

1. **Creación de funciones auxiliares**:
   - `format_rut`: Formatea el RUT con guión y dígito verificador.
   - `extraer_nombre_apellidos`: Analiza el nombre completo para extraer correctamente el nombre, apellido paterno y apellido materno.

2. **Creación de tabla temporal**: Crea una tabla temporal para almacenar los datos del Excel.

3. **Inserción de datos**: Inserta los datos de los usuarios en la tabla temporal.

4. **Procesamiento de nombres**: Crea una tabla temporal para procesar los nombres y normalizar los roles:
   - Extrae el nombre, apellido paterno y apellido materno usando la función que analiza la estructura del nombre completo
   - Maneja casos especiales como apellidos compuestos (ej. "SAN PELAYO")
   - Normaliza los roles según las reglas del sistema:
     - "SUPER ADMIN" → "superadmin"
     - "USUARIO" → "profesor"
     - "ADMINISTRADOR/A..." → "admin"
     - Otros → "profesor" (por defecto)

5. **Inserción en la tabla de usuarios**: Recorre los registros procesados e inserta cada usuario en la tabla `usuarios`.
   - Formatea el RUT con guión
   - Combina apellido paterno y materno para el campo apellido
   - Asigna el departamento (en este caso, "Facultad de Psicología")
   - Convierte los nombres y apellidos a formato adecuado (primera letra mayúscula)
   - Ignora usuarios con correos electrónicos duplicados

6. **Limpieza**: Elimina las tablas temporales y funciones creadas.

## Algoritmo de extracción de nombres y apellidos

El script utiliza un algoritmo para extraer correctamente el nombre, apellido paterno y apellido materno de cada usuario, considerando que en el Excel los datos están en formato "APELLIDO PATERNO APELLIDO MATERNO NOMBRES":

1. **Casos especiales**: Maneja apellidos compuestos como "SAN PELAYO".

2. **Estructura general**:
   - La primera palabra es el apellido paterno
   - La segunda palabra (si existe) es el apellido materno
   - Las palabras restantes son los nombres

3. **Ejemplos**:
   - "MOYANO DIAZ EMILIO EDMUNDO" → Apellido paterno: "Moyano", Apellido materno: "Diaz", Nombre: "Emilio Edmundo"
   - "ITURRA HERRERA CAROLINA" → Apellido paterno: "Iturra", Apellido materno: "Herrera", Nombre: "Carolina"
   - "SAN PELAYO FERRER ELIZABETH" → Apellido paterno: "San Pelayo", Apellido materno: "Ferrer", Nombre: "Elizabeth"

## Mapeo de roles

El script mapea los roles del Excel a los roles del sistema de la siguiente manera:

| Rol en Excel | Rol en el sistema |
|--------------|-------------------|
| SUPER ADMIN | superadmin |
| USUARIO | profesor |
| ADMINISTRADOR/A... | admin |
| Otros | profesor |

## Solución de problemas

Si encuentras errores durante la ejecución del script, verifica:

1. **Formato de datos**: Asegúrate de que los datos en el Excel tienen el formato correcto.
2. **Duplicados**: Verifica si hay usuarios con correos electrónicos duplicados.
3. **Restricciones de la base de datos**: Comprueba si los datos cumplen con las restricciones de la tabla `usuarios`.

Para ver los errores específicos, revisa los mensajes de error en la consola de Supabase.

## Notas adicionales

- El script está diseñado para manejar la importación de forma segura, ignorando usuarios duplicados en lugar de generar errores.
- Los usuarios se crean con el estado `activo = TRUE` por defecto.
- El campo `es_usuario_externo` se establece como `FALSE` para todos los usuarios importados.
- El departamento se establece como "Facultad de Psicología" para todos los usuarios, independientemente del centro de costo. 