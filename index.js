import { registerRootComponent } from 'expo';
// Debe importarse siempre, incondicionalmente: define la tarea en background
// (TaskManager.defineTask) para que el sistema operativo pueda invocarla aunque
// la app arranque headless (sin UI), no solo cuando el usuario la abre.
import './src/services/backgroundStepsSync';
import App from './App';

registerRootComponent(App);
