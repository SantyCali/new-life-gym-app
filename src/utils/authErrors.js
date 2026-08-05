// Traduce los códigos de error de Firebase Auth a mensajes legibles en español.
const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Ese email ya está registrado.',
  'auth/invalid-email': 'El email ingresado no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-not-found': 'No existe una cuenta con ese email.',
  'auth/wrong-password': 'La contraseña es incorrecta.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/missing-password': 'Ingresá una contraseña.',
  'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo más tarde.',
  'auth/network-request-failed': 'Error de conexión. Revisá tu internet.',
  'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
  'auth/requires-recent-login': 'Necesitás volver a iniciar sesión para hacer esto.',
};

export function mapAuthError(error) {
  const code = error?.code || 'auth/unknown';
  const message = ERROR_MESSAGES[code] || 'Ocurrió un error inesperado. Intentá de nuevo.';
  const mapped = new Error(message);
  mapped.code = code;
  return mapped;
}
