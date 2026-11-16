# Casos de prueba que completan el plan

Continuación de `Plan_y_Casos_LUMINA_comprimido.pdf`, escrita con los campos de la plantilla PT-DCP-01. Las páginas anteriores quedan igual. Estos casos no se ejecutaron.

En cada caso:

- Versión de ejecución: 1.0.0
- Fecha de ejecución: No ejecutado
- Coincide: N/A
- Respuesta del sistema: No ejecutado
- Capturas: no aplica
- Defectos y desviaciones: N/A
- Veredicto: No Ejecutado
- Observaciones: N/A
- Probador: N/A

## CP-27. El administrador crea un docente

- Caso de uso: Crear docentes y asignarles el rol Docente (RF-03).
- Módulo: Acceso y administración.
- Descripción: Verificar que el administrador registra un docente y que ese docente puede ingresar con el correo y la contraseña creados.
- Precondiciones: El administrador ya ingresó. El correo del nuevo docente no existe.
- Pasos:
  1. Campo nombres, apellidos, correo y contraseña. Valor: datos institucionales de un docente nuevo. Respuesta esperada: el docente queda creado con el rol Docente y la contraseña no se muestra. Tipo de escenario: Positivo.
  2. Campo correo y contraseña. Valor: los datos registrados en el paso anterior. Respuesta esperada: el docente obtiene sesión. Tipo de escenario: Positivo.
- Postcondiciones: Queda un docente activo con el rol Docente.

## CP-28. El estudiante no entra con contraseña

- Caso de uso: Un estudiante no puede entrar por el ingreso con contraseña.
- Módulo: Acceso.
- Descripción: Verificar que el estudiante no obtiene sesión cuando usa el ingreso previsto para docentes y administradores.
- Precondiciones: El estudiante existe y está activo. Su ingreso previsto es correo más código.
- Pasos:
  1. Campo correo y contraseña. Valor: correo del estudiante y una contraseña, en el ingreso de docentes. Respuesta esperada: no obtiene sesión y el sistema no lo trata como docente ni como administrador. Tipo de escenario: Negativo.
- Postcondiciones: El estudiante sigue sin una sesión de docente o de administrador.

## CP-29. Bloqueo tras varios intentos fallidos

- Caso de uso: El sistema bloquea el ingreso tras varios intentos fallidos.
- Módulo: Acceso.
- Descripción: Verificar que, al superar los intentos fallidos, ni la contraseña correcta ni el código correcto permiten ingresar mientras el bloqueo siga vigente.
- Precondiciones: El correo está libre de bloqueo.
- Pasos:
  1. Campo contraseña. Valor: varias contraseñas incorrectas para el mismo correo. Respuesta esperada: el sistema acumula los intentos fallidos de ese correo. Tipo de escenario: Negativo.
  2. Campo contraseña. Valor: la contraseña correcta, después de superar el límite. Respuesta esperada: no obtiene sesión mientras el bloqueo siga vigente. Tipo de escenario: Negativo.
  3. Campo código de acceso. Valor: varios códigos incorrectos y después el código válido. Respuesta esperada: el código correcto tampoco sirve mientras el bloqueo siga vigente. Tipo de escenario: Negativo.
- Postcondiciones: El correo permanece bloqueado hasta que venza el tiempo de bloqueo.

## CP-30. El docente edita una escena del borrador

- Caso de uso: Agregar y editar escenas del borrador (RF-06). Agregar una escena ya está en CP-13.
- Módulo: Casos.
- Descripción: Verificar que el docente creador cambia el nombre y el contexto de una escena, y que el cambio se rechaza si el caso ya no está en borrador.
- Precondiciones: El caso está en Borrador, ya tiene una escena y el docente es su creador.
- Pasos:
  1. Campo nombre y contexto de la escena. Valor: textos nuevos. Respuesta esperada: la escena queda con el nombre y el contexto nuevos. Tipo de escenario: Positivo.
  2. Campo nombre y contexto de la escena. Valor: un cambio cuando el caso está Publicado o Archivado. Respuesta esperada: el cambio se rechaza. Tipo de escenario: Negativo.
- Postcondiciones: En el borrador, la escena conserva el nombre y el contexto nuevos.

## CP-31. El docente edita una pregunta del borrador

