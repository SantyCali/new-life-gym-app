import './planilla.css';
import { armarPlanilla } from './planilla';

// Las dos hojas A4 de la planilla de rutina del gimnasio, completas con la
// rutina. Se ven en pantalla y se imprimen tal cual (ver planilla.css).
export default function PlanillaRutina({ rutina, nombreSocio }) {
  const { secciones, extras, dias } = armarPlanilla(rutina);
  const hoja1 = secciones.filter((s) => s.hoja === 1);
  const hoja2 = secciones.filter((s) => s.hoja === 2);

  return (
    <>
      <div className="hoja hoja-1">
        <header className="cab1">
          <img className="sello" src="/planilla/sello.png" alt="New Life Gym" />
          <div>
            <div className="marca">NEW LIFE GYM</div>
            <div className="dir">Pasaje Los Teros 1058</div>
            <div className="dir">Villa de Merlo - San Luis</div>
            <div className="redes"><span className="fb">f</span> newlifemerlo</div>
          </div>
          <div className="socio">
            <div className="campo">
              <div className="titulo">NOMBRE</div>
              <div className="linea tinta">{nombreSocio}</div>
            </div>
            <div className="campo">
              <div className="titulo">OBJETIVOS</div>
              <div className="linea tinta">{rutina?.objetivos}</div>
            </div>
            <div className="campo">
              <div className="titulo">OBSERVACIÓN</div>
              <div className="linea tinta">{rutina?.observacion}</div>
            </div>
            <div className="aviso">
              <b>ESTIMADO SOCIO:</b>
              <span>RECUERDE TENER SU CUOTA AL DÍA PARA HACER EFECTIVA LA RENOVACIÓN DE SU RUTINA.</span>
            </div>
            <img className="h" src="/planilla/h-cabecera.png" alt="" />
          </div>
        </header>
        {hoja1.map((s) => <Seccion key={s.titulo} seccion={s} />)}
      </div>

      <div className="hoja hoja-2">
        <header className="cab2">
          <img className="h" src="/planilla/h-cabecera.png" alt="" />
          <div className="marca">NEW LIFE GYM</div>
          <div className="notas">
            - Mantenga el orden de los elementos utilizados en el gimnasio.<br />
            - Recuerde guardar su rutina una vez finalizada.<br />
            - Su cuota al día nos permite brindarle un mejor servicio a nuestros socios.
          </div>
        </header>
        {hoja2.map((s) => <Seccion key={s.titulo} seccion={s} />)}
        <div className={`observaciones${extras.length > 5 ? " apretado" : ""}`}>
          <h3>OBSERVACIONES</h3>
          {dias.length > 0 && <p className="tinta">{dias.join('   ·   ')}</p>}
          {extras.map((t, i) => <p key={i} className="tinta">{t}</p>)}
        </div>
      </div>
    </>
  );
}

function Seccion({ seccion }) {
  return (
    <table className="seccion">
      <colgroup>
        <col className="c-nom" /><col className="c-dia" /><col className="c-ord" /><col className="c-ser" />
        <col className="c-rep" /><col className="c-car" /><col className="c-obs" />
      </colgroup>
      <thead>
        <tr>
          <th>{seccion.titulo}</th><th>DIA</th><th>ORDEN</th><th>SERIE</th>
          <th>REPETICIÓN</th><th>CARGA</th><th>OBSERVACIÓN</th>
        </tr>
      </thead>
      <tbody>
        {seccion.filas.map((f, i) => (
          <tr key={i}>
            <td className={f.libre ? 'tinta' : ''}>{f.etiqueta}</td>
            <td className="tinta">{f.dia}</td>
            <td className="tinta">{f.orden}</td>
            <td className="tinta">{f.serie}</td>
            <td className="tinta">{f.rep}</td>
            <td className="tinta">{f.carga}</td>
            <td className="tinta obs">{f.obs}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
