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
    createBox(20, 1, 8.8,   0, -0.5, -5.6, floorMaterial, 0, 0, physicsMaterial, true); // Norte
    createBox(20, 1, 8.8,   0, -0.5,  5.6, floorMaterial, 0, 0, physicsMaterial, true); // Sul
    createBox(8.8, 1, 2.4, -5.6, -0.5,   0, floorMaterial, 0, 0, physicsMaterial, true); // Oeste
    createBox(8.8, 1, 2.4,  5.6, -0.5,   0, floorMaterial, 0, 0, physicsMaterial, true); // Este

    // Caixa debaixo do buraco para apanhar a bola e fazer o buraco parecer uma "cova"
    createBox(2.4, 0.2, 2.4, 0, -1.5, 0, holeMaterial);

    // Criação das paredes (atualizado para não terem fricção que antes bugava a bola a passar rasteira)
    createBox(20, 2, 1,    0, 0.5, -10.5, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(20, 2, 1,    0, 0.5,  10.5, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(1,  2, 22, -10.5, 0.5,   0, wallMaterial, 0, 0, wallPhysicsMaterial); 
    createBox(1,  2, 22,  10.5, 0.5,   0, wallMaterial, 0, 0, wallPhysicsMaterial); 

    // Rampa para testar físicas verticais e porque é fixe
    createBox(4, 0.1, 8, -5, 0.3, -6, floorMaterial, 0, -Math.PI / 8, rampPhysicsMaterial);
}