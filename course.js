import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Lógica de construção da base do nível (Chão e Buraco)
function buildLevelLayout(scene, world, mats, levelMeshes, width, depth, holeX, holeZ, holeRadius) {
    const { floorMat, cupMat, physMat } = mats;

    // Gráficos do Chão (Formato do plano)
    const shape = new THREE.Shape();
    shape.moveTo(-width/2, -depth/2);
    shape.lineTo(width/2, -depth/2);
    shape.lineTo(width/2, depth/2);
    shape.lineTo(-width/2, depth/2);
    shape.lineTo(-width/2, -depth/2);

    // Recorte do buraco na mesh do chão
    const holePath = new THREE.Path();
    // Usa-se -holeZ porque a rotação de -90 graus no X inverte a orientação do eixo Z visual
    holePath.absarc(holeX, -holeZ, holeRadius, 0, Math.PI * 2, false);
    shape.holes.push(holePath);

    // Adicionar a mesh 3D do chão à cena
    const floorMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    levelMeshes.push({ mesh: floorMesh, body: null });

    // Física do Chão (4 caixas de colisão invisíveis em redor do buraco)
    const thick = 1;
    const createPhysBox = (w, d, x, z) => {
        const body = new CANNON.Body({ mass: 0, material: physMat });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, thick/2, d/2)));
        body.position.set(x, -thick/2, z);
        world.addBody(body);
        levelMeshes.push({ mesh: null, body: body });
    };

    // O buraco físico será um quadrado ligeiramente mais apertado (0.9) que o visual.
    // Isto evita que a bola salte nas arestas da malha 3D ao passar perto da beira.
    const pRadius = holeRadius * 0.9;
    createPhysBox(width, (depth/2 + holeZ - pRadius), 0, (holeZ - pRadius - (depth/2 + holeZ - pRadius)/2));
    createPhysBox(width, (depth/2 - holeZ - pRadius), 0, (holeZ + pRadius + (depth/2 - holeZ - pRadius)/2));
    createPhysBox((width/2 + holeX - pRadius), pRadius * 2, (holeX - pRadius - (width/2 + holeX - pRadius)/2), holeZ);
    createPhysBox((width/2 - holeX - pRadius), pRadius * 2, (holeX + pRadius + (width/2 - holeX - pRadius)/2), holeZ);

    // Fundo do Buraco (caixa) onde a bola cai e repousa
    const cupBody = new CANNON.Body({ mass: 0, material: physMat });
    cupBody.addShape(new CANNON.Box(new CANNON.Vec3(holeRadius, 1.5 / 2, holeRadius)));
    cupBody.position.set(holeX, -1.5, holeZ); 
    world.addBody(cupBody);
    
    const cupMesh = new THREE.Mesh(new THREE.BoxGeometry(holeRadius * 2, 1.5, holeRadius * 2), cupMat);
    cupMesh.position.copy(cupBody.position);
    scene.add(cupMesh);
    levelMeshes.push({ mesh: cupMesh, body: cupBody });

    // Mastro da Bandeira (Apenas Visual)
    const poleGeom = new THREE.CylinderGeometry(0.04, 0.04, 4, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 });
    const poleMesh = new THREE.Mesh(poleGeom, poleMat);
    poleMesh.position.set(holeX, 2, holeZ); // Base no chão (y=0) e sobe até y=4
    poleMesh.castShadow = true;
    scene.add(poleMesh);
    levelMeshes.push({ mesh: poleMesh, body: null });

    // Pano da Bandeira (Triângulo vermelho)
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(1.2, -0.35); // Bico do triângulo apontado para o lado
    flagShape.lineTo(0, -0.7);
    flagShape.lineTo(0, 0);
    const flagGeom = new THREE.ExtrudeGeometry(flagShape, { depth: 0.02, bevelEnabled: false });
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.4 });
    const flagMesh = new THREE.Mesh(flagGeom, flagMat);
    flagMesh.position.set(holeX, 3.9, holeZ - 0.01); // Centrado no topo do mastro
    flagMesh.name = "holeFlag";
    flagMesh.castShadow = true;
    scene.add(flagMesh);
    levelMeshes.push({ mesh: flagMesh, body: null });
}

