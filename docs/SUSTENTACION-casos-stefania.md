# Guion de sustentación — Stefanía Díaz (Casos + Builder)

## 1. Mi responsabilidad

Módulo de **casos académicos y rúbricas** (RF-05 a RF-09 y parte de RF-17): creación, escenarios, preguntas, opciones, explicaciones, validación, publicación y asociación de rúbricas. Patrón principal: **Builder**.

## 2. ¿Qué es Builder y qué problema resuelve en Lumina?

Builder construye un objeto complejo **por pasos**. En Lumina un caso no es un solo registro: incluye personajes, escenas, preguntas, opciones, explicaciones y rúbrica. Si todo eso se armara en un único método del servicio, se mezclarían construcción, validación y persistencia (más difícil de probar y de explicar).

## 3. ¿Qué construye exactamente?

El **agregado Caso** validado (estructura en memoria). **No** escribe en MySQL. Quien persiste es el servicio (`construir` → `guardarCasoCompleto` del repositorio).

Archivo a abrir: `backend/src/modules/casos/caso.builder.js`

## 4. Pasos de la construcción

1. `conCreador` / `conTitulo` / contexto / tiempo  
2. `agregarPersonaje`  
3. `agregarEscena` (con preguntas y opciones anidadas si vienen en el payload)  
4. `conRubrica`  
5. `build()` → `validarCaso(...)`

También existe `construirCaso(datos)` como fachada que usa el Builder internamente.

## 5. Builder vs servicio vs validación vs publicar

| Acción | Quién | Qué hace |
|---|---|---|
| Construir | Builder | Ensambla el objeto |
| Validar estructura | `caso.validacion.js` | Datos, órdenes, personajes, rúbrica |
| Orquestar | `casos.service.js` | Docente activo, borrador, **propietario/admin**, transacciones |
| Publicar | `publicar` + `validarParaPublicar` | Exige escenas, preguntas, ≥2 opciones, opción esperada, explicaciones, rúbrica |
| Persistir | `casos.repository.js` | SQL MySQL parametrizado |

## 6. Demo en vivo (orden sugerido)

1. Abrir `caso.builder.js` y explicar los pasos.  
2. Abrir `casos.service.js` → método `construir` y `publicar`.  
3. Ejecutar: `npm run test:unit` (debe pasar).  
4. Señalar tests:  
   - «CasoBuilder arma el caso…»  
   - «no publica un borrador incompleto»  
   - «un docente no puede publicar el caso de otra compañera»

## 7. Preguntas frecuentes

**¿Por qué no construir todo en el servicio?**  
Porque el servicio ya tiene reglas de aplicación (estados, permisos, transacciones). Builder aísla el armado del agregado.

**¿Qué pasa si publico incompleto?**  
`validarParaPublicar` lanza 422 con la lista de errores; no cambia el estado.

**¿Cómo se relaciona con SOLID?**  
Responsabilidades separadas (construcción, validación, casos de uso, persistencia). Evita una God Class única.

**¿Qué antipatrón corregiste?**  
La gestión de casos ajenos: ahora solo el creador o un administrador pueden modificar/publicar/archivar.

**¿Se puede editar el contenido después de crearlo?**  
Sí, en borrador propio: `PATCH` de escenas, preguntas y opciones (con explicación). Los publicados no se editan.
