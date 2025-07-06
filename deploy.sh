#!/bin/bash

# =====================================================
# Script de Despliegue - Reserva Salas
# =====================================================

set -e  # Exit on any error

# Configuration
REMOTE_HOST="192.168.18.83"
REMOTE_USER="spsicologia"
REMOTE_PATH="/home/spsicologia"
PROJECT_DIR="reserva-salas"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="reserva-salas-backup-${TIMESTAMP}"
DEPLOY_PACKAGE="reserva-salas-deploy-${TIMESTAMP}.tar.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando proceso de despliegue...${NC}"
echo -e "${BLUE}Timestamp: ${TIMESTAMP}${NC}"

# Function to print colored messages
print_step() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Verify we're in the correct directory
print_step "Verificando directorio del proyecto..."
if [ ! -f "package.json" ] || [ ! -d "app" ]; then
    print_error "No estás en el directorio raíz del proyecto"
    exit 1
fi

# Step 2: Build the project locally
print_step "Construyendo el proyecto..."
npm run build

# Step 3: Create deployment package
print_step "Creando paquete de despliegue..."
tar --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='*.tar.gz' \
    --exclude='.DS_Store' \
    --exclude='deploy.sh' \
    -czf "${DEPLOY_PACKAGE}" . 

echo -e "${BLUE}📦 Paquete creado: ${DEPLOY_PACKAGE}${NC}"
echo -e "${BLUE}📏 Tamaño: $(du -h ${DEPLOY_PACKAGE} | cut -f1)${NC}"

# Step 4: Verify SSH connection
print_step "Verificando conexión SSH..."
ssh -o ConnectTimeout=10 "${REMOTE_USER}@${REMOTE_HOST}" "echo 'Conexión SSH exitosa'" || {
    print_error "No se pudo conectar al servidor"
    exit 1
}

# Step 5: Create backup of current version
print_step "Creando backup de la versión actual..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH} &&
    if [ -d '${PROJECT_DIR}' ]; then
        echo '🔄 Respaldando versión actual...'
        cp -r ${PROJECT_DIR} ${BACKUP_NAME}
        echo '✅ Backup creado: ${BACKUP_NAME}'
    else
        echo '⚠️  No se encontró directorio existente para respaldar'
    fi
"

# Step 6: Stop current application (if running)
print_step "Deteniendo aplicación actual..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH} &&
    source ~/.nvm/nvm.sh &&
    if command -v pm2 >/dev/null 2>&1; then
        pm2 stop reserva-salas 2>/dev/null || echo 'PM2 process not running'
        pm2 delete reserva-salas 2>/dev/null || echo 'PM2 process not found'
    fi
    
    # Kill any node processes
    pkill -f 'next' 2>/dev/null || echo 'No next processes found'
    echo '🛑 Aplicación detenida'
"

# Step 7: Upload new version
print_step "Subiendo nueva versión..."
scp "${DEPLOY_PACKAGE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

# Step 8: Extract and setup new version
print_step "Extrayendo y configurando nueva versión..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH} &&
    
    # Remove old project directory
    rm -rf ${PROJECT_DIR}
    
    # Create new project directory
    mkdir -p ${PROJECT_DIR}
    
    # Extract new version
    tar -xzf ${DEPLOY_PACKAGE} -C ${PROJECT_DIR}
    
    echo '📁 Nueva versión extraída'
"

# Step 9: Install dependencies and build
print_step "Instalando dependencias y construyendo aplicación..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH}/${PROJECT_DIR} &&
    source ~/.nvm/nvm.sh &&
    
    echo '📦 Instalando dependencias...'
    npm install --production
    
    echo '🏗️  Construyendo aplicación...'
    npm run build
    
    echo '✅ Construcción completada'
"

# Step 10: Start application
print_step "Iniciando aplicación..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH}/${PROJECT_DIR} &&
    source ~/.nvm/nvm.sh &&
    
    # Install PM2 if not exists
    if ! command -v pm2 >/dev/null 2>&1; then
        echo '📦 Instalando PM2...'
        npm install -g pm2
    fi
    
    # Start application with PM2
    pm2 start npm --name 'reserva-salas' -- start
    pm2 save
    
    echo '🚀 Aplicación iniciada con PM2'
    
    # Show PM2 status
    pm2 list
"

# Step 11: Cleanup
print_step "Limpiando archivos temporales..."
rm "${DEPLOY_PACKAGE}"
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH} &&
    rm -f ${DEPLOY_PACKAGE}
    echo '🧹 Archivos temporales eliminados'
"

# Step 12: Verify deployment
print_step "Verificando despliegue..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH}/${PROJECT_DIR} &&
    source ~/.nvm/nvm.sh &&
    
    echo '🔍 Estado de PM2:'
    pm2 list
    
    echo '📋 Logs recientes:'
    pm2 logs reserva-salas --lines 5 --nostream
    
    echo '🌐 Verificando si la aplicación responde...'
    sleep 3
    curl -s http://localhost:3000 > /dev/null && echo '✅ Aplicación respondiendo correctamente' || echo '⚠️  Aplicación no responde (puede necesitar más tiempo)'
"

echo ""
echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo -e "${BLUE}📝 Información del despliegue:${NC}"
echo -e "   • Timestamp: ${TIMESTAMP}"
echo -e "   • Backup creado: ${BACKUP_NAME}"
echo -e "   • Servidor: ${REMOTE_HOST}"
echo ""
echo -e "${YELLOW}📋 Próximos pasos:${NC}"
echo -e "   1. Verificar que la aplicación funciona correctamente"
echo -e "   2. Monitorear logs: ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${PROJECT_DIR} && pm2 logs'"
echo -e "   3. En caso de problemas, restaurar backup: ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH} && rm -rf ${PROJECT_DIR} && mv ${BACKUP_NAME} ${PROJECT_DIR}'"
echo "" 