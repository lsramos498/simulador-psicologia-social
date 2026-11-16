# Revisión de antipatrones — módulo de casos

Responsable: Stefanía Díaz  
Fecha de revisión: 8 de noviembre de 2026  
Alcance: `backend/src/modules/casos/` y `backend/src/routes/casos.routes.js`

## Método

Se revisó el código buscando God Class, código espagueti, duplicación, números mágicos, hard coding, métodos con demasiadas responsabilidades, dependencias innecesarias y código muerto.

## Hallazgos

| ID | Antipatrón | Evidencia | Riesgo | Estado / corrección |
|---|---|---|---|---|
| AP-CASOS-01 | **Falta de control de propiedad** (regla de acceso incompleta) | Cualquier docente con `CREAR_CASOS` podía editar/publicar casos ajenos | Integridad y seguridad académica | **Corregido** en `casos.service.js` (`exigirPropietarioOAdmin`) + pruebas `CASO_AJENO` |
| AP-CASOS-02 | **Números mágicos / literales de estado** | Strings `'Borrador'`, `'Publicado'`, `'Archivado'` repetidos | Inconsistencias al cambiar el esquema | Mitigado con `ESTADOS_CASO` en validación y reexportación en `caso.model.js` |
| AP-CASOS-03 | **Posible God Class en repositorio** | `casos.repository.js` concentra muchas consultas del agregado | Mantenibilidad a largo plazo | **Aceptado con justificación**: el repositorio es el límite de persistencia del agregado Caso; separar por tabla rompería transacciones. Se mantiene `consultas(conexion)` interno |
| AP-CASOS-04 | **Duplicación de helpers de lectura** | `leerTexto` / `leerEntero` solo en validación | Bajo | No es duplicación activa entre módulos; se deja local al módulo |
| AP-CASOS-05 | **Hard coding de mensajes** | Mensajes en español fijos en errores | Bajo para el alcance académico | Aceptado: facilita pruebas y sustentación |
| AP-CASOS-06 | **Código sin uso aparente** | `caso.model.js` antes solo reexportaba estados | Confusión | **Mejorado**: documenta el dominio y exporta conjuntos de estados editables |

## Antipatrones no encontrados en el módulo

- **Código espagueti:** el flujo HTTP → servicio → repositorio está separado.
- **Dependencias innecesarias:** el servicio depende de acceso solo para roles (`autorizacion.js`), no del middleware HTTP.
- **Credenciales en el repositorio:** no hay secretos en el módulo de casos.
- **God Class en el servicio:** los casos de uso están repartidos en métodos; la validación pesada vive en `caso.validacion.js`.

## Conclusión

El módulo no presenta antipatrones bloqueantes para la entrega. El hallazgo crítico (gestión de casos ajenos) quedó corregido y cubierto por pruebas automatizadas.
