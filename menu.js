import { startGame } from './main.js';

// Elementos da UI
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');

const btnTraining = document.getElementById('btn-training');
const btnCourse = document.getElementById('btn-course');

const hudTraining = document.getElementById('hud-training');
const hudHole = document.getElementById('hud-hole');

// Lógica do botão de Treino Livre
btnTraining.addEventListener('click', () => {
    // Esconder o menu e mostrar a UI do jogo
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    hudTraining.style.display = 'block'; // Mostra o banner de treino
    
    // Iniciar o mapa de treino (map.js)
    startGame('training');
});

// Lógica do botão de Percurso Completo
btnCourse.addEventListener('click', () => {
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    hudHole.style.display = 'block'; // Mostra o banner do Buraco 1
    
    // Iniciar o percurso (course.js)
    startGame('course');
});