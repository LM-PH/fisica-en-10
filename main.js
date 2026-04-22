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
