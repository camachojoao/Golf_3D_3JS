import { startGame } from './main.js';

// Elementos da UI
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');

const btnTraining = document.getElementById('btn-training');
const btnCourse = document.getElementById('btn-course');

const hudTraining = document.getElementById('hud-training');
const hudHole = document.getElementById('hud-hole');

const menuBtn = document.getElementById('menuBtn');
const closeMenuBtn = document.getElementById('close-menu-btn');
let isGameActive = false;

// Lógica do botão de Treino Livre
btnTraining.addEventListener('click', () => {
    if (isGameActive) {
        window.location.search = '?mode=training'; // Recarrega a página com o modo pretendido
        return;
    }
    isGameActive = true;
    // Esconder o menu e mostrar a UI do jogo
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    hudTraining.style.display = 'block'; // Mostra o banner de treino
    
    // Iniciar o mapa de treino (map.js)
    startGame('training');
});

// Lógica do botão de Percurso Completo
btnCourse.addEventListener('click', () => {
    if (isGameActive) {
        window.location.search = '?mode=course'; // Recarrega a página com o modo pretendido
        return;
    }
    isGameActive = true;
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    hudHole.style.display = 'block'; // Mostra o banner do Buraco 1
    
    // Iniciar o percurso (course.js)
    startGame('course');
});

// Verifica se a página foi recarregada com um modo específico na URL para o iniciar automaticamente
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'training') {
        window.history.replaceState({}, document.title, window.location.pathname); // Limpa o URL visualmente
        btnTraining.click();
    } else if (mode === 'course') {
        window.history.replaceState({}, document.title, window.location.pathname); // Limpa o URL visualmente
        btnCourse.click();
    }
});

// Lógica de abrir o menu a meio do jogo
menuBtn.addEventListener('click', () => {
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex'; // O CSS usa display: flex para centrar o menu
    closeMenuBtn.style.display = 'flex'; // Mostra o botão 'X'
});

// Lógica de fechar o menu e retomar o jogo
closeMenuBtn.addEventListener('click', () => {
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
});