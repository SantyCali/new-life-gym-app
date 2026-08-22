// Config plugin: agrega el Foreground Service de pasos al build de Android.
// Se ejecuta durante `expo prebuild` (que EAS Build corre automáticamente).
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const KOTLIN_FILES = [
  'StepCounterService.kt',
  'StepCounterModule.kt',
  'StepCounterPackage.kt',
  'BootReceiver.kt',
];

// ── 1. Copia los archivos Kotlin al proyecto Android ─────────────────────────
function withKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const dest = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', 'com', 'newlife', 'app'
      );

      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

      for (const file of KOTLIN_FILES) {
        const src = path.join(projectRoot, 'modules', file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(dest, file));
        } else {
          console.warn(`[withStepCounter] No se encontró: ${src}`);
        }
      }
      return config;
    },
  ]);
}

// ── 2. Agrega permisos y declaraciones al AndroidManifest.xml ────────────────
function withManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Permisos
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const addPerm = (name) => {
      if (!manifest['uses-permission'].find((p) => p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    };
    addPerm('android.permission.FOREGROUND_SERVICE');
    addPerm('android.permission.FOREGROUND_SERVICE_HEALTH');
    addPerm('android.permission.RECEIVE_BOOT_COMPLETED');

    const app = manifest.application[0];

    // Servicio
    if (!app.service) app.service = [];
    if (!app.service.find((s) => s.$['android:name'] === '.StepCounterService')) {
      app.service.push({
        $: {
          'android:name': '.StepCounterService',
          'android:foregroundServiceType': 'health',
          'android:exported': 'false',
          'android:stopWithTask': 'false',
        },
      });
    }

    // BroadcastReceiver para auto-arranque después de reboot
    if (!app.receiver) app.receiver = [];
    if (!app.receiver.find((r) => r.$['android:name'] === '.BootReceiver')) {
      app.receiver.push({
        $: {
          'android:name': '.BootReceiver',
          'android:exported': 'true',
          'android:enabled': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
              { $: { 'android:name': 'com.htc.intent.action.QUICKBOOT_POWERON' } },
            ],
          },
        ],
      });
    }

    return config;
  });
}

// ── 3. Registra el Package en MainApplication.kt ─────────────────────────────
function withPackageRegistration(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // StepCounterPackage está en el mismo paquete (com.newlife.app),
    // por eso no hace falta agregar un import.

    const addLine = 'add(StepCounterPackage())';
    if (!contents.includes(addLine)) {
      // Patrón moderno RN 0.73+: PackageList(this).packages.apply { ... }
      if (contents.includes('// add(MyReactNativePackage())')) {
        contents = contents.replace(
          '// add(MyReactNativePackage())',
          `// add(MyReactNativePackage())\n              add(StepCounterPackage())`
        );
      } else {
        // Patrón legacy: val packages = PackageList(this).packages
        contents = contents.replace(
          'val packages = PackageList(this).packages',
          `val packages = PackageList(this).packages\n        packages.add(StepCounterPackage())`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

// ── Plugin principal ──────────────────────────────────────────────────────────
module.exports = function withStepCounter(config) {
  config = withKotlinFiles(config);
  config = withManifest(config);
  config = withPackageRegistration(config);
  return config;
};
