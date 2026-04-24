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

    // Posicionamento exato das caixas: Norte, Sul, Este, Oeste
    createPhysBox(width, (depth/2 + holeZ - holeRadius), 0, (holeZ - holeRadius - (depth/2 + holeZ - holeRadius)/2));
    createPhysBox(width, (depth/2 - holeZ - holeRadius), 0, (holeZ + holeRadius + (depth/2 - holeZ - holeRadius)/2));
    createPhysBox((width/2 + holeX - holeRadius), holeRadius * 2, (holeX - holeRadius - (width/2 + holeX - holeRadius)/2), holeZ);
    createPhysBox((width/2 - holeX - holeRadius), holeRadius * 2, (holeX + holeRadius + (width/2 - holeX - holeRadius)/2), holeZ);

    // Fundo do Buraco (caixa) onde a bola cai e repousa
    const cupBody = new CANNON.Body({ mass: 0, material: physMat });
    cupBody.addShape(new CANNON.Box(new CANNON.Vec3(holeRadius, 0.25, holeRadius)));
    cupBody.position.set(holeX, -1.5, holeZ); 
    world.addBody(cupBody);
    
    const cupMesh = new THREE.Mesh(new THREE.BoxGeometry(holeRadius*2, 0.5, holeRadius*2), cupMat);
    cupMesh.position.copy(cupBody.position);
    scene.add(cupMesh);
    levelMeshes.push({ mesh: cupMesh, body: cupBody });
}

// Lógica auxiliar para construir as paredes
function createWall(scene, world, w, h, d, x, y, z, mat, physMat, levelMeshes) {
    // Parte visual (three.js)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);

    // Parte física (cannon.js)
    const body = new CANNON.Body({ mass: 0, material: physMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
    body.position.set(x, y, z);
    world.addBody(body);
    levelMeshes.push({ mesh, body });
}

// Definição dos buracos do percurso
export const courseHoles = [
    {
        // Identificação e regras do buraco
        id: 1,
        name: "Buraco 1 · Linha Reta",
        par: 2,
        startPos: new CANNON.Vec3(0, 2, 8),    // Posição inicial da bola
        holePos: new CANNON.Vec3(0, -1.7, -7), // Posição alvo do buraco
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
        }
    }
];