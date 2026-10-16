"use strict";

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/cEaawvQW7/";

const webcamVideo = document.getElementById("webcam");
const capturedImage = document.getElementById("captured-image");
const captureCanvas = document.getElementById("capture-canvas");
const cameraPlaceholder = document.getElementById("camera-placeholder");
const cameraMessage = document.getElementById("camera-message");
const cameraStatus = document.getElementById("camera-status");
const statusDot = document.querySelector(".status-dot");
const captureButton = document.getElementById("capture-button");
const buttonText = document.getElementById("button-text");
const liveButton = document.getElementById("live-button");
const modelState = document.getElementById("model-state");
const resultStyle = document.getElementById("result-style");
const resultDescription = document.getElementById("result-description");
const cameraFrame = document.querySelector(".camera-frame");
const captureHint = document.getElementById("capture-hint");
const frameNumber = document.getElementById("frame-number");
const aiBadge = document.querySelector(".ai-badge");

const styleDescriptions = {
  formal: "STRUCTURE & ELEGANCE. A polished look built around tailored silhouettes, clean lines and sophisticated details.",
  casual: "EFFORTLESS EVERYDAY. Comfort meets simplicity through relaxed silhouettes and versatile everyday pieces.",
  streetwear: "URBAN EXPRESSION. Bold proportions, contemporary street culture and a look that refuses to blend in.",
  sporty: "MOVE WITH PURPOSE. Athletic influences, functional pieces and a dynamic, performance-inspired aesthetic."
};

let model = null;
let cameraStream = null;
let cameraReady = false;
let modelReady = false;
let isProcessing = false;
let frameCounter = 1;

function setCameraStatus(text, state = "") {
  cameraStatus.textContent = text;
  statusDot.classList.remove("ready", "error");
  if (state) statusDot.classList.add(state);
}

function setCameraMessage(text) {
  cameraMessage.textContent = text;
}

function updateButton() {
  const ready = cameraReady && modelReady && !isProcessing;
  captureButton.disabled = !ready;

  if (isProcessing) buttonText.textContent = "ANALYZING LOOK...";
  else if (!cameraReady) buttonText.textContent = "CAMERA UNAVAILABLE";
  else if (!modelReady) buttonText.textContent = "LOADING AI MODEL";
  else buttonText.textContent = "CAPTURE LOOK";
}

async function loadModel() {
  try {
    modelState.textContent = "LOADING";
    model = await tmImage.load(
      MODEL_URL + "model.json",
      MODEL_URL + "metadata.json"
    );
    modelReady = true;

    console.log("AI model loaded successfully.");
    console.log("Class labels:", model.getClassLabels());

    modelState.textContent = "READY";
    aiBadge.textContent = "AI ACTIVE";
    aiBadge.classList.add("active");
    updateButton();
  } catch (error) {
    console.error("Model loading error:", error);
    modelState.textContent = "ERROR";
    resultStyle.textContent = "MODEL ERROR";
    resultDescription.textContent =
      "The AI model could not be loaded. Check the model URL and your internet connection.";
    buttonText.textContent = "MODEL UNAVAILABLE";
    captureButton.disabled = true;
  }
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCameraStatus("CAMERA ERROR", "error");
    setCameraMessage("Your browser requires HTTPS or localhost to access the camera.");
    return;
  }

  try {
    setCameraMessage("Requesting camera permission...");
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 1600 }
      }
    });

    webcamVideo.srcObject = cameraStream;

    await new Promise((resolve, reject) => {
      if (webcamVideo.readyState >= 1) resolve();
      else {
        webcamVideo.onloadedmetadata = resolve;
        webcamVideo.onerror = reject;
      }
    });

    await webcamVideo.play();
    cameraReady = true;
    cameraPlaceholder.classList.add("hidden");
    setCameraStatus("CAMERA LIVE", "ready");
    captureHint.textContent = "POSITION YOUR LOOK";
    updateButton();
    console.log("Camera started successfully.");
  } catch (error) {
    console.error("Camera access error:", error);
    cameraReady = false;
    setCameraStatus("CAMERA ERROR", "error");

    if (error.name === "NotAllowedError") {
      setCameraMessage("Camera permission denied. Allow camera access in browser settings and reload.");
    } else if (error.name === "NotFoundError") {
      setCameraMessage("No camera was found on this device.");
    } else {
      setCameraMessage("Unable to start the camera. Check permissions and whether another app is using it.");
    }
    updateButton();
  }
}

