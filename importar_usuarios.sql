-- Script para importar usuarios desde Excel a la base de datos
-- Versión 1.1 - Corregida la interpretación de nombres y apellidos

-- Función para formatear el RUT con guión y dígito verificador
CREATE OR REPLACE FUNCTION format_rut(rut_sin_dv TEXT, dv TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN rut_sin_dv || '-' || dv;
END;
$$ LANGUAGE plpgsql;

-- Tabla temporal para almacenar los datos del Excel
CREATE TEMP TABLE temp_usuarios (
  rut TEXT,
  dv TEXT,
  nombre_completo TEXT,
  centro_costo TEXT,
  email TEXT,
  rol TEXT
);

-- Insertar los datos del Excel en la tabla temporal
INSERT INTO temp_usuarios (rut, dv, nombre_completo, centro_costo, email, rol) VALUES
('6454895', '6', 'MOYANO DIAZ EMILIO EDMUNDO', 'FPS310001', 'EMOYANO@UTALCA.CL', 'USUARIO'),
('8186514', '0', 'ITURRA HERRERA CAROLINA', 'FPS200001', 'CITURRA@UTALCA.CL', 'USUARIO'),
('8939770', '7', 'OLIVA GALLEGOS ALFONSO ANTONIO', 'FPS200001', 'AOLIVA@UTALCA.CL', 'USUARIO'),
('9452855', '0', 'VOGEL GONZALEZ EDGAR HARRY', 'FPS200001', 'EVOGEL@UTALCA.CL', 'USUARIO'),
('9692682', '0', 'CANCINO SANDOVAL VIVIANA MARLE', 'FPS200001', 'VICANCINO@UTALCA.CL', 'ADMINISTRADORA FACULTAD'),
('10112688', '9', 'POBLETE AVENDAÑO LAURA ROSA', 'FPS310002', 'LAPOBLETE@UTALCA.CL', 'ADMINISTRADORA ESCUELA TERAPIA OCUPACIONAL'),
('10212771', '4', 'MENDEZ CAMPOS MARIA DORIS', 'FPS200001', 'DMENDEZ@UTALCA.CL', 'USUARIO'),
('10542304', '7', 'NUÑEZ GUTIERREZ DANIEL EDMUNDO', 'FPS200001', 'DNUNEZ@UTALCA.CL', 'USUARIO'),
('10551733', '5', 'ROJAS BARAHONA CRISTIAN ANDRES', 'FPS200001', 'C.ROJAS@UTALCA.CL', 'USUARIO'),
('10765277', '9', 'SANCHEZ RETAMAL GABRIEL ANTONI', 'FPS200001', 'GASANCHEZ@UTALCA.CL', 'USUARIO'),
('10983456', '4', 'KREITHER OLIVARES JOHANNA MARG', 'FPS200001', 'JKREITHER@UTALCA.CL', 'USUARIO'),
('11506355', '3', 'CASTILLO GUEVARA RAMON DANIEL', 'FPS200001', 'RACASTILLO@UTALCA.CL', 'USUARIO'),
('12136227', '9', 'FRESNO RODRIGUEZ ANDRES', 'FPS200001', 'AFRESNO@UTALCA.CL', 'USUARIO'),
('12642886', '3', 'DURAN JARA ANDRES ANTONIO', 'FPS310002', 'ANDRES.DURAN@UTALCA.CL', 'USUARIO'),
('12684156', '6', 'VARGAS GARRIDO HECTOR ANDRES', 'FPS200001', 'HVARGAS@UTALCA.CL', 'USUARIO'),
('12721498', '0', 'CARDENAS CASTRO JOSE MANUEL', 'FPS200001', 'JOSE.CARDENAS@UTALCA.CL', 'USUARIO'),
('13033592', '6', 'RAMOS ALVARADO NADIA AMIRA', 'FPS200001', 'NRAMOS@UTALCA.CL', 'USUARIO'),
('13048453', '0', 'ACOSTA ANTOGNONI HEDY CAROLINA', 'FPS200001', 'HACOSTA@UTALCA.CL', 'USUARIO'),
('13227265', '4', 'GALLARDO CUADRA ISMAEL ENRIQUE', 'FPS200001', 'IGALLARDO@UTALCA.CL', 'USUARIO'),
('13335727', '0', 'SPENCER CONTRERAS ROSARIO ELEN', 'FPS200001', 'RSPENCER@UTALCA.CL', 'USUARIO'),
('13454344', '2', 'LEIVA BIANCHI MARCELO CRISTIAN', 'FPS200001', 'MARCLEIVA@UTALCA.CL', 'USUARIO'),
('13756490', '4', 'NORAMBUENA SEPULVEDA KAREN MAR', 'FPS200001', 'KNORAMBUENA@UTALCA.CL', 'ADMINISTRADORA INFORMÁTICA PSICOLOGÍA'),
('13950767', '3', 'GONZALEZ CANCINO KATHERINE MEL', 'FPS340002', 'KAGONZALEZ@UTALCA.CL', 'ADMINISTRADORA CEPA'),
('14253940', '3', 'JIMENEZ FIGUEROA ANDRES EDUARD', 'FPS200001', 'ANJIMENEZ@UTALCA.CL', 'USUARIO'),
('14345178', 'K', 'PAZ MELLADO MARIEL DE LOS ANGE', 'FPS310001', 'MPAZ@UTALCA.CL', 'ADMINISTRADORA ESCUELA PSICOLOGÍA'),
('14508030', '4', 'GÓMEZ OJEDA FABIOLA ALEJANDRA', 'FPS200001', 'FABIOLA.GOMEZ@UTALCA.CL', 'USUARIO'),
('14524299', '1', 'COFRE ALBORNOZ LORETO DEL PILA', 'FCS320010', 'LCOFRE@UTALCA.CL', 'USUARIO'),
('14565030', '5', 'ENCINA AGURTO YONATAN JOSE', 'FPS310001', 'YENCINA@UTALCA.CL', 'USUARIO'),
('15136673', '2', 'CERDA GONZALEZ ANDREA ISABEL', 'FPS310001', 'ANDREACERDA@UTALCA.CL', 'USUARIO'),
('15136913', '8', 'CONCHA PONCE PABLO ANDRES', 'FPS310001', 'PABLO.CONCHA@UTALCA.CL', 'USUARIO'),
('15261661', '9', 'ULLOA FULGERI JOSE LUIS', 'FPS200001', 'JOULLOA@UTALCA.CL', 'USUARIO'),
('15461774', '4', 'VALENZUELA MUÑOZ ANGEL ANDRES', 'FPS310001', 'ANVALENZUELA@UTALCA.CL', 'USUARIO'),
('15598859', '2', 'URIBE ORTIZ NATALIA PAULINA', 'FPS310001', 'NURIBE@UTALCA.CL', 'USUARIO'),
('15907505', '2', 'MENDOZA NUÑEZ CARLA VERONICA', 'FPS340002', 'CAMENDOZA@UTALCA.CL', 'USUARIO'),
('16092616', '3', 'HELBIG SOTO FABIOLA MARIA DEL', 'FPS310002', 'FABIOLA.HELBIG@UTALCA.CL', 'USUARIO'),
('16456248', '4', 'SALGADO REYES FELIPE IGNACIO', 'FPS310002', 'FSALGADO@UTALCA.CL', 'ADMINISTRADOR INFORMÁTICA TERAPIA OCUPACIONAL'),
('16484439', '0', 'LOPEZ ALEGRIA PABLO ANDRES', 'FPS310002', 'PABLO.LOPEZ@UTALCA.CL', 'USUARIO'),
('16569157', '1', 'LEON FUENTES JUAN SEBASTIAN', 'FPS310002', 'JUAN.LEON@UTALCA.CL', 'USUARIO'),
('16904851', '7', 'CANCINO LETELIER NATALIA ALEJA', 'FPS340002', 'NCANCINO@UTALCA.CL', 'USUARIO'),
('16938969', '1', 'OPAZO ALMARZA MARCELA PAZ', 'FPS310002', 'MARCELA.OPAZO@UTALCA.CL', 'USUARIO'),
('16998214', '7', 'GARCIA ZERENE MARIA DEL PILAR', 'FPS340002', 'MGARCIAZ@UTALCA.CL', 'USUARIO'),
('17343465', '0', 'FERNANDEZ CARDENAS DIEGO ALEJA', 'FPS310002', 'DIEGO.FERNANDEZ@UTALCA.CL', 'USUARIO'),
('17494238', '2', 'IBARRA FLORES CRISTIAN ALEJAND', 'FPS200001', 'CRIBARRA@UTALCA.CL', 'SUPER ADMIN'),
('17795079', '3', 'HERRERA TELLO ALEJANDRA BELEN', 'FPS340002', 'AHERRERA@UTALCA.CL', 'USUARIO'),
('17822183', '3', 'ACEVEDO CAMPOS ROSE MARY', 'FPS310002', 'ROSE.ACEVEDO@UTALCA.CL', 'ADMINISTRADORA LABORATORIOS DISCIPLINARES TERAPIA OCUPACIONAL'),
('18111746', 'K', 'MOSQUERA VEGA CAMILA SOLEDAD', 'FPS310002', 'CAMILA.MOSQUERA@UTALCA.CL', 'USUARIO'),
('18176209', '8', 'CAMPOS SOTO SUSANA VERONICA', 'FPS340002', 'SUSANA.CAMPOS@UTALCA.CL', 'USUARIO'),
('18197791', '4', 'VASQUEZ CARRASCO EDGAR MAXIMIL', 'FPS310002', 'EDGAR.VASQUEZ@UTALCA.CL', 'USUARIO'),
('18321938', '3', 'LÓPEZ ANDAUR ROBERTO ANDRÉS', 'FPS310002', 'ROBERTO.LOPEZ@UTALCA.CL', 'USUARIO'),
('18360172', '5', 'CASTRO LARA FERNANDA ELISA', 'FPS330001', 'FERNANDA.CASTRO@UTALCA.CL', 'USUARIO'),
('18672598', '0', 'MARCHANT CASTILLO JOSE IGNACIO', 'FPS310002', 'JOSE.MARCHANT@UTALCA.CL', 'USUARIO'),
('19319919', '4', 'PONCE SEPULVEDA LUCIA VALENTIN', 'FPS340002', 'LUCIA.PONCE@UTALCA.CL', 'USUARIO'),
('19865161', '3', 'BARRA ROJAS EMILIO JOSÉ', 'FPS310001', 'EMILIO.BARRA@UTALCA.CL', 'USUARIO'),
('21694281', '7', 'SAN PELAYO FERRER ELIZABETH', 'FPS310001', 'ESANPELAYO@UTALCA.CL', 'USUARIO'),
('23559830', '2', 'VASQUEZ ORJUELA DIANA CAROLINA', 'FPS310002', 'DIANA.VASQUEZ@UTALCA.CL', 'USUARIO'),
('28044105', '8', 'FLORIANO LANDIM SIBILA', 'FPS200001', 'SIBILA.FLORIANO@UTALCA.CL', 'USUARIO');

-- Función para extraer el nombre y apellidos de un nombre completo
-- Formato en Excel: APELLIDO PATERNO APELLIDO MATERNO NOMBRES
CREATE OR REPLACE FUNCTION extraer_nombre_apellidos(nombre_completo TEXT)
RETURNS TABLE(nombre TEXT, apellido_paterno TEXT, apellido_materno TEXT) AS $$
DECLARE
  palabras TEXT[];
  num_palabras INTEGER;
  i INTEGER;
  nombre_resultado TEXT := '';
  apellido_paterno_resultado TEXT := '';
  apellido_materno_resultado TEXT := '';
BEGIN
  -- Dividir el nombre completo en palabras
  palabras := regexp_split_to_array(nombre_completo, '\s+');
  num_palabras := array_length(palabras, 1);
  
  -- Caso especial: SAN PELAYO (apellido compuesto)
  IF palabras[1] = 'SAN' AND palabras[2] = 'PELAYO' THEN
    apellido_paterno_resultado := 'SAN PELAYO';
    
    -- Si hay más palabras, la siguiente es apellido materno
    IF num_palabras >= 3 THEN
      apellido_materno_resultado := palabras[3];
      
      -- El resto son nombres
      FOR i IN 4..num_palabras LOOP
        nombre_resultado := nombre_resultado || ' ' || palabras[i];
      END LOOP;
    END IF;
  -- Caso general
  ELSE
    -- El primer elemento es apellido paterno
    apellido_paterno_resultado := palabras[1];
    
    -- Si hay al menos 3 palabras, la segunda es apellido materno
    IF num_palabras >= 3 THEN
      apellido_materno_resultado := palabras[2];
      
      -- El resto son nombres
      FOR i IN 3..num_palabras LOOP
        nombre_resultado := nombre_resultado || ' ' || palabras[i];
      END LOOP;
    -- Si solo hay 2 palabras, la segunda es el nombre
    ELSIF num_palabras = 2 THEN
      nombre_resultado := palabras[2];
    END IF;
  END IF;
  
  nombre_resultado := TRIM(nombre_resultado);
  
  RETURN QUERY SELECT 
    nombre_resultado, 
    apellido_paterno_resultado, 
    apellido_materno_resultado;
END;
$$ LANGUAGE plpgsql;

-- Crear una tabla temporal para procesar los nombres
CREATE TEMP TABLE temp_nombres AS
SELECT 
  rut,
  dv,
  nombre_completo,
  centro_costo,
  email,
  CASE 
    WHEN rol = 'SUPER ADMIN' THEN 'superadmin'
    WHEN rol = 'USUARIO' THEN 'profesor'
    WHEN rol LIKE 'ADMINISTRADOR%' OR rol LIKE 'ADMINISTRADORA%' THEN 'admin'
    ELSE 'profesor' -- Por defecto, asignar rol de profesor
  END as rol_normalizado,
  -- Extraer nombre y apellidos usando la función
  (extraer_nombre_apellidos(nombre_completo)).nombre as nombre,
  (extraer_nombre_apellidos(nombre_completo)).apellido_paterno as apellido_paterno,
  (extraer_nombre_apellidos(nombre_completo)).apellido_materno as apellido_materno
FROM temp_usuarios;

-- Insertar los usuarios en la tabla de usuarios
DO $$
DECLARE
  v_rut TEXT;
  v_dv TEXT;
  v_nombre_completo TEXT;
  v_email TEXT;
  v_rol TEXT;
  v_nombre TEXT;
  v_apellido_paterno TEXT;
  v_apellido_materno TEXT;
  v_apellido_completo TEXT;
  v_rut_formateado TEXT;
  v_departamento TEXT;
  v_contador INTEGER := 0;
  v_errores INTEGER := 0;
BEGIN
  -- Recorrer los registros de la tabla temporal
  FOR v_rut, v_dv, v_nombre_completo, v_email, v_rol, v_nombre, v_apellido_paterno, v_apellido_materno IN 
    SELECT rut, dv, nombre_completo, LOWER(email), rol_normalizado, nombre, apellido_paterno, apellido_materno 
    FROM temp_nombres
  LOOP
    BEGIN
      -- Formatear el RUT con guión
      v_rut_formateado := format_rut(v_rut, v_dv);
      
      -- Combinar apellidos para el campo apellido
      IF v_apellido_materno = '' THEN
        v_apellido_completo := v_apellido_paterno;
      ELSE
        v_apellido_completo := v_apellido_paterno || ' ' || v_apellido_materno;
      END IF;
      
      -- Extraer el departamento del centro de costo (simplemente usamos el centro como referencia)
      v_departamento := 'Facultad de Psicología';
      
      -- Insertar el usuario en la tabla de usuarios
      INSERT INTO usuarios (
        email, 
        nombre, 
        apellido, 
        rol, 
        es_usuario_externo, 
        departamento, 
        activo, 
        intentos_fallidos, 
        rut
      ) 
      VALUES (
        v_email, 
        INITCAP(LOWER(v_nombre)), 
        INITCAP(LOWER(v_apellido_completo)), 
        v_rol, 
        FALSE, 
        v_departamento, 
        TRUE, 
        0, 
        v_rut_formateado
      )
      ON CONFLICT (email) DO NOTHING; -- Ignorar si ya existe el email
      
      -- Incrementar el contador de usuarios insertados
      v_contador := v_contador + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Registrar el error y continuar con el siguiente usuario
      RAISE NOTICE 'Error al insertar usuario %: %', v_nombre_completo, SQLERRM;
      v_errores := v_errores + 1;
    END;
  END LOOP;
  
  -- Mostrar resumen
  RAISE NOTICE 'Proceso completado. % usuarios insertados, % errores.', v_contador, v_errores;
END $$;

-- Limpiar las tablas temporales
DROP TABLE temp_usuarios;
DROP TABLE temp_nombres;
DROP FUNCTION format_rut;
DROP FUNCTION extraer_nombre_apellidos;

-- Verificar los usuarios insertados
SELECT id, email, nombre, apellido, rol, rut FROM usuarios WHERE email LIKE '%@UTALCA.CL'; 