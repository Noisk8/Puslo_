# PULSO — BPM + Sound Meter

<img width="1297" height="672" alt="imagen" src="https://github.com/user-attachments/assets/d241411b-7a06-4707-bd1b-1ccd473eea1f" />

<img width="1297" height="672" alt="imagen" src="https://github.com/user-attachments/assets/2ef7f9f5-54e4-44ce-9b48-48bc57170bdc" />


Instrumento web de tempo y nivel sonoro con interfaz de terminal retro: fondo carbón, fósforo verde, detalles ámbar y lecturas monoespaciadas. React + TypeScript estricto + Vite, sin backend. No hay datos de demostración en la aplicación.

## Ejecutar

Requiere Node.js 22.12+ (verificado con Node 24) y npm.

```sh
npm install
npm run dev
```

Abre la dirección local que muestra Vite y pulsa **INICIAR MICRÓFONO**. Los niveles se actualizan a 10 Hz; la primera estimación de BPM necesita aproximadamente 10–13 segundos de música. **DETENER** libera las pistas, los nodos, el worker y el contexto de audio.

```sh
npm run typecheck
npm test
npm run lint
npm run build
npm run preview
```

`npm run build` produce `dist/`, incluyendo los recursos de Essentia y un service worker con versión calculada a partir del contenido. Sirve esa carpeta desde la raíz del dominio. No necesita servidor de aplicación.

El lockfile fija las dependencias verificadas. Se utiliza TypeScript 6, compatible con el rango admitido por typescript-eslint; no se forzó su instalación con TypeScript 7. `postinstall` copia las distribuciones oficiales de Essentia a `public/vendor/`. No edites esos archivos generados.

## Funciones

- Captura explícita, selección de entrada y mensajes de permisos, desconexión y errores.
- RMS real, dBFS, pico digital por bloque, eventos de clipping y máximo de sesión.
- Respuesta visual SLOW (1 s) o FAST (125 ms), independiente del histórico.
- Ponderación A según la frecuencia real del AudioContext.
- Calibración de 6 s con referencia externa, validación de estabilidad y persistencia local.
- dBA **estimado** únicamente con calibración compatible con entrada, nombre y sample rate.
- LAeq energético móvil de hasta 60 s, con duración provisional visible.
- BPM mediante Essentia.js/WASM, confianza heurística y estabilización de octavas.
- Pulso de transitorios reales y proyección de beats con indicación de su origen.
- Historial energético agregado cada segundo, limitado a los últimos 15 minutos.
- Umbrales visuales configurables, pantalla completa y Screen Wake Lock si están disponibles.
- PWA con iconos, instalación desde el navegador y funcionamiento offline.
- Diseño adaptable, controles nativos, foco visible, diálogo modal con teclado y reduced motion.

## Arquitectura

```text
getUserMedia (mono, procesamiento solicitado desactivado)
  └─ MediaStreamAudioSourceNode
      └─ AudioWorklet
          ├─ RMS / peak / clipping / filtro A → bloques de ~100 ms
          │   └─ AudioEngine → integración LAeq / suavizado / histórico
          │       └─ store → useSyncExternalStore → React
          └─ MessagePort directo: PCM temporal en bloques transferibles de 4096
              └─ Worker → ring buffer de 10 s → remuestreo a 44100 Hz
                  └─ Essentia WASM → RhythmExtractor2013 → TempoTracker
                      └─ AudioEngine → React
```

El hilo principal nunca recibe PCM. El AudioWorklet se conecta a la salida para mantener el grafo activo, pero genera silencio: **no reproduce ni monitoriza el micrófono**. La UI no realiza DSP. La clase `AudioEngine` encapsula las APIs del navegador y expone `initialize`, `requestPermission`, `start`, `stop`, `setInputDevice`, `configure`, `subscribe`, `getState` y `destroy`.

Carpetas:

