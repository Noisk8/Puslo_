export function About() {
  return (
    <section className="about-page">
      <div className="section-heading">
        <span>03 / INFORMACIÓN</span>
        <span>READ ME</span>
      </div>
      <h2>
        Escucha el espacio.
        <br />
        Conserva tu privacidad.
      </h2>
      <p>
        El audio se procesa localmente en este dispositivo. No se graba ni se envía a servidores.
      </p>
      <div className="about-grid">
        <div>
          <h3>01 / SEÑAL DIGITAL</h3>
          <p>
            dBFS expresa el nivel respecto al máximo digital. 0 dBFS es full scale. El indicador
            PEAK muestra el pico digital del bloque, siempre en dBFS.
          </p>
        </div>
        <div>
          <h3>02 / NIVEL ACÚSTICO</h3>
          <p>
            Las mediciones SPL obtenidas con micrófonos integrados son estimaciones y dependen de la
            respuesta, ganancia y procesamiento del dispositivo. Para mediciones fiables utilice un
            micrófono de medición y calibración externa.
          </p>
          <p>
            No es un sonómetro certificado IEC. LAeq integra energía ponderada A durante hasta 60 s;
            MAX es el máximo de los bloques de 100 ms de la sesión.
          </p>
        </div>
        <div>
          <h3>03 / TEMPO Y PULSO</h3>
          <p>
            Essentia.js analiza ventanas de 10 segundos. La confianza es una puntuación heurística
            de consistencia, no una probabilidad. El pulso indica transitorios reales; entre ellos
            puede proyectarse a partir de los beats detectados. La etiqueta distingue ambos.
          </p>
        </div>
        <div>
          <h3>04 / HECHO PARA QUEDARSE</h3>
          <p>
            Instala PULSO desde el menú de tu navegador. Tras preparar la caché funciona sin
            conexión. El micrófono necesita HTTPS o localhost. El historial se mantiene solo en
            memoria, durante la sesión.
          </p>
        </div>
      </div>
    </section>
  );
}
