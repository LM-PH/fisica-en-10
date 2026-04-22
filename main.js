document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btn-start');
    const btnRegister = document.getElementById('btn-register');

    // Event Listeners for UI interaction
    btnStart.addEventListener('click', () => {
        // Efecto visual de pulsado
        btnStart.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            btnStart.style.transform = '';
            // Siempre mandamos a la pantalla de poner nickname (login) para iniciar misión
            window.location.href = 'login.html';
        }, 150);
    });

    btnRegister.addEventListener('click', () => {
        window.location.href = 'register.html';
    });

    const btnLeaderboard = document.getElementById('btn-leaderboard');
    if (btnLeaderboard) {
        btnLeaderboard.addEventListener('click', () => {
            window.location.href = 'leaderboard.html';
        });
    }
});

// --- Lógica de Música de Fondo ---
const bgMusic = new Audio('assets/audio/intro.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;

const musicToggle = document.getElementById('music-toggle');
let isMuted = false;

function toggleMusic() {
    if (bgMusic.paused) {
        bgMusic.play().catch(e => console.log("Interacción requerida"));
        musicToggle.classList.remove('muted');
        musicToggle.querySelector('.icon').innerText = '🔊';
    } else {
        bgMusic.pause();
        musicToggle.classList.add('muted');
        musicToggle.querySelector('.icon').innerText = '🔈';
    }
}

// Iniciar con interacción
document.addEventListener('click', () => {
    if (bgMusic.paused && !isMuted) {
        bgMusic.play().catch(e => console.log("Esperando clic..."));
    }
}, { once: true });

musicToggle?.addEventListener('click', (e) => {
    e.stopPropagation(); // Evitar que el clic del documento se active
    toggleMusic();
});
