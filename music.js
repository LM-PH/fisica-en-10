// music.js - Lógica de Música de Fondo (Global)
document.addEventListener('DOMContentLoaded', () => {
    // Escoger la canción dependiendo de si estamos en el juego o no
    const isGamePage = window.location.pathname.includes('game.html');
    const trackFile = isGamePage ? 'assets/audio/gameplay.mp3' : 'assets/audio/intro.mp3';
    
    const bgMusic = new Audio(trackFile);
    bgMusic.loop = true;
    bgMusic.volume = 0.5;

    const musicToggle = document.getElementById('music-toggle');
    
    // Leer estado de localStorage (por defecto no está muteado)
    let isMuted = localStorage.getItem('musicMuted') === 'true';

    // Configurar icono inicial
    if (musicToggle) {
        if (isMuted) {
            musicToggle.classList.add('muted');
            musicToggle.querySelector('.icon').innerText = '🔈';
        } else {
            musicToggle.classList.remove('muted');
            musicToggle.querySelector('.icon').innerText = '🔊';
        }
    }

    function playMusic() {
        if (!isMuted && bgMusic.paused) {
            bgMusic.play().catch(e => {
                console.log("Interacción requerida para reproducir música");
            });
        }
    }

    function toggleMusic() {
        if (bgMusic.paused) {
            isMuted = false;
            localStorage.setItem('musicMuted', 'false');
            bgMusic.play().catch(e => console.log("Interacción requerida"));
            if(musicToggle) {
                musicToggle.classList.remove('muted');
                musicToggle.querySelector('.icon').innerText = '🔊';
            }
        } else {
            bgMusic.pause();
            isMuted = true;
            localStorage.setItem('musicMuted', 'true');
            if(musicToggle) {
                musicToggle.classList.add('muted');
                musicToggle.querySelector('.icon').innerText = '🔈';
            }
        }
    }

    // Intentar reproducir si no está silenciado
    playMusic();

    // Reproducir en la primera interacción (si los navegadores bloquean el autoplay)
    document.addEventListener('click', () => {
        playMusic();
    }, { once: true });

    if (musicToggle) {
        musicToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar propagación al document
            toggleMusic();
        });
    }
});
