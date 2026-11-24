import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Margen de arriba (la barra de la hora, la isla/cámara) para las pantallas
// de la barra de abajo. Reemplaza a <SafeAreaView edges={['top']}>: ese mide
// su lugar en la pantalla DESPUÉS de dibujarse, y en Android la primera vez
// que se abría cada pestaña el contenido aparecía un cuadro más arriba y
// después bajaba (un salto). Los márgenes de useSafeAreaInsets ya se conocen
// desde que arranca la app, así que la pantalla aparece en su lugar.
export default function PantallaSegura({ style, children }) {
  const insets = useSafeAreaInsets();
  return <View style={[style, { paddingTop: insets.top }]}>{children}</View>;
}
