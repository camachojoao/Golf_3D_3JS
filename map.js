import * as THREE from 'three';
import * as CANNON from 'cannon-es';


export function buildMap(scene, world, physicsMaterial, wallPhysicsMaterial, rampPhysicsMaterial, meshesToUpdate) {
    // Materias para o chão, paredes e buraco
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50, side: THREE.DoubleSide });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8D6E63 }); 
    const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });  

    // Adicionámos um parâmetro "invisible" para criar colisões sem gráficos
    function createBox(w, h, d, x, y, z, mat, mass = 0, rotX = 0, customPhysMat = physicsMaterial, invisible = false) {
        let mesh = null;
        if (!invisible) {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
        
        // Corpo das físicas do jogo
        const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));
        const body = new CANNON.Body({ mass: mass, material: customPhysMat });
        body.addShape(shape);
        body.position.set(x, y, z);
        
        if (rotX !== 0) body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), rotX);
        world.addBody(body);
        
        if (!invisible) meshesToUpdate.push({ mesh, body });
    }

    // Chão e buraco de golf (tamanho baseado no tamanho de buracos para o tamanho de bolas reais)
    const floorShape = new THREE.Shape();
    floorShape.moveTo(-10, -10); floorShape.lineTo(10, -10); floorShape.lineTo(10, 10); floorShape.lineTo(-10, 10); floorShape.lineTo(-10, -10);

    // Criação do buraco
    const holeRadius = 0.76;
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
    floorShape.holes.push(holePath);

    // Adição da parte visual do chão
    const floorVisual = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), floorMaterial);
    floorVisual.rotation.x = -Math.PI / 2;
    floorVisual.receiveShadow = true;
    scene.add(floorVisual);

    // Física do chão (colisões com a bola)
    // O buraco físico será um quadrado calculado dinamicamente face ao buraco visual.
    // Usamos o fator de 0.9 (pRadius) para garantir um cair suave e sem ressaltos.
    const pRadius = holeRadius * 0.9;
    const depthZ = 10 - pRadius;
    const posZ = 5 + pRadius / 2;
    const widthX = 10 - pRadius;
    const posX = 5 + pRadius / 2;

    createBox(20, 1, depthZ,   0, -0.5, -posZ, floorMaterial, 0, 0, physicsMaterial, true); // Norte
    createBox(20, 1, depthZ,   0, -0.5,  posZ, floorMaterial, 0, 0, physicsMaterial, true); // Sul
    createBox(widthX, 1, pRadius * 2, -posX, -0.5,   0, floorMaterial, 0, 0, physicsMaterial, true); // Oeste
    createBox(widthX, 1, pRadius * 2,  posX, -0.5,   0, floorMaterial, 0, 0, physicsMaterial, true); // Este

    // Caixa debaixo do buraco para apanhar a bola e fazer o buraco parecer uma "cova"
    createBox(holeRadius * 2, 1.5, holeRadius * 2, 0, -1.5, 0, holeMaterial);

    // Criação das paredes (atualizado para não terem fricção que antes bugava a bola a passar rasteira)
    createBox(20, 2, 1,    0, 0.5, -10.5, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(20, 2, 1,    0, 0.5,  10.5, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(1,  2, 22, -10.5, 0.5,   0, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(1,  2, 22,  10.5, 0.5,   0, wallMaterial, 0, 0, wallPhysicsMaterial); 

    // Rampa para testar físicas verticais e porque é fixe
    createBox(4, 0.1, 8, -5, 0.3, -6, floorMaterial, 0, -Math.PI / 8, rampPhysicsMaterial);

    // Mastro da Bandeira no buraco de treino (Apenas Visual)
    const poleGeom = new THREE.CylinderGeometry(0.04, 0.04, 4, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 });
    const poleMesh = new THREE.Mesh(poleGeom, poleMat);
    poleMesh.position.set(0, 2, 0); // Buraco no map.js está em x=0, z=0
    poleMesh.castShadow = true;
    scene.add(poleMesh);
    meshesToUpdate.push({ mesh: poleMesh, body: null });

    // Pano da Bandeira (Triângulo vermelho)
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(1.2, -0.35); 
    flagShape.lineTo(0, -0.7);
    flagShape.lineTo(0, 0);
    const flagGeom = new THREE.ExtrudeGeometry(flagShape, { depth: 0.02, bevelEnabled: false });
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.4 });
    const flagMesh = new THREE.Mesh(flagGeom, flagMat);
    flagMesh.position.set(0, 3.9, -0.01); 
    flagMesh.name = "holeFlag";
    flagMesh.castShadow = true;
    scene.add(flagMesh);
    meshesToUpdate.push({ mesh: flagMesh, body: null });
}