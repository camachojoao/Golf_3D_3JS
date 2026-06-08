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
        cupMat: new THREE.MeshStandardMaterial({ color: 0x111111, side: THREE.DoubleSide })
    };
    world.addContactMaterial(new CANNON.ContactMaterial(physMats.physMat, physMats.physMat, { friction: 0.8, restitution: 0.3 }));
    world.addContactMaterial(new CANNON.ContactMaterial(physMats.physMat, physMats.wallPhysMat, { friction: 0.0, restitution: 0.8 }));
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
        ballBody.mass = 1; // Devolvemos a massa para "descongelar" a bola para o próximo nível
        ballBody.updateMassProperties();
        ballBody.position.copy(currentStartPos);
        ballBody.velocity.set(0,0,0);
        ballBody.angularVelocity.set(0,0,0);
        isHoleCompleted = false; // Reset da variável de vitória para novo treino/nível

        // Repor a bandeira na sua rotação inicial
        const flag = scene.getObjectByName("holeFlag");
        if (flag) flag.rotation.y = 0;
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
            overlayHoleEnd.style.display = 'none';
            
            // Preencher a tabela de pontuação final (Scorecard) dinamicamente
            const scBody = document.getElementById('sc-body');
            scBody.innerHTML = ''; // Limpar tabela (precaução)
            
            let totalPar = 0;
            let totalShots = 0;

            courseHoles.forEach((hole, i) => {
                const strokes = scoreSheet[i];
                const diff = strokes - hole.par;
                
                totalPar += hole.par;
                totalShots += strokes;

                let resName = "Par"; let scClass = "sc-par"; let diffTxt = "E";
                if (diff <= -2) { resName = "Eagle"; scClass = "sc-eagle"; diffTxt = diff; }
                else if (diff === -1) { resName = "Birdie"; scClass = "sc-birdie"; diffTxt = diff; }
                else if (diff === 1) { resName = "Bogey"; scClass = "sc-bogey"; diffTxt = "+" + diff; }
                else if (diff >= 2) { resName = "Double Bogey"; scClass = "sc-double"; diffTxt = "+" + diff; }

                const row = document.createElement('tr');
                row.innerHTML = `<td>${i + 1}</td><td>${hole.name}</td><td>${hole.par}</td><td>${strokes}</td><td class="${scClass}">${resName} (${diffTxt})</td>`;
                scBody.appendChild(row);
            });

            // Cálculo do rodapé (Total de tacadas e a diferença total perante o par do campo)
            const totalDiff = totalShots - totalPar;
            document.getElementById('sc-total-shots').innerText = totalShots;
            document.getElementById('sc-total-diff').innerText = totalDiff === 0 ? "E" : (totalDiff > 0 ? "+" + totalDiff : totalDiff);

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
        if (!isHoleCompleted) {
            let targetPos, targetRadius;

            if (currentMode === 'course') {
                const hole = courseHoles[currentHoleIndex];
                targetPos = hole.holePos;
                targetRadius = hole.holeRadius;
            } else {
                // Modo Treino (o buraco está na origem) com o sensor aumentado (ex: 1.5x maior)
                targetPos = { x: 0, y: -1.5, z: 0 };
                targetRadius = 0.76 * 1.5; 
            }

            const distXZ = Math.sqrt(Math.pow(ballMesh.position.x - targetPos.x, 2) + Math.pow(ballMesh.position.z - targetPos.z, 2));
            
            if (distXZ < targetRadius && ballMesh.position.y < (targetPos.y + 1.2)) {
                isHoleCompleted = true;
                
                // FIX: Congelamos a bola totalmente no exato momento que ganha. 
                // Impede qualquer movimento estranho ou glitch no interior apertado do copo!
                ballBody.velocity.set(0, 0, 0);
                ballBody.angularVelocity.set(0, 0, 0);
                ballBody.mass = 0; 
                ballBody.updateMassProperties();

                if (currentMode === 'course') {
                    const hole = courseHoles[currentHoleIndex];
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
        }

        // Anima a bandeira a girar de forma festiva quando o buraco é concluído
        if (isHoleCompleted) {
            const flag = scene.getObjectByName("holeFlag");
            // Roda apenas até perfazer 2 voltas completas (4 * Pi)
            if (flag && flag.rotation.y < Math.PI * 4) {
                flag.rotation.y += 8 * delta;
                if (flag.rotation.y > Math.PI * 4) flag.rotation.y = Math.PI * 4; 
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