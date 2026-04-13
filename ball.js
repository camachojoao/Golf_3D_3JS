import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// NOTA: Agora recebemos a 'camera' como parâmetro!
export function setupBall(scene, world, physicsMaterial, meshesToUpdate, camera) {
    const ballRadius = 0.3; 
    
    // NOVO: Carregar a textura
    const textureLoader = new THREE.TextureLoader();
    // Coloca a tua imagem na mesma pasta e altera o nome aqui:
    const ballTexture = textureLoader.load('texture.jpg'); 

    const ballMesh = new THREE.Mesh(
        new THREE.SphereGeometry(ballRadius, 32, 32),
        new THREE.MeshStandardMaterial({ 
            map: ballTexture,  // Aplica o ficheiro JPG
            color: 0xffffff,   // Mantemos branco para não misturar com as cores da imagem
            roughness: 0.2 
        })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const ballBody = new CANNON.Body({
        mass: 1, 
        shape: new CANNON.Sphere(ballRadius),
        position: new CANNON.Vec3(0, 5, 8), 
        material: physicsMaterial,
        linearDamping: 0.5, // Ligeiramente aumentado para não rebolar para sempre
        angularDamping: 0.5 
    });
    world.addBody(ballBody);
    meshesToUpdate.push({ mesh: ballMesh, body: ballBody });

    const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 0, 0xff0000);
    scene.add(arrowHelper);
    arrowHelper.visible = false;

    // --- SISTEMA DE RESET ---
    document.getElementById('resetBtn').addEventListener('click', () => {
        // Reinicia a posição
        ballBody.position.set(0, 5, 8);
        // Zera a inércia, força e rotação para a bola não continuar a mover-se ao reaparecer no ar
        ballBody.velocity.set(0, 0, 0);
        ballBody.angularVelocity.set(0, 0, 0);
    });

    // --- CONTROLOS RELATIVOS À CÂMARA ---
    let isDragging = false;
    let startPos = { x: 0, y: 0 };
    let currentPos = { x: 0, y: 0 };

    window.addEventListener('pointerdown', (e) => {

        if (e.button !== 0) return;
        // Ignora cliques que sejam em cima do botão de reset
        if (e.target.id === 'resetBtn') return;
        if (ballBody.velocity.length() > 0.5) return; 
        
        isDragging = true;
        startPos = { x: e.clientX, y: e.clientY };
        arrowHelper.visible = true;
    });

    // Função auxiliar para calcular o vetor de força com base no ângulo da câmara
    function calculateShotVector(dx, dy) {
        // Descobre para onde a câmara está a olhar (Frente)
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        camForward.y = 0; // Ignora o eixo vertical para não atirarmos a bola para o céu
        camForward.normalize();

        // Descobre o que é a "Direita" da câmara
        const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0,1,0)).normalize();

        // Combina o arrasto do rato com a visão da câmara
        // dy (arrastar para baixo) atira a bola para a frente da câmara
        // dx (arrastar para a direita) atira a bola para a esquerda (efeito fisga/slingshot)
        const shotDir = new THREE.Vector3(0,0,0);
        shotDir.addScaledVector(camForward, dy);
        shotDir.addScaledVector(camRight, -dx); 
        
        return shotDir;
    }

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        currentPos = { x: e.clientX, y: e.clientY };
        
        const dx = currentPos.x - startPos.x;
        const dy = currentPos.y - startPos.y;
        
        const shotVector = calculateShotVector(dx, dy);
        const direction = shotVector.clone().normalize();
        
        // Tamanho visual da seta
        const visualPower = Math.min(Math.sqrt(dx*dx + dy*dy) / 20, 10); 
        
        arrowHelper.position.copy(ballMesh.position);
        arrowHelper.setDirection(direction);
        arrowHelper.setLength(visualPower);
    });

    window.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        arrowHelper.visible = false;

        const dx = currentPos.x - startPos.x;
        const dy = currentPos.y - startPos.y;

        //Calcula a distância total do arrasto
        const dragDistance = Math.sqrt(dx*dx + dy*dy);
        
        // Se arrastaste menos de 15 pixeis, é considerado um clique acidental. Ignorar tiro.
        if (dragDistance < 15) return;
        
        const shotVector = calculateShotVector(dx, dy);
        
        // O multiplicador 0.05 é a "sensibilidade" da força aplicada
        const powerX = shotVector.x * 0.05;
        const powerZ = shotVector.z * 0.05;
        
        const impulseVec = new CANNON.Vec3(powerX, 0, powerZ);
        ballBody.applyImpulse(impulseVec, ballBody.position);
    });

    return { ballMesh, ballBody };
}