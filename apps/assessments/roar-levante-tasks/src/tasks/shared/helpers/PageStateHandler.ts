/**
 * Class that handles the page state in a singleton
 * stores the stimuli length and replay button state and modifier
 */
import { jsPsych } from '../../taskSetup';
//@ts-ignore
import { camelize } from '@bdelab/roar-utils';
import { mediaAssets } from '../../..';

export class PageStateHandler {
  audioFile: string | string[];
  audioUri: string | string[];
  audioBuffer?: AudioBuffer | AudioBuffer[];
  replayBtn: HTMLButtonElement;
  playStimulusOnLoad: boolean;

  constructor(audioFile: string | string[], playStimulusOnLoad: boolean) {
    this.audioFile = audioFile;
    if (typeof this.audioFile === 'string') {
      this.audioUri = mediaAssets.audio[camelize(this.audioFile)] || mediaAssets.audio.nullAudio;
    } else {
      this.audioUri = this.audioFile.map((audio: string) => mediaAssets.audio[camelize(audio)]);
    }
    this.getbuffer();
    this.replayBtn = document.getElementById('replay-btn-revisited') as HTMLButtonElement;
    this.playStimulusOnLoad = playStimulusOnLoad !== undefined ? playStimulusOnLoad : true;
  }

  async getbuffer() {
    if (this.audioBuffer) {
      return this.audioBuffer;
    }
    if (typeof this.audioUri === 'string') {
      this.audioBuffer = (await jsPsych.pluginAPI.getAudioBuffer(this.audioUri)) as AudioBuffer;
      return this.audioBuffer;
    } else {
      this.audioBuffer = (await Promise.all(
        this.audioUri.map(async (audio: string) => jsPsych.pluginAPI.getAudioBuffer(audio)),
      )) as AudioBuffer[];
      return this.audioBuffer;
    }
  }

  async getStimulusDurationMs() {
    const buffer = await this.getbuffer();

    if (buffer instanceof AudioBuffer) {
      return buffer.duration * 1000;
    } else {
      return buffer.reduce((acc, curr) => acc + curr.duration * 1000, 0);
    }
  }

  isReplayBtnEnabled() {
    return this.replayBtn.hasAttribute('disabled');
  }

  enableReplayBtn() {
    this.replayBtn.disabled = false;
  }

  disableReplayBtn() {
    this.replayBtn.disabled = true;
  }
}
