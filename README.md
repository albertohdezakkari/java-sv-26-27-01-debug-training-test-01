# Java Debug Training · 1SI

Cuestionario estático para GitHub Pages con dos modos: test guiado y challenge. Cada intento contiene 20 preguntas elegidas al azar entre las 80 revisadas. Cada pregunta dispone de 60 segundos. La nota se corrige en servidor sobre 10 y se registra junto con el detalle de respuestas en el libro de 1SI.

## Publicación

La aplicación se sirve desde la raíz del repositorio. Activa GitHub Pages para la rama `main`, carpeta `/ (root)`. No necesita compilación.

## Registro de notas

Los identificadores de ambos modos y sus 80 preguntas activas deben estar configurados en `QUIZ_CONFIG` y `QUIZ_PREGUNTAS` de la hoja de evaluación de 1SI. La ruta de Apps Script valida el identificador del alumno, los 20 ítems, la duración y calcula la nota en el servidor. Cada intento usa un UUID para reconocer los reintentos de una respuesta y evitar filas duplicadas.

La aplicación no muestra el listado de nombres del grupo. El alumno introduce el nombre y el servidor lo coteja con `ALUMNOS`.


## Revisión docente

La portada incluye un modo de revisión docente que recorre las 80 preguntas sin temporizador ni registro de nota. En el test del alumnado, la respuesta y explicación quedan visibles hasta que se pulse «Siguiente».
