import { Audio } from 'expo-av';

const GYM_SOUND = require('../../assets/sounds/gym.wav');
const LEVELUP_SOUND = require('../../assets/sounds/levelup.wav');
const LOGRO_SOUND = require('../../assets/sounds/updatepelgo-success.mp3');

async function play(source) {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 1.0 });
    sound.setOnPlaybackStatusUpdate(s => {
      if (s.didJustFinish) sound.unloadAsync();
    });
  } catch { }
}

export const playGymSound = () => play(GYM_SOUND);
export const playLevelUpSound = () => play(LEVELUP_SOUND);
export const playLogroSound = () => play(LOGRO_SOUND);
