import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Função principal para configurar a bola, a sua física e os controlos de tacada
export function setupBall(scene, world, physicsMaterial, camera, onShotCallback) {
    // Configuração da aparência da bola
    const ballRadius = 0.3; 
    const textureLoader = new THREE.TextureLoader();
    const ballTexture = textureLoader.load('texture.jpg'); 

    const ballMesh = new THREE.Mesh(
        new THREE.SphereGeometry(ballRadius, 32, 32),
        new THREE.MeshStandardMaterial({ map: ballTexture, color: 0xffffff, roughness: 0.2 })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    // Configuração da física da bola (CANNON.js)
    const ballBody = new CANNON.Body({
        mass: 1, 
        shape: new CANNON.Sphere(ballRadius),
        position: new CANNON.Vec3(0, 5, 8), // Será sobrescrito pela posição inicial do nível
        material: physicsMaterial,
        linearDamping: 0.5,
        angularDamping: 0.5 
    });
    world.addBody(ballBody);

    // Indicador visual da força e direção da tacada
    const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 0, 0xff0000);
    scene.add(arrowHelper);
    arrowHelper.visible = false;

    // Variáveis de estado para o controlo da tacada (Drag/Arrastar)
    let isDragging = false;
    let startPos = { x: 0, y: 0 };
    let currentPos = { x: 0, y: 0 };

    // Lógica ao pressionar o botão esquerdo do rato (tacada)
    window.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.id === 'resetBtn' || e.target.closest('.overlay-btn')) return;
        if (ballBody.velocity.length() > 0.5) return; // Só permite jogar se a bola estiver (quase) parada
        
        isDragging = true;
        startPos = { x: e.clientX, y: e.clientY };
        arrowHelper.visible = true;
    });

    // Função auxiliar para calcular o vetor (direção e força) da tacada com base na orientação da câmara
    function calculateShotVector(dx, dy) {
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        camForward.y = 0; camForward.normalize();
        const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0,1,0)).normalize();

        const shotDir = new THREE.Vector3(0,0,0);
        shotDir.addScaledVector(camForward, dy);
        shotDir.addScaledVector(camRight, -dx); 
        return shotDir;
    }

    // Lógica ao mover o rato (Atualizar a mira e força visuais na Seta)
    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        currentPos = { x: e.clientX, y: e.clientY };
        const dx = currentPos.x - startPos.x; const dy = currentPos.y - startPos.y;
        
        const shotVector = calculateShotVector(dx, dy);
        arrowHelper.position.copy(ballMesh.position);
        arrowHelper.setDirection(shotVector.clone().normalize());
        arrowHelper.setLength(Math.min(Math.sqrt(dx*dx + dy*dy) / 20, 10));
    });

    // Lógica ao soltar o rato (Disparar a bola)
    window.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false; arrowHelper.visible = false;

        const dx = currentPos.x - startPos.x; const dy = currentPos.y - startPos.y;
        if (Math.sqrt(dx*dx + dy*dy) < 15) return; // Deadzone para evitar tacadas acidentais mínimas
        
        const shotVector = calculateShotVector(dx, dy);
        // Aplica o impulso físico na bola usando o motor CANNON
        ballBody.applyImpulse(new CANNON.Vec3(shotVector.x * 0.05, 0, shotVector.z * 0.05), ballBody.position);
        
        // Informar o main.js que foi feita uma tacada (para atualizar o contador de tacadas, etc...)
        if (onShotCallback) onShotCallback();
    });

    // Retornamos as referências úteis para o main.js conseguir controlar e sincronizar graficamente a bola
    return { ballMesh, ballBody };
}