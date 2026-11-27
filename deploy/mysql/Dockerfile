# MySQL de Lumina para Render (servicio privado con disco en /var/lib/mysql).
# Los scripts de initdb solo corren con el disco vacío.
FROM mysql:8.4.13

COPY deploy/mysql/lumina.cnf /etc/mysql/conf.d/lumina.cnf

COPY backend/database/schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY backend/database/triggers.sql /docker-entrypoint-initdb.d/02-triggers.sql
COPY backend/database/vistas_y_disparadores_clase.sql /docker-entrypoint-initdb.d/03-vistas-disparadores-clase.sql
COPY --chmod=0755 deploy/mysql/04-usuario-app.sh /docker-entrypoint-initdb.d/04-usuario-app.sh
