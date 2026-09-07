import * as THREE from 'three';
import { createArmReplica, getSelectedNode } from './arm.js?v=selector5';
import { NODE_LABELS } from './config.js?v=selector5';

let renderer, camera, scene, replica;
const host = document.getElementById('part-picker');
const labelLayer = document.getElementById('selector-labels');
const lineLayer = document.getElementById('selector-lines');
const labels = new Map(), lines = new Map(), originals = new Map();
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
// Labels stay at readable positions; leaders point to the actual mesh surfaces.
// Heights are fractions of the picker, not pixels: the picker's camera keeps a
// fixed vertical extent, so every part sits at the same fraction of the box
// whatever height the layout gives it, and the labels follow without retuning.
const layout = {
    mitt:['left',.043], pointer:['right',.043], thumb:['right',.230],
    wrist:['left',.388], elbow:['right',.586], shoulder:['left',.759], base:['right',.871],
};
function select(part) {
    if (host.closest('.locked')) return;
    host.dispatchEvent(new CustomEvent('partselect', {detail:part}));
}
function highlight(part) {
    labels.forEach((button,key) => button.setAttribute('aria-pressed', String(key===part)));
    if(!replica) return;
    for(const mesh of replica.surfaces) {
        const material = mesh.material, original = originals.get(mesh);
        material.color.copy(original.color);
        if(mesh.userData.part===part || part==='base') material.color.lerp(new THREE.Color(0xf0ae54),.45);
    }
    lines.forEach((line,key)=>line.classList.toggle('active',key===part));
}
export function initArmSelector() {
    const canvas=document.getElementById('selector-canvas');
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    scene=new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff,0xd9d6ca,2));
    const key=new THREE.DirectionalLight(0xfff5e5,2);key.position.set(5,8,7);scene.add(key);
    replica=createArmReplica();scene.add(replica.object);
    for(const mesh of replica.surfaces) originals.set(mesh,{color:mesh.material.color.clone()});
    camera=new THREE.OrthographicCamera(-4,4,3.65,-3.65,.1,100);
    camera.position.set(8,4.5,12);camera.lookAt(0,3.1,0);
    for(const [part,[side,top]] of Object.entries(layout)) {
        const button=document.createElement('button');button.type='button';button.dataset.part=part;
        button.className='arm-label';button.textContent=part==='base'?'Whole arm':NODE_LABELS[part];
        button.style[side]='6px';button.style.top=(top*100)+'%';
        button.addEventListener('click',()=>select(part));labelLayer.append(button);labels.set(part,button);
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');lineLayer.append(line);lines.set(part,line);
    }
    canvas.addEventListener('click',event=>{
        const bounds=canvas.getBoundingClientRect();
        pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
        ray.setFromCamera(pointer,camera);
        const hit=ray.intersectObjects(replica.surfaces,false)[0];
        if(hit) select(hit.object.userData.part);
    });
    host.addEventListener('selectionchange',event=>highlight(event.detail));
    new ResizeObserver(()=>{
        const width=host.clientWidth,height=host.clientHeight;
        if(!width || !height) return;
        renderer.setSize(width,height,false);
        camera.left=-3.65*width/height;camera.right=3.65*width/height;camera.updateProjectionMatrix();
        updateLeaders();
    }).observe(host);
    highlight(getSelectedNode());
}
function updateLeaders() {
    if(!replica) return;
    replica.object.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const width=host.clientWidth,height=host.clientHeight;
    lineLayer.setAttribute('viewBox',`0 0 ${width} ${height}`);
    for(const [part,button] of labels) {
        const center=new THREE.Vector3();
        if(part==='base') replica.parts.shoulder.getWorldPosition(center);
        else {
            const box=new THREE.Box3();
            for(const mesh of replica.surfaces.filter(mesh=>mesh.userData.part===part)) box.union(new THREE.Box3().setFromObject(mesh));
            box.getCenter(center);
        }
        center.project(camera);
        const line=lines.get(part),left=layout[part][0]==='left';
        line.setAttribute('x1',left?button.offsetLeft+button.offsetWidth:button.offsetLeft);
        line.setAttribute('y1',button.offsetTop+button.offsetHeight/2);
        line.setAttribute('x2',(center.x*.5+.5)*width);line.setAttribute('y2',(-center.y*.5+.5)*height);
    }
}
export function tickArmSelector() { if(renderer) renderer.render(scene,camera); }
