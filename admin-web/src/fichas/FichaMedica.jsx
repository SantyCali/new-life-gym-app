import { useState } from 'react';
import './fichaMedica.css';

// Ficha médica del gimnasio, igual a la de papel, en una hoja A4.
// Todo se puede escribir o corregir antes de imprimir: cada renglón es
// editable (se toca y se escribe) y los círculos de Sí / No se marcan con un
// clic. Lo que se escribe acá NO se guarda: es para imprimir. Lo único que se
// guarda es el año de validez (lo maneja la página, ver FichaMedicaPage).

// Renglón para completar: muestra el dato si lo hay y se puede editar.
function Linea({ valor = '', ancho, flex }) {
  return (
    <span
      className="fm-linea"
      style={{ width: ancho, flex: flex ? 1 : undefined }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
    >
      {valor}
    </span>
  );
}

// Círculo que se marca con un clic.
function Circulo({ marcado, onClick, children }) {
  return (
    <button type="button" className="fm-opcion" onClick={onClick}>
      {children}
      <span className={`fm-circulo${marcado ? ' marcado' : ''}`} />
    </button>
  );
}

function SiNo({ valor, onCambio }) {
  return (
    <span className="fm-sino">
      <Circulo marcado={valor === 'si'} onClick={() => onCambio(valor === 'si' ? null : 'si')}>Sí</Circulo>
      <Circulo marcado={valor === 'no'} onClick={() => onCambio(valor === 'no' ? null : 'no')}>No</Circulo>
    </span>
  );
}

// Fila de pregunta: "Desgarros musculares  Sí ○  No ○  Especifique: ____".
function Pregunta({ texto, especifique = 'Especifique:', doble, claro }) {
  const [v, setV] = useState(null);
  return (
    <div className={`fm-fila fm-pregunta${claro ? ' claro' : ''}${doble ? ' doble' : ''}`}>
      <span className="fm-texto">{texto}</span>
      <SiNo valor={v} onCambio={setV} />
      <span className="fm-especifique">
        <span className="fm-etq">{especifique}</span>
        {!doble && <Linea flex />}
      </span>
      {doble && <span className="fm-segunda"><Linea flex /></span>}
    </div>
  );
}

function Barra({ children }) {
  return <div className="fm-barra">{children}</div>;
}

// datos: lo que ya se sabe del socio (o vacío para imprimir en blanco).
export default function FichaMedica({ datos = {}, anio }) {
  const [sexo, setSexo] = useState(datos.sexo ?? null);   // 'M' | 'F' | null
  return (
    <div className="hoja fm-hoja">
      <header className="fm-cabecera">
        <div>
          <div className="fm-titulo">FICHA MEDICA</div>
          <div className="fm-subtitulo">
            <span className="fm-marca">NEW LIFE GYM</span>
            <span className="fm-direccion">Pasaje Los Teros 1058 Villa de Merlo - San Luis</span>
          </div>
        </div>
        <div className="fm-socio">SOCIO N° <Linea valor={datos.numero} flex /></div>
      </header>

      <Barra>DATOS PERSONALES</Barra>
      <div className="fm-fila">
        <span className="fm-etq">Nombre y apellido:</span><Linea valor={datos.nombre} flex />
        <span className="fm-etq">Fecha de nacimiento:</span><Linea valor={datos.nacimiento} ancho="30mm" />
      </div>
      <div className="fm-fila claro">
        <span className="fm-etq">Edad:</span><Linea valor={datos.edad} ancho="14mm" />
        <span className="fm-etq">Sexo:</span>
        <span className="fm-sino">
          <Circulo marcado={sexo === 'M'} onClick={() => setSexo(sexo === 'M' ? null : 'M')}>M</Circulo>
          <Circulo marcado={sexo === 'F'} onClick={() => setSexo(sexo === 'F' ? null : 'F')}>F</Circulo>
        </span>
        <span className="fm-etq">DNI:</span><Linea valor={datos.dni} ancho="30mm" />
        <span className="fm-etq">Altura:</span><Linea valor={datos.altura} ancho="16mm" />
        <span className="fm-etq">Grupo sanguíneo:</span><Linea flex />
      </div>
      <div className="fm-fila">
        <span className="fm-etq">Dirección:</span><Linea valor={datos.direccion} flex />
        <span className="fm-etq">Localidad:</span><Linea valor={datos.localidad} ancho="30mm" />
        <span className="fm-etq">E-mail:</span><Linea valor={datos.email} ancho="52mm" />
      </div>
      <div className="fm-fila claro">
        <span className="fm-etq">Teléfono fijo:</span><Linea flex />
        <span className="fm-etq">Celular:</span><Linea valor={datos.celular} flex />
        <span className="fm-etq">Facebook:</span><Linea flex />
      </div>
      <div className="fm-fila">
        <span className="fm-etq">Obra social:</span><Linea ancho="45mm" />
        <span className="fm-etq">Actividad a realizar:</span><Linea flex />
      </div>
      <div className="fm-fila claro">
        <span className="fm-etq">Objetivos:</span><Linea valor={datos.objetivos} flex />
      </div>

      <Barra>PROBLEMAS FISICOS <span className="fm-barra-nota">(Marque lo que corresponda)</span></Barra>
      <Pregunta texto="Enfermedades del corazón" />
      <Pregunta texto="Enfermedades respiratorias" claro />

      <Barra>ENFERMEDADES DE LOS HUESOS, MUSCULOS Y ARTICULACIONES</Barra>
      <Pregunta texto="Desgarros musculares" />
      <Pregunta texto="Esguinces" claro />
      <Pregunta texto="Rotura de ligamentos" />
      <Pregunta texto="Fracturas" especifique="Especifique tipo y localización de la fractura." doble claro />
      <Pregunta texto="Cirugías" especifique="Especifique tipo y localización:" />
      <Pregunta texto="Problemas en la columna (escoliosis, lordosis, cifosis, otros)" claro />

      <Barra>ENFERMEDADES DEL SISTEMA NERVIOSO</Barra>
      <Pregunta texto="Mareos en reposo" />
      <Pregunta texto="Desmayos en reposo" claro />
      <Pregunta texto="Otros" />
      <Pregunta texto="¿Posee algún otro tipo de enfermedad?" claro />
      <Pregunta texto="¿Está tomando algún tipo de medicamento?" />

      <p className="fm-validez">
        SE HACE CONSTAR QUE ESTA FICHA TENDRA VALIDEZ POR EL AÑO {anio}, DEBIENDO PRESENTAR ADEMAS CERTIFICADO DE
        APTITUD FISICA FIRMADO POR UN PROFESIONAL DE LA SALUD.
      </p>
      <p className="fm-declaracion">
        DECLARACION: Por la presente declaro que los datos arriba consignados son fiel expresión de la verdad y tienen
        valor de declaración jurada, también declaro, que dispongo de todos los estudios que la actividad física a
        realizar. Aconsejando, responsable por ello, de todos mis actos y quedando perfectamente exento el GYM de la
        institución anteriormente dicha reclamo.
      </p>

      <div className="fm-firmas">
        <div className="fm-firma"><Linea flex /><span>FIRMA</span></div>
        <div className="fm-firma"><Linea valor={datos.aclaracion} flex /><span>ACLARACION</span></div>
        <div className="fm-firma"><Linea valor={datos.fecha} flex /><span>FECHA</span></div>
      </div>
    </div>
  );
}
