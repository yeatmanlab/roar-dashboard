export class BufferLoader {
  constructor(context, urlListMap, callback) {
    this.context = context;
    this.urlListMap = urlListMap;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
  }

  loadBuffer(url, index) {
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
          this.bufferList[index] = buffer;
          this.loadCount += 1;
          if (this.loadCount === Object.keys(this.urlListMap).length) this.onload(this.bufferList);
        },
        (error) => {
          console.error('decodeAudioData error', error);
        },
      );
    };

    request.onerror = (error) => {
      console.error('Request error', error);
    };

    request.send();
  }

  load() {
    Object.keys(this.urlListMap).forEach((key) => {
      this.loadBuffer(this.urlListMap[key], key);
    });
  }
}

export const AudioContext = window.AudioContext || window.webkitAudioContext;
