// Config plugin: agrega el Foreground Service de pasos al build de Android.
// Se ejecuta durante `expo prebuild` (que EAS Build corre automáticamente).
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
  withAppBuildGradle,
} = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const KOTLIN_FILES = [
  'StepCounterService.kt',
  'StepCounterModule.kt',
  'StepCounterPackage.kt',
  'BootReceiver.kt',
  'PasosEnLaNube.kt',
  'PuntosHeadlessService.kt',
  'RelojSalud.kt',
];

// ── 1. Copia los archivos Kotlin al proyecto Android ─────────────────────────
function withKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      const ktDest = path.join(
        platformRoot,
        'app', 'src', 'main', 'java', 'com', 'newlife', 'app'
      );
      if (!fs.existsSync(ktDest)) fs.mkdirSync(ktDest, { recursive: true });

      for (const file of KOTLIN_FILES) {
        const src = path.join(projectRoot, 'modules', file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(ktDest, file));
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
    addPerm('android.permission.WAKE_LOCK');
    // Health Connect: leer los pasos del reloj o la pulsera (los escribe su
    // app: Mi Fitness, Samsung Health, Fitbit…), también con la app cerrada.
    addPerm('android.permission.health.READ_STEPS');
    addPerm('android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND');

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

    // Servicio que corre en JS el cálculo de puntos con la app cerrada
    if (!app.service.find((s) => s.$['android:name'] === '.PuntosHeadlessService')) {
      app.service.push({ $: { 'android:name': '.PuntosHeadlessService', 'android:exported': 'false' } });
    }

    // Health Connect solo muestra el cartel de permisos si la app declara dónde
    // explica para qué usa los datos. En Android 13 lo agrega el plugin de
    // react-native-health-connect a MainActivity; en Android 14+ va este alias.
    if (!app['activity-alias']) app['activity-alias'] = [];
    if (!app['activity-alias'].find((a) => a.$['android:name'] === 'ViewPermissionUsageActivity')) {
      app['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
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

// ── 3. Librería de Health Connect para RelojSalud.kt ────────────────────────
// La trae react-native-health-connect, pero como dependencia interna suya: el
// código de la app no la ve si no se agrega acá. Misma versión que esa librería.
function withHealthConnectGradle(config) {
  return withAppBuildGradle(config, (config) => {
    const deps = `    implementation("androidx.health.connect:connect-client:1.1.0-alpha11")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")`;
    if (!config.modResults.contents.includes('androidx.health.connect:connect-client')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        (m) => `${m}\n${deps}`
      );
    }
    return config;
  });
}

// ── 4. Registra el Package en MainApplication.kt ─────────────────────────────
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
  config = withHealthConnectGradle(config);
  config = withPackageRegistration(config);
  return config;
};