- Caso de uso: Agregar y editar preguntas (RF-07). Agregar una pregunta ya está en CP-14.
- Módulo: Casos.
- Descripción: Verificar que el docente creador cambia el texto de una pregunta del borrador y que no puede modificar una pregunta de otro caso.
- Precondiciones: El caso está en Borrador y la escena ya tiene una pregunta.
- Pasos:
  1. Campo texto de la pregunta. Valor: un enunciado nuevo. Respuesta esperada: la pregunta queda actualizada. Tipo de escenario: Positivo.
  2. Campo identificador de la pregunta. Valor: una pregunta que pertenece a otro caso. Respuesta esperada: no se puede modificar desde este caso. Tipo de escenario: Negativo.
- Postcondiciones: La pregunta del borrador conserva el enunciado nuevo.

## CP-32. El docente crea un personaje y lo asocia a la escena

- Caso de uso: Crear personajes y asociarlos a una escena.
- Módulo: Casos.
- Descripción: Verificar que el personaje queda en una escena de su caso y que se rechaza un personaje de otro caso.
- Precondiciones: El caso está en Borrador y ya tiene una escena. El docente es el creador.
- Pasos:
  1. Campo nombre y rol social. Valor: datos de un personaje nuevo. Respuesta esperada: el personaje queda creado. Tipo de escenario: Positivo.
  2. Campo escena. Valor: la escena del mismo caso. Respuesta esperada: el personaje queda asociado a esa escena. Tipo de escenario: Positivo.
  3. Campo personaje. Valor: un personaje que pertenece a otro caso. Respuesta esperada: la asociación se rechaza. Tipo de escenario: Negativo.
- Postcondiciones: La escena muestra el personaje de su propio caso.

## CP-33. La actividad exige espacio, rúbrica y estudiantes

- Caso de uso: Programar una actividad exige espacio académico, rúbrica del caso y al menos un estudiante. Programar sobre un caso publicado ya está en CP-01.
- Módulo: Actividades.
- Descripción: Verificar que los tres datos son obligatorios y que, cuando están completos, la actividad queda Programada.
- Precondiciones: Hay un caso publicado con rúbrica, un espacio académico y estudiantes registrados.
- Pasos:
  1. Campo espacio académico. Valor: actividad sin espacio. Respuesta esperada: se rechaza y no queda actividad guardada. Tipo de escenario: Negativo.
  2. Campo rúbrica del caso. Valor: actividad sin la rúbrica del caso. Respuesta esperada: se rechaza y no queda actividad guardada. Tipo de escenario: Negativo.
  3. Campo estudiantes. Valor: actividad sin estudiantes. Respuesta esperada: se rechaza y no queda actividad guardada. Tipo de escenario: Negativo.
  4. Campo espacio, rúbrica y estudiantes. Valor: los tres datos completos. Respuesta esperada: la actividad queda Programada. Tipo de escenario: Positivo.
- Postcondiciones: Solo queda guardada la actividad completa, en estado Programada.

## CP-34. La convocatoria llega por correo con el código

- Caso de uso: Al programar, el sistema genera el código y prepara la convocatoria por correo (RF-21).
- Módulo: Actividades.
- Descripción: Verificar que cada estudiante convocado recibe su código y que en la base solo se guarda el hash.
- Precondiciones: Hay un caso publicado, un espacio y al menos un estudiante. Programar la actividad ya está en CP-01.
- Pasos:
  1. Campo estudiante convocado. Valor: el docente programa la actividad e incluye a ese estudiante. Respuesta esperada: se genera un código de acceso para ese estudiante. Tipo de escenario: Positivo.
  2. Campo correo del estudiante. Valor: el mensaje recibido. Respuesta esperada: el correo trae su código y corresponde a la actividad, al lugar y a las fechas. Tipo de escenario: Positivo.
  3. Campo código guardado. Valor: el registro de la convocatoria. Respuesta esperada: en la base solo queda el hash del código, no el código en claro. Tipo de escenario: Positivo.
- Postcondiciones: El estudiante tiene un código asociado a esa actividad y el correo ya fue preparado.

## CP-35. El estudiante pone su sesión En curso

