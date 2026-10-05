import { registerRootComponent } from 'expo';
// Debe importarse siempre, incondicionalmente: define la tarea en background
// (TaskManager.defineTask) para que el sistema operativo pueda invocarla aunque
// la app arranque headless (sin UI), no solo cuando el usuario la abre.
import './src/services/backgroundStepsSync';
import App from './App';
import { AppRegistry } from 'react-native';
import { sincronizarEnSegundoPlano } from './src/services/backgroundStepsSync';
import { escucharSaludEnSegundoPlano } from './src/services/stepService';

// Android: el servicio de pasos lanza esta tarea (PuntosHeadlessService) después
// de subir pasos, para acreditar puntos, racha y torneos con la app cerrada.
AppRegistry.registerHeadlessTask('NLGPuntosEnSegundoPlano', () => async () => {
  await sincronizarEnSegundoPlano();
});

// iPhone: Salud despierta la app cuando hay pasos nuevos (más o menos una vez
// por hora, aunque esté cerrada): se suben pasos, puntos, racha y torneos.
escucharSaludEnSegundoPlano(() => { sincronizarEnSegundoPlano().catch(() => {}); });

registerRootComponent(App);