- `src/audio/dsp/`: medición, ponderación, integración, calibración y remuestreo.
- `src/audio/worklets/`: procesador de nivel y transporte PCM.
- `src/audio/rhythm/`, `src/workers/`: Essentia y estabilizador de tempo.
- `src/state/`, `src/hooks/`: configuración local, suscripciones y APIs de pantalla.
- `src/pages/`, `src/components/`, `src/styles/`: interfaz.
- `scripts/`: recursos locales, generación de caché y señales de prueba.
- `tests/dsp/`, `tests/rhythm/`, `tests/browser/`: pruebas unitarias e integración real.

### Temporización y memoria

El trabajo por muestra ocurre en AudioWorklet. Los bloques de nivel llegan aproximadamente cada 100 ms; el SVG del histórico está memoizado y se actualiza al añadir un agregado, aproximadamente cada segundo. LAeq usa la duración exacta de los bloques, incluida la porción que cruza el límite de 60 s.

El worker conserva un ring buffer de 10 segundos y analiza cada 3 segundos de audio nuevo. Un conjunto fijo de 32 buffers PCM transferibles evita colas ilimitadas; se reciclan a través de MessagePort. Si el worker no alcanza a procesarlos, el worklet descarta muestras del ramo de ritmo, mantiene la medición de nivel y contabiliza la pérdida. El worker detecta discontinuidades y vuelve a reunir una ventana continua; no concatena silenciosamente audio separado. En dispositivos lentos el BPM puede actualizarse menos frecuentemente.

Las llamadas a Essentia liberan los vectores WASM de entrada y salida en `finally`. Detener destruye el worker, incluyendo su memoria WASM. Las solicitudes de permiso pendientes se invalidan por generación: si terminan tras detener, sus pistas se cierran. El audio también se detiene al abandonar la página. La sesión no se reanuda automáticamente al volver.

### BPM y WASM: decisión verificada

Se utiliza `essentia.js@0.1.3`, `RhythmExtractor2013` con `multifeature`. Su entrada requiere **44100 Hz**, independientemente del sample rate del dispositivo:

