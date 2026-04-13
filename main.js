import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { buildMap } from './map.js';
import { setupBall } from './ball.js';

const meshesToUpdate = [];

// --- 1. SETUP THREE.JS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
        
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);


// --- 2. SETUP CANNON-ES (Física) ---
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

const physicsMaterial = new CANNON.Material('standard'); // Chão e Bola
const wallPhysicsMaterial = new CANNON.Material('wall'); // Paredes
const rampPhysicsMaterial = new CANNON.Material('ramp'); // NOVO: Rampa

// Bola vs Chão (Alta fricção para rolar)
const floorContact = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
    friction: 0.8,    
    restitution: 0.3  
});
world.addContactMaterial(floorContact);

// Bola vs Parede (Fricção ZERO para ressaltar bem)
const wallContact = new CANNON.ContactMaterial(physicsMaterial, wallPhysicsMaterial, {
    friction: 0.0,    
    restitution: 0.6  
});
world.addContactMaterial(wallContact);

// NOVO: Bola vs Rampa (Totalmente suave, sem catapultas)
const rampContact = new CANNON.ContactMaterial(physicsMaterial, rampPhysicsMaterial, {
    friction: 0.0,    // ZERO fricção para não agarrar o spin da bola
    restitution: 0.0  // ZERO ressalto para a bola não tremer ao subir
});
world.addContactMaterial(rampContact);

// --- 3. CONSTRUIR O MUNDO ---
// Passamos os TRÊS materiais para o mapa
buildMap(scene, world, physicsMaterial, wallPhysicsMaterial, rampPhysicsMaterial, meshesToUpdate);
const { ballMesh, ballBody } = setupBall(scene, world, physicsMaterial, meshesToUpdate, camera);
// --- 4. CONTROLO DA CÂMARA (Botão Direito) ---
let cameraYaw = 0; // Rotação horizontal em redor da bola
let cameraPitch = Math.PI / 4; // Ângulo vertical
const camRadius = 12; // Distância fixa da câmara à bola

let isRightDragging = false;
let previousMousePos = { x: 0, y: 0 };

// Bloqueia o menu de opções do browser ao clicar com o botão direito
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('pointerdown', (e) => {
    if (e.button === 2) { // 2 = Botão direito do rato
        isRightDragging = true;
        previousMousePos = { x: e.clientX, y: e.clientY };
    }
});

window.addEventListener('pointermove', (e) => {
    if (isRightDragging) {
        const deltaX = e.clientX - previousMousePos.x;
        const deltaY = e.clientY - previousMousePos.y;

        cameraYaw -= deltaX * 0.01;   // Sensibilidade horizontal
        cameraPitch += deltaY * 0.01; // Sensibilidade vertical

        // Previne que a câmara vá para debaixo do chão ou vire ao contrário
        cameraPitch = Math.max(0.1, Math.min(Math.PI / 2.2, cameraPitch));

        previousMousePos = { x: e.clientX, y: e.clientY };
    }
});

window.addEventListener('pointerup', (e) => {
    if (e.button === 2) isRightDragging = false;
});

// --- 5. LOOP DE ANIMAÇÃO ---
const clock = new THREE.Clock();
        
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    world.step(1 / 60, delta, 3);

    meshesToUpdate.forEach(({ mesh, body }) => {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
    });

    // CÁLCULO DA CÂMARA: Usa matemática esférica para orbitar a bola
    const targetCamPos = new THREE.Vector3(
        ballMesh.position.x + camRadius * Math.cos(cameraPitch) * Math.sin(cameraYaw),
        ballMesh.position.y + camRadius * Math.sin(cameraPitch),
        ballMesh.position.z + camRadius * Math.cos(cameraPitch) * Math.cos(cameraYaw)
    );
            
    camera.position.lerp(targetCamPos, 0.1); 
    camera.lookAt(ballMesh.position);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();