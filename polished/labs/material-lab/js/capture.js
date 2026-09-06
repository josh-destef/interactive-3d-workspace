/* Save a clean picture of the finished Gizmobot without the lesson interface. */
import {
    renderer, scene, camera, setBandOffset, setLightOrbVisible, isLightOrbVisible, applyFraming,
} from './stage.js';

const layer = document.getElementById('picture-layer');
const image = document.getElementById('gizmo-picture');
const download = document.getElementById('btn-download-picture');
const share = document.getElementById('btn-share-picture');
const status = document.getElementById('picture-status');
let pictureBlob = null;
let pictureUrl = '';

function closePicture() {
    layer.classList.remove('on');
    document.getElementById('btn-take-picture').focus();
}

function canvasBlob() {
    return new Promise(resolve => renderer.domElement.toBlob(resolve, 'image/png'));
}

async function takePicture() {
    const consoleHeight = document.getElementById('console').offsetHeight;
    const previousZoom = camera.zoom;
    const orbWasVisible = isLightOrbVisible();
    status.textContent = '';

    // Center Gizmobot in the exported frame. The regular lesson view shifts
    // the camera upward to leave room for the console.
    setBandOffset(0);
    setLightOrbVisible(false);
    camera.zoom = 1.4;
    applyFraming();
    renderer.render(scene, camera);
    pictureBlob = await canvasBlob();
    camera.zoom = previousZoom;
    setLightOrbVisible(orbWasVisible);
    setBandOffset(consoleHeight);
    applyFraming();

    if (!pictureBlob) {
        status.textContent = 'The picture could not be created. Please try again.';
        layer.classList.add('on');
        return;
    }

    if (pictureUrl) URL.revokeObjectURL(pictureUrl);
    pictureUrl = URL.createObjectURL(pictureBlob);
    image.src = pictureUrl;
    download.href = pictureUrl;

    const file = new File([pictureBlob], 'my-gizmobot.png', { type: 'image/png' });
    const canShare = !!navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }));
    share.hidden = !canShare;
    layer.classList.add('on');
    download.focus();
}

async function sharePicture() {
    if (!pictureBlob || !navigator.share) return;
    const file = new File([pictureBlob], 'my-gizmobot.png', { type: 'image/png' });
    try {
        await navigator.share({ title: 'My Gizmobot', text: 'Here is the Gizmobot material I made.', files: [file] });
        status.textContent = 'Picture shared.';
    } catch (error) {
        if (error.name !== 'AbortError') status.textContent = 'Sharing is not available here. You can download the picture instead.';
    }
}

document.getElementById('btn-take-picture').addEventListener('click', takePicture);
document.getElementById('btn-close-picture').addEventListener('click', closePicture);
share.addEventListener('click', sharePicture);
layer.addEventListener('click', event => {
    if (event.target === layer) closePicture();
});
window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && layer.classList.contains('on')) closePicture();
});
