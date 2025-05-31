import { 
  validarHorarioConsistente, 
  esFechaValida, 
  hayConflictoHorario,
  validarReserva,
  HorarioOcupado
} from '../horarioValidation';

describe('Validación de horarios', () => {
  // Tests para validarHorarioConsistente
  describe('validarHorarioConsistente', () => {
    test('debe devolver true si la hora de fin es posterior a la de inicio', () => {
      expect(validarHorarioConsistente('08:00', '09:00')).toBe(true);
      expect(validarHorarioConsistente('09:00', '18:00')).toBe(true);
      expect(validarHorarioConsistente('23:00', '23:59')).toBe(true);
    });

    test('debe devolver false si la hora de fin es igual o anterior a la de inicio', () => {
      expect(validarHorarioConsistente('09:00', '09:00')).toBe(false);
      expect(validarHorarioConsistente('10:00', '09:00')).toBe(false);
      expect(validarHorarioConsistente('23:59', '00:00')).toBe(false);
    });
  });

  // Tests para esFechaValida
  describe('esFechaValida', () => {
    // Fecha fija para las pruebas: 2024-03-20 a las 00:00:00.000
    const fechaFija = new Date(2024, 2, 20);
    fechaFija.setHours(0, 0, 0, 0); // Asegurarnos de que es exactamente a medianoche

    test('debe devolver true para fecha actual', () => {
      // Usamos la misma fecha en formato YYYY-MM-DD para que sean idénticas
      const fechaHoy = '2024-03-20';
      expect(esFechaValida(fechaHoy, fechaFija)).toBe(true);
    });

    test('debe devolver true para fechas futuras', () => {
      expect(esFechaValida('2024-03-21', fechaFija)).toBe(true);
      expect(esFechaValida('2025-03-20', fechaFija)).toBe(true);
    });

    test('debe devolver false para fechas pasadas', () => {
      expect(esFechaValida('2024-03-19', fechaFija)).toBe(false);
      expect(esFechaValida('2023-03-20', fechaFija)).toBe(false);
    });
  });

  // Tests para hayConflictoHorario
  describe('hayConflictoHorario', () => {
    const horariosOcupados: HorarioOcupado[] = [
      { hora_inicio: '09:00', hora_fin: '10:30' },
      { hora_inicio: '12:00', hora_fin: '13:00' },
      { hora_inicio: '15:00', hora_fin: '17:00' }
    ];

    test('debe devolver conflicto: true si el horario en sí no es consistente', () => {
      const resultado = hayConflictoHorario('10:00', '09:00', horariosOcupados);
      expect(resultado.conflicto).toBe(true);
      expect(resultado.horarioConflicto).toBeUndefined();
    });

    test('debe detectar conflicto si el inicio está dentro de un horario ocupado', () => {
      const resultado = hayConflictoHorario('09:30', '11:00', horariosOcupados);
      expect(resultado.conflicto).toBe(true);
      expect(resultado.horarioConflicto).toBe('09:00 - 10:30');
    });

    test('debe detectar conflicto si el fin está dentro de un horario ocupado', () => {
      const resultado = hayConflictoHorario('11:30', '12:30', horariosOcupados);
      expect(resultado.conflicto).toBe(true);
      expect(resultado.horarioConflicto).toBe('12:00 - 13:00');
    });

    test('debe detectar conflicto si el horario contiene completamente un horario ocupado', () => {
      const resultado = hayConflictoHorario('11:30', '14:00', horariosOcupados);
      expect(resultado.conflicto).toBe(true);
      expect(resultado.horarioConflicto).toBe('12:00 - 13:00');
    });

    test('debe detectar conflicto si el horario es exactamente igual a un horario ocupado', () => {
      const resultado = hayConflictoHorario('12:00', '13:00', horariosOcupados);
      expect(resultado.conflicto).toBe(true);
      expect(resultado.horarioConflicto).toBe('12:00 - 13:00');
    });

    test('no debe detectar conflicto para horarios disponibles', () => {
      const resultados = [
        hayConflictoHorario('08:00', '09:00', horariosOcupados),
        hayConflictoHorario('10:30', '12:00', horariosOcupados),
        hayConflictoHorario('13:00', '15:00', horariosOcupados),
        hayConflictoHorario('17:00', '18:00', horariosOcupados)
      ];
      
      resultados.forEach(resultado => {
        expect(resultado.conflicto).toBe(false);
        expect(resultado.horarioConflicto).toBeUndefined();
      });
    });
  });

  // Tests para validarReserva
  describe('validarReserva', () => {
    const horariosOcupados: HorarioOcupado[] = [
      { hora_inicio: '09:00', hora_fin: '10:30' },
      { hora_inicio: '12:00', hora_fin: '13:00' },
      { hora_inicio: '15:00', hora_fin: '17:00' }
    ];

    // Fecha fija para las pruebas: 2024-03-20
    const fechaFija = new Date(2024, 2, 20);

    test('debe validar correctamente una reserva válida', () => {
      const resultado = validarReserva('2024-03-21', '08:00', '09:00', horariosOcupados, fechaFija);
      expect(resultado.esValida).toBe(true);
      expect(resultado.mensaje).toBeUndefined();
      expect(resultado.tipo).toBeUndefined();
    });

    test('debe rechazar una reserva con fecha pasada', () => {
      const resultado = validarReserva('2024-03-19', '08:00', '09:00', horariosOcupados, fechaFija);
      expect(resultado.esValida).toBe(false);
      expect(resultado.mensaje).toContain('No se pueden realizar reservas en fechas pasadas');
      expect(resultado.tipo).toBe('fecha_pasada');
    });

    test('debe rechazar una reserva con horario inconsistente', () => {
      const resultado = validarReserva('2024-03-21', '10:00', '09:00', horariosOcupados, fechaFija);
      expect(resultado.esValida).toBe(false);
      expect(resultado.mensaje).toContain('La hora de fin debe ser posterior a la hora de inicio');
      expect(resultado.tipo).toBe('horario_inconsistente');
    });

    test('debe rechazar una reserva con conflicto de horario', () => {
      const resultado = validarReserva('2024-03-21', '11:30', '12:30', horariosOcupados, fechaFija);
      expect(resultado.esValida).toBe(false);
      expect(resultado.mensaje).toContain('se superpone con una reserva existente');
      expect(resultado.tipo).toBe('conflicto_horario');
    });
  });
}); 