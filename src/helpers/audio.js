// export function BufferLoader(context, urlListMap, callback) {
//   this.context = context;
//   this.urlListMap = urlListMap;
//   this.onload = callback;
//   this.bufferList = new Array();
//   this.loadCount = 0;
// }

// BufferLoader.prototype.loadBuffer = function(url, index) {
//   // Load buffer asynchronously
//   var request = new XMLHttpRequest();
//   request.open("GET", url, true);
//   request.responseType = "arraybuffer";

//   var loader = this;

//   request.onload = function() {
//     // Asynchronously decode the audio file data in request.response
//     loader.context.decodeAudioData(
//       request.response,
//       function(buffer) {
//         if (!buffer) {
//           alert('error decoding file data: ' + url);
//           return;
//         }
//         loader.bufferList[index] = buffer;
//         if (++loader.loadCount === Object.keys(loader.urlListMap).length)
//           loader.onload(loader.bufferList);
//       },
//       function(error) {
//         console.error('decodeAudioData error', error);
//       }
//     );
//   }

//   request.onerror = function() {
//     // alert('BufferLoader: XHR error');
//   }

//   request.send();
// }

// BufferLoader.prototype.load = function() {
//   Object.keys(this.urlListMap).forEach((key, index) => {
//     this.loadBuffer(this.urlListMap[key], key);
//   });  
// }

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
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
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
          if (++this.loadCount === Object.keys(this.urlListMap).length)
            this.onload(this.bufferList);
        },
        (error) => {
          console.error('decodeAudioData error', error);
        }
      );
    }

    request.onerror = (error) => {
      console.error('Request error', error);
    }

    request.send();
  }

  load() {
    Object.keys(this.urlListMap).forEach((key) => {
      this.loadBuffer(this.urlListMap[key], key);
    });  
  }
}

export const AudioContext = window.AudioContext || window.webkitAudioContext;
