document.addEventListener('DOMContentLoaded', () => {
    const userInfo = document.getElementById('user-info');
    const nicknameDisplay = document.getElementById('nickname-display');
    const btnStart = document.getElementById('btn-start');
    const btnRegister = document.getElementById('btn-register');

    // Logic to check local user
    const checkUser = () => {
        // We look for 'user' or 'nickname' in localStorage
        const storedUser = localStorage.getItem('user') || localStorage.getItem('nickname');
        
        if (storedUser) {
            nicknameDisplay.textContent = storedUser;
            userInfo.style.display = 'inline-block';
        } else {
            userInfo.style.display = 'none';
        }
    };

    // Initial check
    checkUser();

    // Event Listeners for UI interaction
    btnStart.addEventListener('click', () => {
        const storedUser = localStorage.getItem('user') || localStorage.getItem('nickname');
        
        // Efecto visual de pulsado
        btnStart.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            btnStart.style.transform = '';
            if (!storedUser) {
                // Si no hay usuario, vamos a la pantalla de registro/identificación
                window.location.href = 'register.html';
            } else {
                // Si ya existe, vamos directo a la acción
                window.location.href = 'game.html';
            }
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
