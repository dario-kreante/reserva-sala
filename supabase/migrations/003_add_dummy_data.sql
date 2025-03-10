-- Insert dummy data into salas
INSERT INTO salas (nombre, tipo, capacidad, centro, descripcion)
VALUES
  ('Sala A101', 'Clase', 30, 'Facultad de Psicología', 'Sala para clases pequeñas'),
  ('Auditorio Principal', 'Auditorio', 200, 'Facultad de Psicología', 'Auditorio para eventos grandes'),
  ('Sala de Reuniones 1', 'Reunión', 15, 'Facultad de Psicología', 'Sala para reuniones de profesores'),
  ('Laboratorio de Psicología', 'Laboratorio', 20, 'Facultad de Psicología', 'Laboratorio para experimentos'),
  ('Sala de Terapia 1', 'Terapia', 5, 'Centro de Atención Psicológica', 'Sala para sesiones de terapia individual');

-- Insert dummy data into usuarios
INSERT INTO usuarios (email, nombre, apellido, rol, es_usuario_externo, departamento, rut)
VALUES
  ('admin@utalca.cl', 'Admin', 'Principal', 'superadmin', FALSE, 'Administración', '11111111-1'),
  ('profesor1@utalca.cl', 'Juan', 'Pérez', 'profesor', FALSE, 'Psicología Clínica', '22222222-2'),
  ('profesor2@utalca.cl', 'María', 'González', 'profesor', FALSE, 'Psicología Educacional', '33333333-3'),
  ('alumno1@alumnos.utalca.cl', 'Pedro', 'Sánchez', 'alumno', FALSE, NULL, '44444444-4'),
  ('alumno2@alumnos.utalca.cl', 'Ana', 'Martínez', 'alumno', FALSE, NULL, '55555555-5'),
  ('externo@ejemplo.com', 'Carlos', 'Rodríguez', 'profesor', TRUE, 'Psicología Organizacional', '66666666-6');

-- Insert dummy data into horarios
INSERT INTO horarios (sala_id, fecha, hora_inicio, hora_fin, recurrencia)
VALUES
  (1, '2023-11-20', '09:00', '11:00', 'semanal'),
  (2, '2023-11-21', '14:00', '16:00', 'unico'),
  (3, '2023-11-22', '10:00', '12:00', 'mensual'),
  (4, '2023-11-23', '15:00', '17:00', 'semanal'),
  (5, '2023-11-24', '11:00', '13:00', 'semanal');

-- Insert dummy data into reservas
INSERT INTO reservas (usuario_id, sala_id, fecha, hora_inicio, hora_fin, estado, comentario, es_urgente)
VALUES
  ((SELECT id FROM usuarios WHERE email = 'profesor1@utalca.cl'), 1, '2023-11-20', '09:00', '11:00', 'aprobada', 'Clase de Introducción a la Psicología', FALSE),
  ((SELECT id FROM usuarios WHERE email = 'profesor2@utalca.cl'), 2, '2023-11-21', '14:00', '16:00', 'pendiente', 'Conferencia sobre Psicología Educativa', FALSE),
  ((SELECT id FROM usuarios WHERE email = 'alumno1@alumnos.utalca.cl'), 3, '2023-11-22', '10:00', '12:00', 'aprobada', 'Reunión de grupo de estudio', FALSE),
  ((SELECT id FROM usuarios WHERE email = 'externo@ejemplo.com'), 4, '2023-11-23', '15:00', '17:00', 'rechazada', 'Taller de Psicología Organizacional', TRUE),
  ((SELECT id FROM usuarios WHERE email = 'profesor1@utalca.cl'), 5, '2023-11-24', '11:00', '13:00', 'aprobada', 'Sesión de terapia grupal', FALSE);

