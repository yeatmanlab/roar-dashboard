export function checkAudio(config, mediaAssets) {
  if (!config.audio) {
    let neutral = mediaAssets.audio.neutralSoundCut;
    for (let key in mediaAssets.audio) {
      mediaAssets.audio[key] = mediaAssets.audio.nullAudio;
    }
    //reset sound for neutral sound
    if (neutral != undefined) {
      mediaAssets.audio.neutralSoundCut = neutral;
    }
  }
}