function takePhoto() {
  const width = webcamVideo.videoWidth;
  const height = webcamVideo.videoHeight;
  if (!width || !height) throw new Error("Camera image is not ready.");

  captureCanvas.width = width;
  captureCanvas.height = height;
  const context = captureCanvas.getContext("2d");

  // Mirror the image to match the selfie preview.
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(webcamVideo, 0, 0, width, height);
  context.restore();

  capturedImage.src = captureCanvas.toDataURL("image/jpeg", 0.92);
  capturedImage.classList.add("visible");
  cameraFrame.classList.add("frozen");
  captureHint.textContent = "FRAME CAPTURED";

  frameCounter += 1;
  frameNumber.textContent = "FRAME " + String(frameCounter).padStart(3, "0");
  liveButton.disabled = false;
  liveButton.classList.add("visible");
}

async function classifyImage() {
  if (!modelReady || !cameraReady || isProcessing) return;

  isProcessing = true;
  updateButton();
  modelState.textContent = "ANALYZING";
  resultStyle.textContent = "ANALYZING...";
  resultDescription.textContent = "The neural network is examining your outfit.";

  try {
    takePhoto();
    const predictions = await model.predict(captureCanvas);
    renderPredictions(predictions);
    modelState.textContent = "COMPLETE";
    setCameraStatus("LOOK CAPTURED", "ready");
    captureHint.textContent = "ANALYSIS COMPLETE";
  } catch (error) {
    console.error("Classification error:", error);
    modelState.textContent = "ERROR";
    resultStyle.textContent = "TRY AGAIN";
    resultDescription.textContent = "The image could not be classified. Please take another photo.";
    setCameraStatus("ANALYSIS ERROR", "error");
  } finally {
    isProcessing = false;
    updateButton();
  }
}

function renderPredictions(predictions) {
  const normalized = predictions.map(item => ({
    className: item.className.trim().toLowerCase(),
    probability: item.probability
  }));

  document.querySelectorAll(".prediction").forEach(row => {
    row.classList.remove("winner");
    row.querySelector(".prediction-value").textContent = "0%";
    row.querySelector(".bar-fill").style.width = "0%";
  });

  normalized.forEach(item => {
    const row = document.querySelector(
      `.prediction[data-class="${item.className}"]`
    );

    if (!row) {
      console.warn("Model class does not match a displayed category:", item.className);
      return;
    }

    const percentage = item.probability * 100;
    row.querySelector(".prediction-value").textContent = percentage.toFixed(1) + "%";

    requestAnimationFrame(() => {
      row.querySelector(".bar-fill").style.width = percentage + "%";
    });
  });

  const winner = normalized.reduce((best, current) =>
    current.probability > best.probability ? current : best
  );

  const winnerRow = document.querySelector(
    `.prediction[data-class="${winner.className}"]`
  );
  if (winnerRow) winnerRow.classList.add("winner");

  resultStyle.textContent = winner.className.toUpperCase();
  resultDescription.textContent = styleDescriptions[winner.className] ||
    "The model has identified the most likely category for this look.";

  const expectedClasses = ["formal", "casual", "streetwear", "sporty"];
  const missingClasses = expectedClasses.filter(
    name => !normalized.some(item => item.className === name)
  );
  if (missingClasses.length) {
    console.warn("Check class names in Teachable Machine. Missing:", missingClasses);
  }
}

function resetStudio() {
  if (!cameraReady || isProcessing) return;

  capturedImage.classList.remove("visible");
  capturedImage.removeAttribute("src");
  // The webcam stream stays active behind the captured still. Removing the
  // still-image overlay reveals the continuously updating video again.
  webcamVideo.style.opacity = "1";
  cameraFrame.classList.remove("frozen");
  liveButton.classList.remove("visible");
  liveButton.disabled = true;
  captureHint.textContent = "POSITION YOUR LOOK";
  modelState.textContent = "READY";
  resultStyle.textContent = "—";
  resultDescription.textContent = "Your style story will appear here.";

  document.querySelectorAll(".prediction").forEach(row => {
    row.classList.remove("winner");
    row.querySelector(".prediction-value").textContent = "—%";
    row.querySelector(".bar-fill").style.width = "0%";
  });

  setCameraStatus("CAMERA LIVE", "ready");
  updateButton();
}

captureButton.addEventListener("click", classifyImage);
liveButton.addEventListener("click", resetStudio);

async function initializeStudio() {
  await Promise.allSettled([startCamera(), loadModel()]);
  updateButton();
}

initializeStudio();

window.addEventListener("pagehide", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
});