- Caso de uso: La sesión pasa de Sin iniciar a En curso (RF-18). En CP-16 la sesión se preparó directo en la base porque todavía no se podía iniciar.
- Módulo: Sesiones.
- Descripción: Verificar que el estudiante inicia solo la sesión de su actividad.
- Precondiciones: La actividad está Iniciada, la fecha actual está dentro de la ventana y el estudiante ya ingresó con el código de esa actividad. Su sesión está Sin iniciar.
- Pasos:
  1. Campo actividad propia. Valor: el estudiante inicia su sesión. Respuesta esperada: la sesión queda En curso. Tipo de escenario: Positivo.
  2. Campo otra actividad. Valor: intenta iniciar la sesión de otra actividad. Respuesta esperada: la solicitud se rechaza. Tipo de escenario: Negativo.
- Postcondiciones: La sesión propia queda En curso.

## CP-36. El estudiante finaliza su sesión

- Caso de uso: La sesión pasa de En curso a Finalizado (RF-18, RF-19).
- Módulo: Sesiones.
- Descripción: Verificar que el estudiante cierra su sesión y que después ya no puede registrar ni cambiar respuestas. Completa lo que CP-19 muestra solo con la sesión ya cerrada.
- Precondiciones: La sesión de ese estudiante está En curso.
- Pasos:
  1. Campo cierre de la sesión. Valor: el estudiante finaliza su sesión. Respuesta esperada: la sesión queda Finalizado, con motivo de finalización del propio estudiante. Tipo de escenario: Positivo.
  2. Campo respuesta. Valor: intenta registrar otra respuesta. Respuesta esperada: ya no puede registrar ni cambiar respuestas. Tipo de escenario: Negativo.
- Postcondiciones: La sesión queda Finalizado por el estudiante.

## CP-37. La sesión se cierra porque se agotó el tiempo

- Caso de uso: La sesión puede cerrarse por tiempo (RF-19).
- Módulo: Sesiones.
- Descripción: Verificar que, al cumplirse el tiempo, la sesión queda cerrada y no admite respuestas nuevas.
- Precondiciones: La sesión está En curso y el tiempo límite de la actividad ya se cumplió.
- Pasos:
  1. Campo tiempo de la actividad. Valor: se agota el tiempo sin que el estudiante cierre la sesión. Respuesta esperada: la sesión queda Finalizado por tiempo agotado. Tipo de escenario: Positivo.
  2. Campo respuesta. Valor: el estudiante intenta registrar o cambiar una respuesta. Respuesta esperada: la respuesta nueva se rechaza. Tipo de escenario: Negativo.
- Postcondiciones: La sesión queda Finalizado por tiempo agotado.

## CP-38. El docente cierra la sesión del estudiante

- Caso de uso: La sesión puede cerrarse por el docente (RF-19). Cerrar la actividad completa ya está en CP-03. Este caso es la sesión de un estudiante.
- Módulo: Sesiones.
- Descripción: Verificar que solo el docente responsable cierra la sesión de un estudiante y que, si nunca empezó, la asistencia queda como ausencia.
- Precondiciones: La actividad es de ese docente. El estudiante tiene una sesión Sin iniciar o En curso.
- Pasos:
  1. Campo sesión del estudiante. Valor: el docente responsable la cierra. Respuesta esperada: la sesión queda Finalizado por cierre del docente. Tipo de escenario: Positivo.
  2. Campo sesión del estudiante. Valor: otro docente intenta cerrarla. Respuesta esperada: no puede cerrarla. Tipo de escenario: Negativo.
  3. Campo respuesta. Valor: el estudiante intenta responder después del cierre. Respuesta esperada: ya no puede responder. Si nunca la empezó, la asistencia queda como ausencia. Tipo de escenario: Negativo.
- Postcondiciones: La sesión queda cerrada por el docente responsable.

## CP-39. El estudiante consulta su progreso

- Caso de uso: El sistema calcula el progreso según las preguntas del caso (RF-11).
- Módulo: Participación.
- Descripción: Verificar que el estudiante ve cuánto avanzó, sin la respuesta esperada ni la explicación.
- Precondiciones: La sesión está En curso. El caso tiene varias preguntas y el estudiante ya respondió algunas.
- Pasos:
  1. Campo consulta de progreso. Valor: el estudiante consulta su avance. Respuesta esperada: ve cuántas preguntas hay, cuántas respondió y cuántas faltan. No ve la respuesta esperada ni la explicación. Tipo de escenario: Positivo.
  2. Campo pregunta pendiente. Valor: responde una pregunta que tenía pendiente y vuelve a consultar. Respuesta esperada: las pendientes bajan. Tipo de escenario: Positivo.