// Lógica auxiliar para construir as paredes e obstáculos 
function createWall(scene, world, w, h, d, x, y, z, mat, physMat, levelMeshes, rotY = 0, rotX = 0) {
    // Parte visual (three.js)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (rotY !== 0) mesh.rotation.y = rotY;
    if (rotX !== 0) mesh.rotation.x = rotX;
    scene.add(mesh);

    // Parte física (cannon.js)
    const body = new CANNON.Body({ mass: 0, material: physMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
    body.position.set(x, y, z);
    
    // Aplica a rotação à física se necessário (ex: Rampas)
    if (rotY !== 0 || rotX !== 0) {
        const q = new CANNON.Quaternion();
        q.setFromEuler(rotX, rotY, 0, 'XYZ');
        body.quaternion.copy(q);
    }
    
    world.addBody(body);
    levelMeshes.push({ mesh, body });
}

// Definição dos buracos do percurso
export const courseHoles = [
    {
        // Identificação e regras do buraco
        id: 1,
        name: "Buraco 1 · O Bloqueio",
        par: 2, // Par atualizado consoante a dificuldade
        startPos: new CANNON.Vec3(0, 2, 8),    // Posição inicial da bola
        holePos: new CANNON.Vec3(0, -1.5, -7), // Posição alvo do buraco
        holeRadius: 0.76, 

        // Construção dos elementos 3D deste nível específico
        build: (scene, world, mats, levelMeshes) => {
            // Base do nível
            buildLevelLayout(scene, world, mats, levelMeshes, 10, 20, 0, -7, 0.76);
            
            // Paredes (Topo, Fundo, Esquerda, Direita)
            createWall(scene, world, 10, 2, 1, 0, 0.5, -10.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 10, 2, 1, 0, 0.5, 10.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 22, -5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 22, 5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            
            // Obstáculo: Parede no centro para impedir um tiro 100% reto
            createWall(scene, world, 6, 2, 1, 0, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
        }
    },
    {
        id: 2,
        name: "Buraco 2 · A Curva em L",
        par: 3,
        startPos: new CANNON.Vec3(5, 2, 7),
        holePos: new CANNON.Vec3(-5, -1.5, -5),
        holeRadius: 0.76, 
        build: (scene, world, mats, levelMeshes) => {
            // Criamos uma base maior (20x20) e cortamos um canto com uma parede grande para fazer o "L"
            buildLevelLayout(scene, world, mats, levelMeshes, 20, 20, -5, -5, 0.76);
            createWall(scene, world, 20, 2, 1, 0, 0.5, -10.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 20, 2, 1, 0, 0.5, 10.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 22, -10.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 22, 10.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            
            // O Bloco que esconde o quadrante inferior esquerdo (forma o L interno)
            createWall(scene, world, 10, 2, 10, -5, 0.5, 5, mats.wallMat, mats.wallPhysMat, levelMeshes);
        }
    },
    {
        id: 3,
        name: "Buraco 3 · O Salto",
        par: 3,
        startPos: new CANNON.Vec3(0, 2, 12),
        holePos: new CANNON.Vec3(0, -1.5, -12),
        holeRadius: 0.76, 
        build: (scene, world, mats, levelMeshes) => {
            buildLevelLayout(scene, world, mats, levelMeshes, 10, 30, 0, -12, 0.76);
            createWall(scene, world, 10, 2, 1, 0, 0.5, -15.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 10, 2, 1, 0, 0.5, 15.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 32, -5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 32, 5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            
            // O Obstáculo (barreira horizontal)
            createWall(scene, world, 10, 1.5, 1, 0, 0.75, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            
            // A Rampa (usa um ângulo rotX de -Math.PI / 8) usando o chão e a física sem fricção da rampa
            createWall(scene, world, 6, 0.2, 5, 0, 0.5, 3, mats.floorMat, mats.rampPhysMat, levelMeshes, 0, Math.PI / 8);
        }
    },
    {
        id: 4,
        name: "Buraco 4 · A Agulha",
        par: 2,
        startPos: new CANNON.Vec3(0, 2, 12),
        holePos: new CANNON.Vec3(0, -1.5, -12),
        holeRadius: 0.76, 
        build: (scene, world, mats, levelMeshes) => {
            buildLevelLayout(scene, world, mats, levelMeshes, 10, 30, 0, -12, 0.76);
            createWall(scene, world, 10, 2, 1, 0, 0.5, -15.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 10, 2, 1, 0, 0.5, 15.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 32, -5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 32, 5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            
            // Obstáculo: Parede sólida com um buraco circular off-center
            const wallShape = new THREE.Shape();
            wallShape.moveTo(-5, 0); wallShape.lineTo(5, 0); wallShape.lineTo(5, 2); wallShape.lineTo(-5, 2); wallShape.lineTo(-5, 0);
            
            const holePath = new THREE.Path();
            // Buraco deslocado (x = 2.5), junto ao chão (y = 0.4), raio justo para a bola (0.45)
            holePath.absarc(2.5, 0.4, 0.45, 0, Math.PI * 2, false);
            wallShape.holes.push(holePath);
            
            const extrudeSettings = { depth: 1, bevelEnabled: false };
            const wallGeom = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
            wallGeom.translate(0, 0, -0.5); // Centrar a profundidade da parede
            
            const wallMesh = new THREE.Mesh(wallGeom, mats.wallMat);
            wallMesh.position.set(0, 0, 0);
            wallMesh.castShadow = true; wallMesh.receiveShadow = true;
            scene.add(wallMesh);
            levelMeshes.push({ mesh: wallMesh, body: null });
            
            // Físicas invisíveis para envolver o buraco circular (Caixa Esq, Dir e Topo)
            const leftBody = new CANNON.Body({ mass: 0, material: mats.wallPhysMat });
            leftBody.addShape(new CANNON.Box(new CANNON.Vec3(7.05/2, 2/2, 1/2)));
            leftBody.position.set(-1.475, 1, 0); world.addBody(leftBody);
            const rightBody = new CANNON.Body({ mass: 0, material: mats.wallPhysMat });
            rightBody.addShape(new CANNON.Box(new CANNON.Vec3(2.05/2, 2/2, 1/2)));
            rightBody.position.set(3.975, 1, 0); world.addBody(rightBody);
            const topBody = new CANNON.Body({ mass: 0, material: mats.wallPhysMat });
            topBody.addShape(new CANNON.Box(new CANNON.Vec3(0.9/2, 1.15/2, 1/2)));
            topBody.position.set(2.5, 1.425, 0); world.addBody(topBody);
        }
    },
    {
        id: 5,
        name: "Buraco 5 · O Zigzag",
        par: 4,
        startPos: new CANNON.Vec3(-5, 2, 16),
        holePos: new CANNON.Vec3(5, -1.5, -16),
        holeRadius: 0.76, 
        build: (scene, world, mats, levelMeshes) => {
            // Mapa longo e largo (20x40)
            buildLevelLayout(scene, world, mats, levelMeshes, 20, 40, 5, -16, 0.76);
            createWall(scene, world, 20, 2, 1, 0, 0.5, -20.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 20, 2, 1, 0, 0.5, 20.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 42, -10.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 42, 10.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            
            // Paredes cruzadas para forçar 3 curvas apertadas
            createWall(scene, world, 13, 2, 1, -4, 0.5, 8, mats.wallMat, mats.wallPhysMat, levelMeshes); // Bloqueia da esq. para a dir.
            createWall(scene, world, 13, 2, 1, 4, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes); // Bloqueia da dir. para a esq.
            createWall(scene, world, 13, 2, 1, -4, 0.5, -8, mats.wallMat, mats.wallPhysMat, levelMeshes); // Bloqueia da esq. para a dir.
        }
    }
];