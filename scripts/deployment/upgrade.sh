#!/bin/bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Iniciando atualização dos serviços ChatbotX..."

# 1. Build / Pull dos serviços de aplicação
echo "📦 Construindo / obtendo imagens atualizadas..."
docker compose -f "$COMPOSE_FILE" build builder worker realtime javascript-executor whatsmeow-bridge

# 2. Executa migrações de banco pendentes de forma segura
echo "🔄 Aplicando migrações de banco de dados..."
docker compose -f "$COMPOSE_FILE" run --rm builder migrate

# 3. Atualiza os serviços sem parar os bancos (postgres, redis, filesystem)
echo "🚀 Reiniciando serviços de aplicação com zero-downtime..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps builder worker realtime javascript-executor whatsmeow-bridge

# 4. Limpa imagens dangling antigas
echo "🧹 Limpando imagens órfãs..."
docker image prune -f

echo "✅ Atualização concluída com sucesso!"