- [RhythmExtractor2013, documentación de Essentia](https://essentia.upf.edu/reference/std_RhythmExtractor2013.html)
- [Distribuciones y ejecución de Essentia.js](https://mtg.github.io/essentia.js/docs/)

La distribución ES oficial contiene el WASM embebido. Se sirve localmente y se importa exclusivamente desde un worker de módulo; Vite empaqueta el worker y AudioWorklet con URLs de recursos con hash. El código de Essentia se copia sin modificar, preservando licencia y formato. No se depende de CDN, rutas remotas ni modificaciones del glue de Emscripten.

**Limitación encontrada:** la llamada `Resample` de la distribución WASM 0.1.3 lanzó excepciones tanto en Node como en Chromium con entradas válidas de 48 kHz. La extracción directa a 44,1 kHz sí funcionó. Por ello el remuestreo usa un FIR sinc con ventana Blackman, 64 taps, 1024 fases fraccionales y corte al 94% de Nyquist, dentro del worker. Las pruebas verifican duración, ganancia a 1 kHz y atenuación de señales sobre la nueva frecuencia de Nyquist. No se modifica el ramo de medición acústica.

`TempoTracker` conserva raw BPM, candidatos ×¼/½/1/2/4 dentro del rango, seis estimaciones y tempo estable. Elige la octava próxima al historial y usa mediana e inliers con ponderación de confianza. No duplica automáticamente todo tempo bajo: sin evidencia previa, una interpretación inicial a mitad de tempo sigue siendo posible. Cambiar el rango permite orientar la detección.

La confianza mostrada **no es una probabilidad**: `c / (c + 1)` para la confianza no negativa de Essentia, multiplicado por consistencia de inliers y madurez del historial (hasta tres ventanas). Las estimaciones caducan si no se renuevan o existe silencio sostenido. El primer resultado tiene confianza reducida.

El beat no es una animación CSS periódica: reacciona a transitorios de energía. Cuando el análisis aporta ticks fiables, se usa su fase para aceptar transitorios cercanos y proyectar el siguiente pulso. Las etiquetas **TRANSITORIO** y **PROYECTADO** distinguen la procedencia. La precisión visual está limitada por la publicación a 10 Hz; no sirve como reloj MIDI/Link.

## dBFS, dBA y calibración

**dBFS** es nivel digital respecto a full scale: `20 log10(rms)`, con floor −100. No representa presión acústica. El pico siempre se identifica como **PEAK DIGITAL / dBFS**; no se convierte en un pico SPL sin definir ponderación y calibración apropiadas.

La ponderación A utiliza los polos analógicos publicados para IEC 61672: 20.598997 Hz (doble), 107.65265 Hz, 737.86223 Hz y 12194.217 Hz (doble). Se transforman por bilineal a tres secciones de segundo orden, normalizadas a 1 kHz para el sample rate real. Fuente y metodología: [MathWorks, frequency-weighted filter](https://www.mathworks.com/help/audio/ref/weightingfilter-system-object.html). El filtro tiene deformación frecuencial cerca de Nyquist; **esto no constituye validación ni certificación IEC**.

Para calibrar:

1. Inicia el micrófono y deja estabilizar la entrada.
2. Colócalo junto a un sonómetro externo en ponderación A bajo sonido estable, o utiliza un calibrador de 1 kHz apropiado para ese micrófono.
3. Abre **CALIBRAR dBA**, introduce la referencia real y pulsa **CAPTURAR REFERENCIA**.
4. Mantén el sonido constante durante 6 segundos y guarda.

El offset es `referencia − nivel energético A digital`. Se rechazan clipping, señal por debajo del floor útil, menos de 40 bloques y desviación mayor de 1.5 dB. El botón espera 6 s de reloj, pero la validación requiere además datos realmente capturados. Si el audio se pausa o falla, no se fabrica una calibración.

Se guarda offset, fecha, dispositivo y nombre, sample rate, referencia y ponderación. Nunca se aplica una calibración guardada a un dispositivo o sample rate distinto. Cambiar la calibración reinicia LAeq y el historial para no mezclar referencias. Cambiar de entrada o de rango BPM inicia una nueva sesión. La calibración puede eliminarse en configuración. Una calibración de teléfono deja de ser adecuada si cambia su ganancia, orientación, carcasa o procesamiento; vuelve a calibrar bajo las condiciones de uso.

**LAeq** integra energía A, no promedia decibelios. Antes de 60 s muestra el período realmente acumulado como provisional. **MAX** es el máximo de los bloques sin suavizado visual de aproximadamente 100 ms, en dBFS o dBA estimado según calibración. **PEAK** es el máximo absoluto dentro del último bloque en dBFS. **CLIPPING EVENTOS** cuenta episodios consecutivos separados por bloques sin saturación; el aviso permanece visible 1 s.

> Las mediciones SPL obtenidas con micrófonos integrados son estimaciones y dependen de la respuesta, ganancia y procesamiento del dispositivo. Para mediciones fiables utilice un micrófono de medición y calibración externa.

Los umbrales son referencias visuales configurables; no representan límites médicos, legales o normativos. El clipping se advierte porque invalida la fidelidad de la señal y puede afectar el SPL estimado.

## Privacidad

El audio se procesa localmente en este dispositivo. No se graba ni se envía a servidores. No existen analytics, telemetría, uploads, backend ni claves de API. Solo se persisten configuración y calibración en localStorage. El histórico es exclusivamente de sesión y vive en memoria. Los buffers PCM son temporales para análisis y se reutilizan o liberan; no se guardan archivos de audio.

Las únicas solicitudes de red de la aplicación son archivos estáticos del mismo origen. La caché PWA almacena código, estilos, iconos y WASM, nunca audio ni histórico.

## HTTPS, PWA y móvil

El micrófono requiere **HTTPS** en producción; `http://localhost` es la excepción de desarrollo. Una dirección `http://192.168.x.x` abierta desde el teléfono no es un contexto seguro: utiliza un servidor con HTTPS para probar en la red local.

La PWA se registra solo en producción. Ejecuta `npm run build && npm run preview` para verificarla. Tras completar la caché aparece **OFFLINE READY**. Puedes instalarla desde el menú del navegador (en iOS: compartir → añadir a inicio). La caché incluye Essentia, workers y WASM. Las actualizaciones esperan a cerrar las pestañas existentes para no sustituir recursos durante una medición. Un fallo de caché deja disponible el uso online.

La app se despliega inicialmente en `/`. Para alojarla en una subcarpeta, adapta conjuntamente `base` de Vite, manifest, registro del service worker y lista de precache; no basta con cambiar una única URL.

Fullscreen y Wake Lock se solicitan con las APIs del navegador y muestran limitaciones si no están disponibles. iOS/Android pueden suspender audio al bloquear la pantalla, cambiar de aplicación o por política de energía. Se ofrece **REANUDAR** cuando AudioContext está suspendido. No se garantiza captura en segundo plano.

Capacitor no está instalado. La UI depende del servicio `AudioEngine`, no de nodos del navegador, por lo que se podrá incorporar un adaptador de captura y los permisos nativos sin cambiar las pantallas. Antes de empaquetar: validar el WebView y AudioWorklet/WASM reales, configurar permisos de micrófono de Android/iOS y probar ciclo de vida, interrupciones y selección de micrófono en hardware. La versión web no demuestra por sí sola compatibilidad nativa.

## Pruebas

```sh
npm test                         # Vitest: DSP y estabilización
npm run typecheck                # TypeScript strict
npm run lint
npm run format:check
npx playwright install chromium # una vez
npm run build
npm run test:e2e                 # Chromium + getUserMedia + AudioWorklet + WASM
```

Las pruebas de navegador generan WAV **sintéticos** en el directorio temporal del sistema y los entregan al dispositivo falso de Chromium; no son grabaciones del usuario ni una fuente de datos de producción. Comprueban inicio explícito, lectura real de esa entrada, BPM de patrón a 120, cambios de amplitud, privacidad de red, distintos anchos, persistencia de ajustes, diálogo, caché offline, calibración sobre seno de 1 kHz, clipping y cancelación de permisos pendientes.

Las pruebas unitarias cubren silencio, NaN/Infinity, seno, RMS, dBFS, pico, clipping, energía LAeq, suavizado, ponderación A a 44.1/48/96 kHz, remuestreo, calibración y normalización ×2/÷2. Abre `?debug=1` para ver sample rate, buffer, RMS, nivel bruto, raw/stable BPM, candidatos, confianza, estado de procesadores y pérdida estimada de muestras/frames.

### Validación que requiere hardware

La captura de un micrófono físico y la calibración contra un instrumento externo no se pueden confirmar con un dispositivo sintético. Antes de uso en sala, prueba:

- Hablar, reproducir música de tempo conocido y variar el volumen.
- Denegar permiso, seleccionar otra entrada, desconectarla e iniciar/detener repetidamente.
- Calibrar con referencia externa y comprobar varios niveles sin alterar ganancia.
- Vertical/horizontal en teléfono real, silencio, clipping y varios minutos de LAeq.
- Interrupciones, bloqueo/desbloqueo, fullscreen y Wake Lock según navegador.
- Una sesión de varias horas para caracterizar consumo y rendimiento del dispositivo.

No se afirma haber validado hardware móvil, exactitud metrológica ni funcionamiento durante horas. Los ritmos ambiguos, reverberación, voz, transitorios débiles y múltiples fuentes pueden reducir precisión y confianza.

## Dependencias y futuras extensiones

Dependencias de ejecución: React, ReactDOM y Essentia.js. No hay librería de gráficos ni de estado; SVG y APIs web resuelven esas funciones. Las herramientas de desarrollo añaden Vite, TypeScript, Vitest, ESLint, Prettier y Playwright.

Essentia.js se distribuye bajo **AGPL-3.0**; se conserva su licencia en `public/vendor/ESSENTIA-LICENSE.txt` y en el build. Este repositorio no define todavía una licencia propia para el resto del código.

La estructura permite añadir otras ponderaciones, ventanas Leq, un adaptador Capacitor o exportación de agregados. No se implementaron LUFS, espectro, MIDI, OSC, Link, backend ni almacenamiento de sesiones.
