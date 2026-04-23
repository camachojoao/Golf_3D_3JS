import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Função que calcula a física e o visual do chão de forma automática
function buildLevelLayout(scene, world, mats, levelMeshes, width, depth, holeX, holeZ, holeRadius) {
    const { floorMat, cupMat, physMat } = mats;

    // 1. Gráficos do Chão (Visual)
    const shape = new THREE.Shape();
    shape.moveTo(-width/2, -depth/2);
    shape.lineTo(width/2, -depth/2);
    shape.lineTo(width/2, depth/2);
    shape.lineTo(-width/2, depth/2);
    shape.lineTo(-width/2, -depth/2);

    const holePath = new THREE.Path();
    holePath.absarc(holeX, holeZ, holeRadius, 0, Math.PI * 2, false);
    shape.holes.push(holePath);

    const floorMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    levelMeshes.push({ mesh: floorMesh, body: null });

    // 2. Física do Chão (4 Caixas Invisíveis que deixam o buraco aberto)
    const thick = 1;
    const createPhysBox = (w, d, x, z) => {
        const body = new CANNON.Body({ mass: 0, material: physMat });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, thick/2, d/2)));
        body.position.set(x, -thick/2, z);
        world.addBody(body);
        levelMeshes.push({ mesh: null, body: body });
    };

    // Norte, Sul, Este, Oeste calculados milimetricamente para o buraco
    createPhysBox(width, (depth/2 + holeZ - holeRadius), 0, (holeZ - holeRadius - (depth/2 + holeZ - holeRadius)/2));
    createPhysBox(width, (depth/2 - holeZ - holeRadius), 0, (holeZ + holeRadius + (depth/2 - holeZ - holeRadius)/2));
    createPhysBox((width/2 + holeX - holeRadius), holeRadius * 2, (holeX - holeRadius - (width/2 + holeX - holeRadius)/2), holeZ);
    createPhysBox((width/2 - holeX - holeRadius), holeRadius * 2, (holeX + holeRadius + (width/2 - holeX - holeRadius)/2), holeZ);

    // 3. A Tua Caixa Preta (O Fundo do Buraco)
    // Altura 0.5, posição y = -0.45. O topo desta caixa fica a y = -0.2 (logo abaixo do chão).
    const cupBody = new CANNON.Body({ mass: 0, material: physMat });
    cupBody.addShape(new CANNON.Box(new CANNON.Vec3(holeRadius, 0.25, holeRadius)));
    cupBody.position.set(holeX, -0.45, holeZ); 
    world.addBody(cupBody);
    
    const cupMesh = new THREE.Mesh(new THREE.BoxGeometry(holeRadius*2, 0.5, holeRadius*2), cupMat);
    cupMesh.position.copy(cupBody.position);
    scene.add(cupMesh);
    levelMeshes.push({ mesh: cupMesh, body: cupBody });
}

function createWall(scene, world, w, h, d, x, y, z, mat, physMat, levelMeshes) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, material: physMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
    body.position.set(x, y, z);
    world.addBody(body);
    levelMeshes.push({ mesh, body });
}

export const courseHoles = [
    {
        id: 1,
        name: "Buraco 1 · Linha Reta",
        par: 2,
        startPos: new CANNON.Vec3(0, 2, 8),    // BOLA COMEÇA ATRÁS (Z=8)
        holePos: new CANNON.Vec3(0, -0.2, -7), // BURACO À FRENTE (Z=-7)
        holeRadius: 0.76, 
        build: (scene, world, mats, levelMeshes) => {
            buildLevelLayout(scene, world, mats, levelMeshes, 10, 20, 0, -7, 0.76);
            // Paredes
            createWall(scene, world, 10, 2, 1, 0, 0.5, -10.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 10, 2, 1, 0, 0.5, 10.5, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 22, -5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
            createWall(scene, world, 1, 2, 22, 5.5, 0.5, 0, mats.wallMat, mats.wallPhysMat, levelMeshes);
        }
    }
];