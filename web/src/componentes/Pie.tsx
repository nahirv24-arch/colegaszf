/** Pie con dirección, web, Instagram y WhatsApp comercial (mismos datos que el original). */
export function Pie() {
  return (
    <footer>
      <div className="col gut">
        <div className="d1">
          <b>ZF Propiedades</b>
          Obispo Trejo 954, Piso 2, Of. 2, Nueva Córdoba, Córdoba<br />
          Zavalía &amp; Fuster · Corredores Públicos Inmobiliarios
        </div>
        <div className="redes">
          <a href="https://www.zfpropiedades.com.ar" target="_blank" rel="noopener">www.zfpropiedades.com.ar</a>
          <div className="iconos">
            <a className="ico" href="https://www.instagram.com/zfpropiedades/" target="_blank" rel="noopener"
               aria-label="Instagram de ZF Propiedades" title="Instagram @zfpropiedades">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
              </svg>
            </a>
            <a className="ico" href="https://wa.me/5493516378970" target="_blank" rel="noopener"
               aria-label="WhatsApp del equipo comercial" title="WhatsApp comercial">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor"
                      strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M8.7 7.6c.2-.4.5-.4.7-.4h.6c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.4 0 .6.5.9 1.3 1.7 2.2 2.2.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.3.1.4.3.4.5 0 .6-.2 1.3-.7 1.7-.6.5-1.5.6-2.4.3-2.2-.7-4-2.4-5-4.5-.4-.9-.5-1.9-.2-2.5z"
                      fill="currentColor" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
