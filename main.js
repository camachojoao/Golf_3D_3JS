import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { buildMap } from './map.js';
import { courseHoles } from './course.js';
import { setupBall } from './ball.js';

let isGameRunning = false;

export function startGame(mode) {
    if (isGameRunning) return;
    isGameRunning = true;

    // Elementos da UI
    const uiStrokes = document.getElementById('hud-strokes');
    const uiPar = document.getElementById('hud-par');
    const uiName = document.getElementById('hud-name');
    const overlayHoleEnd = document.getElementById('hole-end');
    const nextBtn = document.getElementById('next-btn');

    // Variáveis de Estado do Jogo
    let currentMode = mode; // 'training' ou 'course'
    let currentHoleIndex = 0;
    let currentStrokes = 0;
    let isHoleCompleted = false;
    let levelMeshes = []; // Guarda as paredes/chão para os podermos apagar ao mudar de nível
    let currentStartPos = new CANNON.Vec3(0, 5, 8); // Posição de respawn
    let scoreSheet = []; // Para guardar a pontuação final

    // --- 1. SETUP ENGINE ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    // Colocamos o "Sol" um pouco mais alto para cobrir bem os níveis longos
    dirLight.position.set(15, 35, 15); 
    dirLight.castShadow = true;

    // 1. Aumentar a área da câmara de sombras para cobrir 50x50 metros
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -25;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;

    // 2. Aumentar a resolução (já que a área agora é enorme, precisamos de mais pixeis)
    dirLight.shadow.mapSize.width = 2048; 
    dirLight.shadow.mapSize.height = 2048;

    // 3. Afinações de Bias para colar a sombra aos objetos e remover artefactos pretos nas faces
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;

    scene.add(dirLight);
    scene.add(dirLight);

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    const physMats = {
        physMat: new CANNON.Material('standard'),
        wallPhysMat: new CANNON.Material('wall'),
        rampPhysMat: new CANNON.Material('ramp'),
        floorMat: new THREE.MeshStandardMaterial({ color: 0x4CAF50, side: THREE.DoubleSide }),
        wallMat: new THREE.MeshStandardMaterial({ color: 0x8D6E63 }),
        cupMat: new THREE.MeshStandardMaterial({ color: 0x111111 })
    };
    world.addContactMaterial(new CANNON.ContactMaterial(physMats.physMat, physMats.physMat, { friction: 0.8, restitution: 0.3 }));
    world.addContactMaterial(new CANNON.ContactMaterial(physMats.physMat, physMats.wallPhysMat, { friction: 0.0, restitution: 0.6 }));
    world.addContactMaterial(new CANNON.ContactMaterial(physMats.physMat, physMats.rampPhysMat, { friction: 0.0, restitution: 0.0 }));

    // --- 2. SISTEMA DE BOLA E TACADAS ---
    const { ballMesh, ballBody } = setupBall(scene, world, physMats.physMat, camera, () => {
        if (!isHoleCompleted && currentMode === 'course') {
            currentStrokes++;
            uiStrokes.innerText = currentStrokes;
        }
    });

    function resetBallPosition() {
        ballBody.position.copy(currentStartPos);
        ballBody.velocity.set(0,0,0);
        ballBody.angularVelocity.set(0,0,0);
    }

    document.getElementById('resetBtn').addEventListener('click', resetBallPosition);

    // --- 3. GESTOR DE NÍVEIS ---
    function clearCurrentLevel() {
        levelMeshes.forEach(({mesh, body}) => {
            if (mesh) scene.remove(mesh);
            if (body) world.removeBody(body);
        });
        levelMeshes = [];
    }

    function loadLevel(index) {
        clearCurrentLevel();
        currentStrokes = 0;
        isHoleCompleted = false;
        overlayHoleEnd.style.display = 'none';
        uiStrokes.innerText = "0";

        if (currentMode === 'training') {
            buildMap(scene, world, physMats.physMat, physMats.wallPhysMat, physMats.rampPhysMat, levelMeshes);
            currentStartPos.set(0, 5, 8);
        } else if (currentMode === 'course') {
            const holeData = courseHoles[index];
            uiName.innerText = holeData.name;
            uiPar.innerText = holeData.par;
            currentStartPos.copy(holeData.startPos);
            holeData.build(scene, world, physMats, levelMeshes);
        }
        resetBallPosition();
    }

    // Carrega o mapa inicial baseado no botão que foi clicado no Menu
    loadLevel(0);

    // Botão "Próximo Buraco" no overlay
    nextBtn.addEventListener('click', () => {
        scoreSheet.push(currentStrokes); // Guarda a pontuação
        currentHoleIndex++;
        if (currentHoleIndex < courseHoles.length) {
            loadLevel(currentHoleIndex);
        } else {
            // FIM DO JOGO: Mostra Scorecard (Podes ligar os dados do array scoreSheet à tabela aqui!)
            overlayHoleEnd.style.display = 'none';
            document.getElementById('scorecard').style.display = 'flex';
        }
    });

    // --- 4. CONTROLO DA CÂMARA ---
    let cameraYaw = 0; let cameraPitch = Math.PI / 4; const camRadius = 12; 
    let isRightDragging = false; let prevMousePos = { x: 0, y: 0 };
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('pointerdown', e => { if (e.button === 2) { isRightDragging = true; prevMousePos = { x: e.clientX, y: e.clientY }; }});
    window.addEventListener('pointermove', e => {
        if (isRightDragging) {
            cameraYaw -= (e.clientX - prevMousePos.x) * 0.01;   
            cameraPitch = Math.max(0.1, Math.min(Math.PI / 2.2, cameraPitch + (e.clientY - prevMousePos.y) * 0.01));
            prevMousePos = { x: e.clientX, y: e.clientY };
        }
    });
    window.addEventListener('pointerup', e => { if (e.button === 2) isRightDragging = false; });

    // --- 5. LOOP DE ANIMAÇÃO ---
    const clock = new THREE.Clock();
    
    function animate() {
        requestAnimationFrame(animate);
        
        // Limita o delta máximo para evitar bugs de física se o separador do browser ficar em 2º plano
        const delta = Math.min(clock.getDelta(), 0.05);

        // O passo da física agora é mais consistente
        world.step(1 / 60, delta, 3);

        // Sincroniza a Bola
        ballMesh.position.copy(ballBody.position);
        ballMesh.quaternion.copy(ballBody.quaternion);
        
        // Sincroniza os restantes objetos (apenas se eles se pudessem mover, mas não faz mal manter)
        levelMeshes.forEach(({mesh, body}) => {
            if (mesh && body) { 
                mesh.position.copy(body.position); 
                mesh.quaternion.copy(body.quaternion); 
            }
        });

        // Lógica de Vitória...
        if (currentMode === 'course' && !isHoleCompleted) {
            const hole = courseHoles[currentHoleIndex];
            const distXZ = Math.sqrt(Math.pow(ballMesh.position.x - hole.holePos.x, 2) + Math.pow(ballMesh.position.z - hole.holePos.z, 2));
            
            if (distXZ < hole.holeRadius && ballMesh.position.y < (hole.holePos.y + 1)) {
                isHoleCompleted = true;
                
                let diff = currentStrokes - hole.par;
                let resultName = "Par"; let resultIcon = "⛳";
                if (diff <= -2) { resultName = "Eagle!"; resultIcon = "🦅"; }
                else if (diff === -1) { resultName = "Birdie!"; resultIcon = "🐦"; }
                else if (diff === 1) { resultName = "Bogey"; resultIcon = "⚠️"; }
                else if (diff >= 2) { resultName = "Double Bogey"; resultIcon = "☠️"; }
                
                document.getElementById('he-icon').innerText = resultIcon;
                document.getElementById('he-name').innerText = resultName;
                document.getElementById('he-detail').innerText = `${currentStrokes} jogadas · Par ${hole.par}`;
                
                overlayHoleEnd.style.display = 'flex';
            }
        }

        // CÂMARA: Matemática suave independente do Framerate
        const targetCamPos = new THREE.Vector3(
            ballMesh.position.x + camRadius * Math.cos(cameraPitch) * Math.sin(cameraYaw),
            ballMesh.position.y + camRadius * Math.sin(cameraPitch),
            ballMesh.position.z + camRadius * Math.cos(cameraPitch) * Math.cos(cameraYaw)
        );
        
        // A "Fórmula Mágica" para o Lerp suave: 1 - Math.exp(-velocidade * tempo_passado)
        // O valor 8 controla a rapidez da câmara. Aumenta para 12 se a quiseres mais presa à bola.
        const lerpFactor = 1 - Math.exp(-8 * delta);
        camera.position.lerp(targetCamPos, lerpFactor); 
        camera.lookAt(ballMesh.position);
        
        renderer.render(scene, camera);
    }

    animate();
}