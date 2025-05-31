// Importar las extensiones de testing-library para Jest
import '@testing-library/jest-dom'

// Configuración global para manejar la coincidencia de media queries en tests
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  }
}

// Mock para fetch
global.fetch = jest.fn()

// Mock para ResizeObserver (usado por algunos componentes de UI)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Prevenir errores de consola durante los tests
beforeAll(() => {
  // Silenciar los warnings de la consola
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  // Restaurar los mocks después de los tests
  jest.restoreAllMocks()
}) 