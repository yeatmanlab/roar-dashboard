interface AudioContextType {
  decodeAudioData(
    audioData: ArrayBuffer,
    successCallback: (decodedData: AudioBuffer) => void,
    errorCallback: (error: Error) => void
  ): void;
}

interface UrlListMap {
  [key: string]: string;
}

export class BufferLoader {
  private context: AudioContextType;
  private urlListMap: UrlListMap;
  private onload: (bufferList: AudioBuffer[]) => void;
  private bufferList: AudioBuffer[];
  private loadCount: number;

  constructor(context: AudioContextType, urlListMap: UrlListMap, callback: (bufferList: AudioBuffer[]) => void) {
    this.context = context;
    this.urlListMap = urlListMap;
    this.onload = callback;
    this.bufferList = [];
    this.loadCount = 0;
  }

  private loadBuffer(url: string, index: string): void {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = () => {
      // Asynchronously decode the audio file data in request.response
      this.context.decodeAudioData(
        request.response,
        (buffer) => {
          if (!buffer) {
            alert('error decoding file data: ' + url);
            return;
          }
          this.bufferList[parseInt(index)] = buffer;
          this.loadCount += 1;
          if (this.loadCount === Object.keys(this.urlListMap).length) this.onload(this.bufferList);
        },
        (error) => {
          console.error('decodeAudioData error', error);
        }
      );
    };

    request.onerror = (error: Event) => {
      console.error('Request error', error);
    };

    request.send();
  }

  load(): void {
    Object.keys(this.urlListMap).forEach((key) => {
      this.loadBuffer(this.urlListMap[key], key);
    });
  }
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export const AudioContext = (window.AudioContext || window.webkitAudioContext) as unknown as AudioContextType; 