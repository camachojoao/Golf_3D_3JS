import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Recebemos o rampPhysicsMaterial
export function buildMap(scene, world, physicsMaterial, wallPhysicsMaterial, rampPhysicsMaterial, meshesToUpdate) {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50, side: THREE.DoubleSide });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8D6E63 }); 
    const cupMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });  

    // Adicionámos um parâmetro "invisible" para criar colisões sem gráficos
    function createBox(w, h, d, x, y, z, mat, mass = 0, rotX = 0, customPhysMat = physicsMaterial, invisible = false) {
        let mesh = null;
        if (!invisible) {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
        
        const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));
        const body = new CANNON.Body({ mass: mass, material: customPhysMat });
        body.addShape(shape);
        body.position.set(x, y, z);
        
        if (rotX !== 0) body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), rotX);
        world.addBody(body);
        
        if (!invisible) meshesToUpdate.push({ mesh, body });
    }

    // --- 1. CHÃO VISUAL COM PROPORÇÃO REAL (Coeficiente ~2.53) ---
    const floorShape = new THREE.Shape();
    floorShape.moveTo(-10, -10); floorShape.lineTo(10, -10); floorShape.lineTo(10, 10); floorShape.lineTo(-10, 10); floorShape.lineTo(-10, -10);

    const holeRadius = 0.76; // NOVO: Tamanho proporcional à bola (0.3 * 2.53)
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
    floorShape.holes.push(holePath);

    const floorVisual = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), floorMaterial);
    floorVisual.rotation.x = -Math.PI / 2;
    floorVisual.receiveShadow = true;
    scene.add(floorVisual);

    // --- 2. A FÍSICA DO CHÃO (Invisível) ---
    // Em vez de desenhar blocos, usamos o último parâmetro `true` para os tornar invisíveis
    createBox(20, 1, 8.8,   0, -0.5, -5.6, floorMaterial, 0, 0, physicsMaterial, true); // Norte
    createBox(20, 1, 8.8,   0, -0.5,  5.6, floorMaterial, 0, 0, physicsMaterial, true); // Sul
    createBox(8.8, 1, 2.4, -5.6, -0.5,   0, floorMaterial, 0, 0, physicsMaterial, true); // Oeste
    createBox(8.8, 1, 2.4,  5.6, -0.5,   0, floorMaterial, 0, 0, physicsMaterial, true); // Este

    // O Copo debaixo do buraco
    createBox(2.4, 0.2, 2.4, 0, -1.5, 0, cupMaterial);

    // As Paredes (Mantêm o material sem fricção)
    createBox(20, 2, 1,    0, 0.5, -10.5, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(20, 2, 1,    0, 0.5,  10.5, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(1,  2, 22, -10.5, 0.5,   0, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(1,  2, 22,  10.5, 0.5,   0, wallMaterial, 0, 0, wallPhysicsMaterial); 

    // A Rampa (Ajustada para não ter "degrau" na base)
    // Parâmetros: largura(4), espessura(0.1), profundidade(8), posX(-5), posY(0.3), posZ(-6)
    createBox(4, 0.1, 8, -5, 0.3, -6, floorMaterial, 0, -Math.PI / 8, rampPhysicsMaterial);
}