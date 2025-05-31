#!/bin/bash

# Script de despliegue para la aplicación de reserva de salas
# Uso: ./deploy.sh usuario@servidor

# Verificar si se proporcionó un argumento
if [ $# -eq 0 ]; then
    echo "Uso: ./deploy.sh usuario@servidor"
    exit 1
fi

SERVER=$1
APP_DIR="~/reserva-salas"

echo "Compilando la aplicación localmente..."
npm run build -- --no-lint

echo "Creando archivo comprimido para transferir..."
tar -czvf reserva-salas-deploy.tar.gz --exclude=node_modules --exclude=.git .next package.json package-lock.json public .env.local

echo "Transfiriendo archivos al servidor..."
scp reserva-salas-deploy.tar.gz $SERVER:$APP_DIR/

echo "Desplegando en el servidor..."
ssh $SERVER "cd $APP_DIR && \
    tar -xzvf reserva-salas-deploy.tar.gz && \
    rm reserva-salas-deploy.tar.gz && \
    source ~/.nvm/nvm.sh && \
    npm ci --production && \
    pm2 stop reserva-salas || true && \
    pm2 start npm --name 'reserva-salas' -- start && \
    pm2 save"

echo "Limpiando archivos temporales..."
rm reserva-salas-deploy.tar.gz

echo "Despliegue completado. La aplicación está disponible en http://servidor:3000" 