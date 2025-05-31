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
 * Verifica si una fecha es pasada o futura
 * @param fecha Fecha en formato YYYY-MM-DD
 * @param fechaActual Fecha actual opcional (para tests)
 * @returns {boolean} Verdadero si la fecha es futura o actual, falso si es pasada
 */
export function esFechaValida(fecha: string, fechaActual: Date = new Date()): boolean {
  // Convertir la fecha de entrada a formato YYYY-MM-DD para comparación consistente
  const fechaSeleccionadaStr = fecha.split('T')[0]; // Por si acaso incluye hora
  const partesFecha = fechaSeleccionadaStr.split('-');
  
  // Asegurar formato año-mes-día
  if (partesFecha.length !== 3) {
    return false;
  }
  
  // Crear fecha usando año, mes (0-indexado), día
  const fechaSeleccionada = new Date(
    parseInt(partesFecha[0]), 
    parseInt(partesFecha[1]) - 1, 
    parseInt(partesFecha[2])
  );
  fechaSeleccionada.setHours(0, 0, 0, 0);
  
  // Normalizar la fecha actual a medianoche
  const hoy = new Date(fechaActual);
  hoy.setHours(0, 0, 0, 0);
  
  // Comparar fechas normalizadas por día (sin hora)
  return fechaSeleccionada.getTime() >= hoy.getTime();
}

/**
 * Comprueba si hay conflicto entre el horario solicitado y los horarios ocupados
 * @param horaInicio Hora de inicio solicitada
 * @param horaFin Hora de fin solicitada
 * @param horariosOcupados Lista de horarios ya ocupados (deben ser previamente filtrados para incluir solo reservas con estado 'pendiente' o 'aprobada')
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