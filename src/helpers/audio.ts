export interface BufferList {
  [key: string]: AudioBuffer;
}

export class BufferLoader {
  context: AudioContext;
  urlListMap: Record<string, string>;
  onload: (bufferList: BufferList) => void;
  bufferList: BufferList;
  loadCount: number;

  constructor(context: AudioContext, urlListMap: Record<string, string>, callback: (bufferList: BufferList) => void) {
    this.context = context;
    this.urlListMap = urlListMap;
    this.onload = callback;
    this.bufferList = {}; // Initialize as an empty object
    this.loadCount = 0;
  }

  loadBuffer(url: string, index: string): void {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = () => {
      // Asynchronously decode the audio file data in request.response
      this.context.decodeAudioData(
        request.response,
        (buffer: AudioBuffer) => {
          if (!buffer) {
            // Use console.error instead of alert for better DX
            console.error('error decoding file data: ' + url);
            return;
          }
          this.bufferList[index] = buffer;
          this.loadCount += 1;
          if (this.loadCount === Object.keys(this.urlListMap).length) this.onload(this.bufferList);
        },
        (error: DOMException) => {
          console.error('decodeAudioData error', error);
        },
      );
    };

    request.onerror = (error: ProgressEvent) => {
      console.error('Request error', error);
    };

    request.send();
  }

  load(): void {
    Object.keys(this.urlListMap).forEach((key: string) => {
      this.loadBuffer(this.urlListMap[key], key);
    });
  }
}

// Ensure AudioContext is typed correctly
export const AudioContext = window.AudioContext || ((window as any).webkitAudioContext as { new (): AudioContext });
