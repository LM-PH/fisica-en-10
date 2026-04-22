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
            
            // If user exists, we might want to change register to 'Profile' or hide it
            // For now, let's keep it but enhance the UI
            btnRegister.textContent = 'Mi Perfil';
        } else {
            userInfo.style.display = 'none';
        }
    };

    // Initial check
    checkUser();

    // Event Listeners for UI interaction
    btnStart.addEventListener('click', () => {
        const storedUser = localStorage.getItem('user');
        
        if (!storedUser) {
            // No user found, send to registration
            alert('¡Espera! Necesitas crear un perfil antes de la misión.');
            window.location.href = 'register.html';
        } else {
            console.log('Iniciando juego para:', storedUser);
            // Add a button press effect
            btnStart.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btnStart.style.transform = '';
                // Redirect to game
                window.location.href = 'game.html';
            }, 100);
        }
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