-- Create configuracion table
CREATE TABLE configuracion (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for configuracion
CREATE TRIGGER update_configuracion_updated_at
    BEFORE UPDATE ON configuracion
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert dummy data into configuracion
INSERT INTO configuracion (clave, valor, descripcion)
VALUES
  ('dias_protegidos', 'Lunes,Miércoles,Viernes', 'Días protegidos para auditorios'),
  ('tiempo_maximo_reserva', '120', 'Tiempo máximo de reserva en minutos'),
  ('limite_solicitudes_pendientes', '5', 'Límite de solicitudes pendientes por usuario'),
  ('anticipacion_maxima_reserva', '30', 'Anticipación máxima de reserva en días'),
  ('notificaciones_email', 'true', 'Activar notificaciones por email'),
  ('tiempo_antelacion_recordatorio', '24', 'Tiempo de antelación para recordatorios en horas');

-- Enable RLS on configuracion table
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for configuracion table
CREATE POLICY "Configuración visible para todos los usuarios autenticados"
ON configuracion FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo superadmin puede modificar la configuración"
ON configuracion FOR INSERT
TO authenticated
USING (auth.jwt() ->> 'role' = 'superadmin');

CREATE POLICY "Solo superadmin puede actualizar la configuración"
ON configuracion FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'role' = 'superadmin');

CREATE POLICY "Solo superadmin puede eliminar la configuración"
ON configuracion FOR DELETE
TO authenticated
USING (auth.jwt() ->> 'role' = 'superadmin');

-- Create notificaciones table
CREATE TABLE notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    contenido TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for notificaciones
CREATE TRIGGER update_notificaciones_updated_at
    BEFORE UPDATE ON notificaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on notificaciones table
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notificaciones table
CREATE POLICY "Usuarios pueden ver sus propias notificaciones"
ON notificaciones FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "Sistema puede crear notificaciones"
ON notificaciones FOR INSERT
TO authenticated
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Usuarios pueden marcar sus notificaciones como leídas"
ON notificaciones FOR UPDATE
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "Sistema puede eliminar notificaciones antiguas"
ON notificaciones FOR DELETE
TO authenticated
USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert dummy data into notificaciones
INSERT INTO notificaciones (usuario_id, tipo, contenido)
VALUES
  ((SELECT id FROM usuarios WHERE email = 'profesor1@utalca.cl'), 'reserva_aprobada', 'Su reserva para la Sala A101 el 2023-11-20 ha sido aprobada.'),
  ((SELECT id FROM usuarios WHERE email = 'profesor2@utalca.cl'), 'reserva_pendiente', 'Su reserva para el Auditorio Principal el 2023-11-21 está pendiente de aprobación.'),
  ((SELECT id FROM usuarios WHERE email = 'alumno1@alumnos.utalca.cl'), 'reserva_aprobada', 'Su reserva para la Sala de Reuniones 1 el 2023-11-22 ha sido aprobada.'),
  ((SELECT id FROM usuarios WHERE email = 'externo@ejemplo.com'), 'reserva_rechazada', 'Su reserva para el Laboratorio de Psicología el 2023-11-23 ha sido rechazada.'),
  ((SELECT id FROM usuarios WHERE email = 'admin@utalca.cl'), 'nueva_solicitud', 'Hay una nueva solicitud de reserva pendiente de aprobación.');

-- Create logs table
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(50) NOT NULL,
    detalles JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on logs table
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for logs table
CREATE POLICY "Solo administradores pueden ver los logs"
ON logs FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'role' IN ('superadmin', 'admin'));

CREATE POLICY "Sistema puede crear logs"
ON logs FOR INSERT
TO authenticated
USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert dummy data into logs
INSERT INTO logs (usuario_id, accion, detalles)
VALUES
  ((SELECT id FROM usuarios WHERE email = 'admin@utalca.cl'), 'login', '{"ip": "192.168.1.1", "user_agent": "Mozilla/5.0"}'),
  ((SELECT id FROM usuarios WHERE email = 'profesor1@utalca.cl'), 'crear_reserva', '{"sala_id": 1, "fecha": "2023-11-20"}'),
  ((SELECT id FROM usuarios WHERE email = 'admin@utalca.cl'), 'aprobar_reserva', '{"reserva_id": 1}'),
  ((SELECT id FROM usuarios WHERE email = 'alumno1@alumnos.utalca.cl'), 'modificar_perfil', '{"campo": "telefono"}'),
  ((SELECT id FROM usuarios WHERE email = 'admin@utalca.cl'), 'crear_sala', '{"nombre": "Nueva Sala", "capacidad": 25}');

