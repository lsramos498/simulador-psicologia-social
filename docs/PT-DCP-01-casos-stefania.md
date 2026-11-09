# PT-DCP-01 — Aporte Stefanía Díaz (módulo Casos)

Plantilla de consolidación para el plan de pruebas del segundo corte.  
**Solo se registran resultados de pruebas realmente ejecutadas el 8 de noviembre de 2026.**

Comando ejecutado:

```bash
cd backend
npm run test:unit
node --test tests/casos.routes.test.js
```

Resultado global: **56** pruebas unitarias del módulo (suite `test:unit`) + **7** de rutas → **todas aprobadas**, 0 fallidas.

---

## Casos de prueba (módulo Casos)

| ID | Requisito | Módulo | Objetivo | Precondiciones | Pasos | Datos de entrada | Resultado esperado | Resultado obtenido | Veredicto | Evidencias | Defectos / observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CP-CASOS-01 | RF-05 | Casos | Construir caso válido con Builder | Código en rama de trabajo | Ejecutar `caso.builder.test.js` | Caso con título, escena, opción, rúbrica | Estructura validada sin error | Estructura validada | **Aprobado** | `npm run test:unit` | — |
| CP-CASOS-02 | RF-05 | Casos | Rechazar caso incompleto | Idem | `construirCaso` sin desarrollo situacional | Título sin desarrollo | Error `ESTRUCTURA_INVALIDA` | Error 422 de estructura | **Aprobado** | `casos.unitarias.test.js` | — |
| CP-CASOS-03 | RF-06 | Casos | Validar escenas y orden de preguntas | Idem | `normalizarEscena` con dos preguntas orden 1 | Órdenes repetidos | Rechazo por mismo orden | Rechazo por mismo orden | **Aprobado** | unitarias | — |
| CP-CASOS-04 | RF-07 | Casos | Validar opciones y marca esperada | Idem | `normalizarOpcion` / `validarParaPublicar` | Opción sin `esCorrecta` booleano; pregunta sin opción esperada | Rechazo | Rechazo | **Aprobado** | unitarias | — |
| CP-CASOS-05 | RF-08 | Casos | Exigir explicación por opción al publicar | Idem | `validarParaPublicar` | Opción sin explicación | Error listando explicación faltante | Error listado | **Aprobado** | unitarias / validacion | — |
| CP-CASOS-06 | RF-09 | Casos | Publicar borrador completo | Mock repositorio | `servicio.publicar` | Caso publicable del creador | Estado `Publicado` | Estado `Publicado` | **Aprobado** | unitarias | — |
| CP-CASOS-07 | RF-09 | Casos | Rechazar publicación incompleta | Mock | `servicio.publicar` | Sin escenas/rúbrica | 422 con errores | 422 con errores | **Aprobado** | service + unitarias | — |
| CP-CASOS-08 | RF-09 | Casos | No editar caso publicado | Mock | `agregarEscena` / `actualizar` | Estado `Publicado` | 409 `CASO_NO_EDITABLE` | 409 | **Aprobado** | unitarias | — |
| CP-CASOS-09 | RF-17 | Casos | Rúbrica con ponderaciones = 100 | Idem | `normalizarRubrica` | Suma 90 | Error de ponderación | Error de ponderación | **Aprobado** | validacion/unitarias | — |
| CP-CASOS-10 | RF-05/RF-02 | Casos | Docente ajeno no publica | Mock creadorId distinto | `publicar` con otro docente | creadorId 9, actor 5 | 403 `CASO_AJENO` | 403 `CASO_AJENO` | **Aprobado** | unitarias + routes | Corrección de seguridad 2026-11-08 |
| CP-CASOS-11 | RF-02 | Casos | Rutas exigen permiso `CREAR_CASOS` | App de prueba | `POST /api/casos` sin permiso | Token sin permiso | 403 | 403 | **Aprobado** | `casos.routes.test.js` | — |
| CP-CASOS-12 | RF-07/RF-08 | Casos | Estudiante no ve claves | App de prueba | `GET /api/casos/:id` | Rol Estudiante | Sin `esCorrecta` ni explicación | Campos ocultos | **Aprobado** | routes | — |

## Pendiente de consolidar (otras integrantes)

Laura, Sofía y Valeria deben enviar a Stefanía sus filas con el mismo formato. **No inventar veredictos** de módulos ajenos.

## Evidencia de ejecución

- Fecha: 2026-11-08  
- Entorno: Node.js v26, `node --test`  
- Rama: `feature/stefania-casos-mejoras`
