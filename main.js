import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { buildMap } from './map.js';
import { courseHoles } from './course.js';
import { setupBall } from './ball.js';

// Variável global para garantir que o jogo só arranca uma vez
let isGameRunning = false;

// Função principal que inicia o jogo (modo 'training' ou 'course')
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

    // Configuração base do ambiente 3D (Cena, Câmara e Renderizador)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Adição de luz ambiente e luz direcional
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    // Colocamos o "Sol" um pouco mais alto para cobrir bem os níveis longos
    dirLight.position.set(15, 35, 15); 
    dirLight.castShadow = true;

    // Ajustes da câmara de sombras para cobrir uma área grande de 50x50 metros
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -25;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;

    // Aumentar a resolução da sombra para manter a qualidade numa área grande
    dirLight.shadow.mapSize.width = 2048; 
    dirLight.shadow.mapSize.height = 2048;

    // Pequenos ajustes (Bias) para evitar falhas visuais (artefactos) nas sombras
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;

    scene.add(dirLight);

    // Criação do mundo físico com gravidade realista
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    
    // Definição dos materiais e como eles reagem ao colidir (fricção e ressalto)
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

    // Criação da bola e definição do que acontece após cada tacada
    const { ballMesh, ballBody } = setupBall(scene, world, physMats.physMat, camera, () => {
        if (!isHoleCompleted && currentMode === 'course') {
            currentStrokes++;
            uiStrokes.innerText = currentStrokes;
        }
    });

    // Função para repor a bola no ponto de partida se algo correr mal
    function resetBallPosition() {
        ballBody.position.copy(currentStartPos);
        ballBody.velocity.set(0,0,0);
        ballBody.angularVelocity.set(0,0,0);
    }

    document.getElementById('resetBtn').addEventListener('click', resetBallPosition);

    // Função para remover todos os blocos do nível anterior da memória e cena
    function clearCurrentLevel() {
        levelMeshes.forEach(({mesh, body}) => {
            if (mesh) scene.remove(mesh);
            if (body) world.removeBody(body);
        });
        levelMeshes = [];
    }

    // Função responsável por construir o nível pedido e repor pontuações
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

    // Lógica do botão de avançar para o próximo buraco no final de cada nível
    nextBtn.addEventListener('click', () => {
        scoreSheet.push(currentStrokes); // Guarda a pontuação
        currentHoleIndex++;
        if (currentHoleIndex < courseHoles.length) {
            loadLevel(currentHoleIndex);
        } else {
            // FIM DO JOGO: Mostra pontuação (ainda por fazer)
            overlayHoleEnd.style.display = 'none';
            document.getElementById('scorecard').style.display = 'flex';
        }
    });

    // Sistema de controlo de câmara (arrastar o botão direito)
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

    // Relógio para calcular o tempo passado entre frames (delta)
    const clock = new THREE.Clock();
    
    // Loop de animação que corre a cada frame
    function animate() {
        requestAnimationFrame(animate);
        
        // Limita o delta máximo para evitar bugs de física se o separador do browser ficar em 2º plano
        const delta = Math.min(clock.getDelta(), 0.05);

        // Atualiza o motor de física com um passo de tempo fixo
        world.step(1 / 60, delta, 3);

        // Sincroniza a posição da mesh 3D da bola com o corpo físico invisível
        ballMesh.position.copy(ballBody.position);
        ballMesh.quaternion.copy(ballBody.quaternion);
        
        // Sincroniza também as posições dos obstáculos (caso se movessem)
        levelMeshes.forEach(({mesh, body}) => {
            if (mesh && body) { 
                mesh.position.copy(body.position); 
                mesh.quaternion.copy(body.quaternion); 
            }
        });

        // Verifica se a bola caiu dentro da área do buraco e aciona a vitória
        if (currentMode === 'course' && !isHoleCompleted) {
            const hole = courseHoles[currentHoleIndex];
            const distXZ = Math.sqrt(Math.pow(ballMesh.position.x - hole.holePos.x, 2) + Math.pow(ballMesh.position.z - hole.holePos.z, 2));
            
            if (distXZ < hole.holeRadius && ballMesh.position.y < (hole.holePos.y + 1)) {
                isHoleCompleted = true;
                
                // Lógica de cálculo da pontuação (Eagle, Birdie, Par, etc.) com base nas jogadas
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

        // Cálculo e movimentação suave da câmara para seguir a bola de forma fluida
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