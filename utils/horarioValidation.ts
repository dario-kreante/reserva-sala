/**
 * Interfaz para un horario ocupado
 */
export interface HorarioOcupado {
  hora_inicio: string;
  hora_fin: string;
}

/**
 * Valida si el horario es consistente (hora de fin posterior a hora de inicio)
 * @param horaInicio Hora de inicio en formato HH:MM
 * @param horaFin Hora de fin en formato HH:MM
 * @returns {boolean} Verdadero si el horario es válido (fin posterior a inicio), falso si es inconsistente
 */
export function validarHorarioConsistente(horaInicio: string, horaFin: string): boolean {
  const inicio = new Date(`2000-01-01T${horaInicio}`)
  const fin = new Date(`2000-01-01T${horaFin}`)
  
  // La hora de fin debe ser posterior a la de inicio
  return inicio < fin
}

/**
 * Valida si una fecha es válida (no es pasada)
 * @param fecha Fecha en formato YYYY-MM-DD
 * @param fechaActual Fecha actual opcional (para tests)
 * @returns {boolean} Verdadero si la fecha es válida (hoy o futura), falso si es pasada
 */
export function esFechaValida(fecha: string, fechaActual: Date = new Date()): boolean {
  // Convertir la fecha a la zona horaria de Chile (UTC-4)
  const fechaChile = new Date(fechaActual.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  fechaChile.setHours(0, 0, 0, 0);
  
  // Convertir la fecha de entrada a objeto Date manteniendo la zona horaria de Chile
  const [year, month, day] = fecha.split('-').map(Number);
  const fechaSeleccionada = new Date(year, month - 1, day);
  fechaSeleccionada.setHours(0, 0, 0, 0);
  
  return fechaSeleccionada >= fechaChile;
}

/**
 * Comprueba si hay conflicto entre el horario solicitado y los horarios ocupados
 * @param horaInicio Hora de inicio solicitada
 * @param horaFin Hora de fin solicitada
 * @param horariosOcupados Lista de horarios ya ocupados
 * @returns {boolean} Verdadero si hay conflicto, falso si el horario está disponible
 */
export function hayConflictoHorario(
  horaInicio: string, 
  horaFin: string, 
  horariosOcupados: HorarioOcupado[]
): { conflicto: boolean; horarioConflicto?: string } {
  // Si el horario en sí no es consistente, no hay necesidad de verificar conflictos
  if (!validarHorarioConsistente(horaInicio, horaFin)) {
    return { conflicto: true };
  }
  
  const inicio = new Date(`2000-01-01T${horaInicio}`)
  const fin = new Date(`2000-01-01T${horaFin}`)
  
  for (const horario of horariosOcupados) {
    const horarioInicio = new Date(`2000-01-01T${horario.hora_inicio}`)
    const horarioFin = new Date(`2000-01-01T${horario.hora_fin}`)
    
    // Verificar todas las posibles formas de superposición:
    // 1. Si el inicio está dentro de un horario ocupado
    // 2. Si el fin está dentro de un horario ocupado
    // 3. Si el horario solicitado cubre completamente un horario ocupado
    if ((inicio >= horarioInicio && inicio < horarioFin) ||
        (fin > horarioInicio && fin <= horarioFin) ||
        (inicio <= horarioInicio && fin >= horarioFin)) {
      return { 
        conflicto: true, 
        horarioConflicto: `${horario.hora_inicio.slice(0, 5)} - ${horario.hora_fin.slice(0, 5)}`
      };
    }
  }
  
  return { conflicto: false };
}

/**
 * Valida una reserva completa, incluyendo fecha, horario y conflictos
 * @param fecha Fecha seleccionada
 * @param horaInicio Hora de inicio
 * @param horaFin Hora de fin
 * @param horariosOcupados Lista de horarios ocupados para esa fecha y sala
 * @param fechaActual Fecha actual opcional (para tests)
 * @returns {Object} Resultado de la validación
 */
export function validarReserva(
  fecha: string,
  horaInicio: string,
  horaFin: string,
  horariosOcupados: HorarioOcupado[],
  fechaActual: Date = new Date()
): { 
  esValida: boolean; 
  mensaje?: string;
  tipo?: 'fecha_pasada' | 'horario_inconsistente' | 'conflicto_horario'
} {
  // Validar que la fecha no sea pasada
  if (!esFechaValida(fecha, fechaActual)) {
    return {
      esValida: false,
      mensaje: 'No se pueden realizar reservas en fechas pasadas',
      tipo: 'fecha_pasada'
    };
  }
  
  // Validar que la hora de fin sea posterior a la de inicio
  if (!validarHorarioConsistente(horaInicio, horaFin)) {
    return {
      esValida: false,
      mensaje: 'La hora de fin debe ser posterior a la hora de inicio',
      tipo: 'horario_inconsistente'
    };
  }
  
  // Comprobar conflictos de horario
  const { conflicto, horarioConflicto } = hayConflictoHorario(horaInicio, horaFin, horariosOcupados);
  if (conflicto) {
    return {
      esValida: false,
      mensaje: horarioConflicto 
        ? `El horario seleccionado (${horaInicio.slice(0, 5)} - ${horaFin.slice(0, 5)}) se superpone con una reserva existente (${horarioConflicto})`
        : 'El horario seleccionado se superpone con una reserva existente',
      tipo: 'conflicto_horario'
    };
  }
  
  // Si se pasan todas las validaciones, la reserva es válida
  return { esValida: true };
} 