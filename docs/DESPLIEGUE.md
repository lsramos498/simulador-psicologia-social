# Despliegue en Render

El despliegue se define en `render.yaml` (Blueprint de Render) y se valida con `.github/workflows/ci.yml`.
Render despliega la API y el frontend cuando el CI pasa en `develop`.

## Servicios

| Servicio | Tipo | Plan | Contenido |
|---|---|---|---|
| lumina-mysql | Servicio privado + disco 1 GB | Starter | MySQL 8.4 (`deploy/mysql/`) |
| lumina-api | Web service | Free | Backend (`backend/`) |
| lumina-web | Static site | Gratis | Frontend (`frontend/`) |

- Render no tiene MySQL administrado; se despliega como servicio privado con disco
  ([guía de Render](https://render.com/docs/deploy-mysql)).
- Los tres servicios están en la región `virginia`.
- El frontend llama a `/api/...` y Render lo reenvía a `lumina-api`.

## Base de datos

Con el disco vacío, la imagen ejecuta en orden `schema.sql`, `triggers.sql`, `vistas_y_disparadores_clase.sql`
y `deploy/mysql/04-usuario-app.sh`, que crea el usuario `lumina_app` con permisos SELECT, INSERT, UPDATE y DELETE.

Esos scripts no vuelven a correr en una base existente. Los cambios de esquema posteriores se aplican con
scripts de migración (ver `backend/database/migrations/`) desde el Shell de `lumina-mysql`.

## Primer despliegue

1. En Render: **New → Blueprint**, repositorio del proyecto, rama `develop`.
2. Completar las variables que pide Render:

   | Variable | Valor |
   |---|---|
   | `ADMIN_CORREO`, `ADMIN_NOMBRES`, `ADMIN_APELLIDOS` | Administrador inicial |
   | `ADMIN_CONTRASENA` | Mínimo 8 caracteres, con letras y números |
   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Cuenta del relay de correo (ver Correo) |

   Las contraseñas de MySQL, `JWT_SECRETO` y `CODIGO_AUTORIZACION_SECRETO` las genera Render.
3. Aplicar. MySQL tarda unos minutos la primera vez. Si la API arrancó antes que la base, reiniciarla
   (Manual Deploy → Restart) para que el seed cree el administrador.
4. Si Render asignó otros subdominios, actualizar en `render.yaml` la variable `URL_ACCESO` de `lumina-api`
   y el destino de la regla `/api/*` de `lumina-web`.
5. Entrar como administrador y en **Admin → Roles y permisos** activar `CREAR_CASOS` en el rol Docente.
6. Opcional: quitar `ADMIN_CONTRASENA` de `lumina-api`. El seed se omite y la API arranca normal.

## Despliegues siguientes

- Cada push a `develop` corre el CI. Si todo pasa, Render despliega `lumina-api` y `lumina-web`.
- `lumina-mysql` se despliega a mano desde el Dashboard cuando cambie `deploy/mysql/`.
- Para volver a una versión anterior: Events → Rollback en el servicio.

## CI

| Job | Qué hace |
|---|---|
| Backend (pruebas unitarias) | `npm ci`, `npm test`, `npm audit` (dependencias de producción) |
| Backend (integración con MySQL real) | MySQL 8.4 con `schema.test.sql` y `npm run test:mysql` |
| Imagen de MySQL de producción | Construye `deploy/mysql/Dockerfile` y verifica tablas, disparadores, zona horaria y permisos |
| Frontend (lint y build) | `npm ci`, `npm run lint`, `npm run build`, `npm audit` |
| Búsqueda de secretos (gitleaks) | Revisa los commits nuevos |
| Validación de los workflows (actionlint) | Revisa la sintaxis de los workflows |

Dependabot (`.github/dependabot.yml`) abre actualizaciones semanales contra `develop`.

## Correo

El plan Free bloquea los puertos 465 y 587, así que Gmail no funciona desde `lumina-api`. Se usa un relay
que acepte el puerto 2525 (Brevo, SendGrid o Mailgun), o se pasa la API a un plan de pago y se cambia
`SMTP_PORT` a 587.

Sin correo configurado no se envían mensajes: el docente ve los códigos al crear la actividad y los entrega.

## Variables opcionales

`OPENAI_API_KEY` habilita la creación de casos con asistente. Se agrega en `lumina-api` → Environment.

## Plan Free

- La API se suspende tras 15 minutos sin uso y tarda cerca de un minuto en volver.
- El límite de intentos de ingreso se reinicia cuando la API se suspende o se redespliega.

## Respaldos

Render no recomienda restaurar una base desde las instantáneas del disco. Usar `mysqldump` desde el Shell de `lumina-mysql`:

```bash
mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers proyecto_nuclear > /var/lib/mysql/respaldo-$(date +%F).sql
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" proyecto_nuclear < /var/lib/mysql/respaldo-AAAA-MM-DD.sql
```

Guardar una copia de los respaldos fuera de Render.

## Verificación

1. `https://lumina-api-zh5t.onrender.com/api/health` responde `{"status":"ok",...}`.
2. `https://lumina-web-zh5t.onrender.com` carga y el administrador puede entrar.
3. Un docente crea, publica y programa un caso, y un estudiante convocado entra con su código.
4. En Seguimiento se ve la participación y se descarga el reporte CSV.
