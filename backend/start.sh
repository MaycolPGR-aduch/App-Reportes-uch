#!/usr/bin/env bash
# Arranque en Render: migraciones, luego los tres trabajadores, luego la API.
#
# Va en un script y no en una sola línea del render.yaml porque el encadenado
# `alembic ... && worker & ... & exec uvicorn` manda toda la cadena al fondo:
# uvicorn arrancaría sin esperar a que la migración termine, y el primer
# request encontraría un esquema a medio migrar.
set -euo pipefail

# Si la migración falla, el servicio no arranca. Es deliberado: servir con un
# esquema desfasado da errores intermitentes mucho más difíciles de diagnosticar
# que un despliegue que se niega a subir.
alembic upgrade head

python -m app.workers.ai_worker &
python -m app.workers.notification_worker &
python -m app.workers.maintenance_worker &

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
