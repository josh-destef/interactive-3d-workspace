// Inference stays off the render thread. No frames leave this worker/device.
// Keep this a classic worker: MediaPipe's WASM loader uses importScripts.
let detector;
self.onmessage = async ({data}) => {
  if (data.type === 'init') {
    try {
      const { FilesetResolver, PoseLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      const options = {baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5};
      try { detector = await PoseLandmarker.createFromOptions(files, options); }
      catch { options.baseOptions.delegate = 'CPU'; detector = await PoseLandmarker.createFromOptions(files, options); }
      self.postMessage({type:'ready'});
    } catch(error) { self.postMessage({type:'error',message:error.message}); }
  } else if (data.type === 'frame') {
    try {
      const start=performance.now(), result=detector.detectForVideo(data.frame,data.timestamp);
      self.postMessage({type:'pose',landmarks:result.landmarks[0] || null,world:result.worldLandmarks[0] || null,ms:performance.now()-start});
    } catch(error) { self.postMessage({type:'error',message:error.message}); }
    finally { data.frame.close(); }
  }
};
