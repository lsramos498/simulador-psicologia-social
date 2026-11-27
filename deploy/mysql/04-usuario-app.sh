#!/bin/bash
# Usuario de la API: solo lectura y escritura de datos en proyecto_nuclear.
set -euo pipefail

: "${LUMINA_APP_PASSWORD:?Falta la variable LUMINA_APP_PASSWORD}"

MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" mysql --protocol=socket -uroot <<SQL
CREATE USER IF NOT EXISTS 'lumina_app'@'%' IDENTIFIED BY '${LUMINA_APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON proyecto_nuclear.* TO 'lumina_app'@'%';
FLUSH PRIVILEGES;
SQL

echo "Usuario lumina_app creado con permisos de datos sobre proyecto_nuclear."