- Postcondiciones: El progreso mostrado corresponde a las respuestas registradas.

## CP-40. Al finalizar se califica con la rúbrica

- Caso de uso: Al finalizar, se califica con la rúbrica del caso.
- Módulo: Participación.
- Descripción: Verificar la nota por criterio y que la explicación solo aparece cuando la sesión ya finalizó.
- Precondiciones: La sesión está En curso. El caso tiene rúbrica con ponderaciones que suman 100. Hay respuestas registradas y puede haber preguntas sin responder.
- Pasos:
  1. Campo cierre de la sesión. Valor: el estudiante finaliza la sesión. Respuesta esperada: recibe una nota por criterio, según la ponderación y el puntaje máximo. Cada pregunta sin respuesta cuenta como cero. Tipo de escenario: Positivo.
  2. Campo explicación de las opciones. Valor: consulta el resultado. Respuesta esperada: la explicación queda disponible solo a partir de este momento. Tipo de escenario: Positivo.
- Postcondiciones: La sesión finalizada conserva la calificación calculada con la rúbrica.

## CP-41. Solo el creador o el administrador gestiona el caso

- Caso de uso: Solo el creador o un administrador gestiona el caso. El estudiante sin permiso ya está en CP-08 y CP-09.
- Módulo: Casos.
- Descripción: Verificar que otro docente no modifica el caso y que el administrador sí puede gestionarlo.
- Precondiciones: Un docente creó un caso en Borrador. Hay otro docente autenticado y un administrador autenticado.
- Pasos:
  1. Campo edición, escena o publicación. Valor: el otro docente intenta editar el caso, agregar una escena o publicarlo. Respuesta esperada: se rechaza y el caso no cambia. Tipo de escenario: Negativo.
  2. Campo gestión del caso. Valor: el administrador realiza una de esas gestiones. Respuesta esperada: el administrador sí puede gestionar el caso. Tipo de escenario: Positivo.
- Postcondiciones: El caso solo cambió por la gestión del administrador.

## CP-42. Umbral de ingreso tardío

- Caso de uso: Se aplica el umbral de ingreso tardío (RF-22).
- Módulo: Acceso.
- Descripción: Verificar que un estudiante entra si todavía está dentro del umbral definido por la docente, y que no entra cuando ese momento ya pasó.
- Precondiciones: La actividad ya inició. La docente definió hasta qué momento, después del inicio, un estudiante todavía puede entrar. Este caso no inventa ese valor.
- Pasos:
  1. Campo código de acceso. Valor: ingreso después del inicio, dentro del umbral definido por la docente. Respuesta esperada: el estudiante entra a su actividad. Tipo de escenario: Positivo.
  2. Campo código de acceso. Valor: ingreso cuando el umbral ya pasó y la actividad sigue abierta. Respuesta esperada: no entra, aunque el código sea válido y la actividad no haya cerrado. Tipo de escenario: Negativo.
- Postcondiciones: Solo queda en la actividad el estudiante que ingresó dentro del umbral.

## CP-43. Docente, administrador y estudiante usan Lumina en la web

- Caso de uso: Docente, administrador y estudiante usan Lumina desde la aplicación web.
- Módulo: Aplicación web.
- Descripción: Verificar que cada rol completa su tarea desde la interfaz, con los mismos límites que ya tiene su rol.
- Precondiciones: La aplicación web está disponible y usa los mismos usuarios de la plataforma.
- Pasos:
  1. Campo pantalla de administración. Valor: el administrador ingresa y crea un docente. Respuesta esperada: el docente queda creado desde la interfaz. Tipo de escenario: Positivo.
  2. Campo pantalla del docente. Valor: el docente arma un caso, lo publica y programa una actividad. Respuesta esperada: completa esas tareas desde la interfaz y no crea otros docentes. Tipo de escenario: Positivo.
  3. Campo pantalla de la simulación. Valor: el estudiante ingresa con su código, responde y consulta su avance. Respuesta esperada: solo ve su actividad y no administra. Tipo de escenario: Positivo.
- Postcondiciones: Cada rol terminó su tarea en la web, sin llamar la API a mano.
