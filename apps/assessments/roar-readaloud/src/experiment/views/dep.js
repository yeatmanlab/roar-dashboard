// voiceCalibration.js
// async function giveAccess(){
//   // Get the user's media (audio and video)
//   navigator.mediaDevices.getUserMedia({
//       video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
//       audio: true
//   })
//     .then(function(stream) {
//       // If permission is granted, disable the "Give Access" button
//       // document.getElementById("giveAccessButton").disabled = true;
//       // Assign the camera stream to the global variable
//       camera_stream = stream;

//       // Initialize audio recorder
//       // audioChunks = [];
//       // audioRecorder = new MediaRecorder(camera_stream);
//       // audioRecorder.ondataavailable = (event) => {
//       //   if (event.data.size > 0) {
//       //     audioChunks.push(event.data);
//       //   }
//       // };

//       // Initialize video recorder
//     videoChunks = [];
//       videoRecorder = new MediaRecorder(camera_stream);
//       videoRecorder.ondataavailable = (event) => {
//         if (event.data.size > 0) {
//           videoChunks.push(event.data);
//         }
//       };

//     // Check the readiness of the camera stream at regular intervals
//     const checkCameraStream = setInterval(() => {
//       if (camera_stream && camera_stream.active) {
//         // Enable the "Start Test" button when the camera stream is ready
//         // document.getElementById("startTestButton").disabled = false;
//         clearInterval(checkCameraStream); // Stop checking once the stream is ready
//       }
//     }, 500); // Check every 500 milliseconds

//     })
//     .catch(function(error) {
//       console.error('Error accessing media devices:', error);
//     });
//   }

// RAN.js
// async function giveAccess(){
//     // Get the user's media (audio and video)
//     navigator.mediaDevices.getUserMedia({
//         video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
//         audio: true
//     })
//       .then(function(stream) {
//         // If permission is granted, disable the "Give Access" button
//         document.getElementById("giveAccessButton").disabled = true;
//         // Assign the camera stream to the global variable
//         camera_stream = stream;

//         // Initialize audio recorder
//         // audioChunks = [];
//         // audioRecorder = new MediaRecorder(camera_stream);
//         // audioRecorder.ondataavailable = (event) => {
//         //   if (event.data.size > 0) {
//         //     audioChunks.push(event.data);
//         //   }
//         // };

//         // Initialize video recorder
//       videoChunks = [];
//         videoRecorder = new MediaRecorder(camera_stream);
//         videoRecorder.ondataavailable = (event) => {
//           if (event.data.size > 0) {
//             videoChunks.push(event.data);
//           }
//         };

//       // Check the readiness of the camera stream at regular intervals
//       const checkCameraStream = setInterval(() => {
//         if (camera_stream && camera_stream.active) {
//           // Enable the "Start Test" button when the camera stream is ready
//           document.getElementById("startTestButton").disabled = false;
//           clearInterval(checkCameraStream); // Stop checking once the stream is ready
//         }
//       }, 500); // Check every 500 milliseconds

//       })
//       .catch(function(error) {
//         console.error('Error accessing media devices:', error);
//       });
//   }
