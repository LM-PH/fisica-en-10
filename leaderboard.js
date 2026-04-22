document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = firebase.firestore();
    const container = document.getElementById('leaderboard-container');

    try {
        // Fetch top 10 players by best_streak
        const querySnapshot = await db.collection('usuarios')
            .orderBy('best_streak', 'desc')
            .limit(10)
            .get();

        container.innerHTML = '';

        if (querySnapshot.empty) {
            container.innerHTML = '<div style="opacity: 0.5;">No hay registros aún. ¡Sé el primero!</div>';
            return;
        }

        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const score = data.best_streak || 0;
            const avatar = data.avatar || 'avatar1.png';
            
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.style.animation = `slide-up ${0.2 * rank}s ease-out`;
            
            item.innerHTML = `
                <div class="rank">#${rank}</div>
                <img src="public/avatars/${avatar}" class="player-avatar" alt="Avatar">
                <div class="player-info">
                    <span class="player-name">${data.nickname || 'Anónimo'}</span>
                    <span class="player-meta">${data.grado}°${data.grupo}</span>
                </div>
                <div class="score">${score}</div>
            `;
            
            container.appendChild(item);
            rank++;
        });

    } catch (error) {
        console.error("Error al cargar ranking:", error);
        container.innerHTML = '<div style="color: #ff4444;">Error al conectar con la base de datos de la NASA.</div>';
    }
});
