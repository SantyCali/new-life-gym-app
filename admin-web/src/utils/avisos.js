import { toast } from 'react-toastify';

// Confirma una operación y, si hubo que avisarle al Excel, dice si llegó.
// Antes un fallo de la planilla pasaba en silencio: Firestore quedaba bien y
// el Excel (lo que consulta la puerta) desactualizado sin que nadie supiera.
export function avisarGuardado(texto, excel) {
  if (excel && !excel.ok) {
    toast.warn(
      `${texto}, pero no se pudo actualizar el Excel (${excel.error}). Revisalo a mano en la planilla.`,
      { autoClose: 12000 },
    );
    return;
  }
  toast.success(excel ? `${texto} y actualizado en el Excel.` : `${texto}.`);
}

export function avisarError(texto, error) {
  console.error('[admin-web]', error);
  const detalle = error?.code === 'permission-denied'
    ? 'tu cuenta no tiene permiso para esta operación'
    : error?.message;
  toast.error(detalle ? `${texto}: ${detalle}` : texto, { autoClose: 10000 });
}
