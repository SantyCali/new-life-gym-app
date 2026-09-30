// Las fotos llegan en dos formatos según su origen: la app mobile guarda en
// users.photoBase64 el base64 pelado que devuelve expo-image-picker (y le
// antepone el prefijo al renderizar), mientras que las cargadas desde acá ya
// son un data URL completo. Esto acepta los dos.
export function toImageSrc(base64) {
  if (!base64) return null;
  return base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
}

// Redimensiona y comprime una imagen a base64 (JPEG) para guardarla como
// campo de un documento de Firestore. No hay Firebase Storage configurado
// en el proyecto (ni se quiere tocar reglas sin avisar), así que la foto se
// achica a propósito: a 480px pesa ~80KB en base64, muy por debajo del
// límite de 1MB por documento, y todavía se ve bien ampliada en el visor.
export function fileToCompressedBase64(file, maxSize = 480, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
