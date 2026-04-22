document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = firebase.firestore();

    const leaderboardContainer = document.getElementById('leaderboard-container');
    const filterDisplay = document.getElementById('filter-display');
    const tabBtns = document.querySelectorAll('.tab-btn');

    // Get current user info from localStorage to know their grade/group
    const currentUserNick = localStorage.getItem('user');
    let currentUserProfile = null;

    if (currentUserNick) {
        try {
            const userDoc = await db.collection('usuarios').doc(currentUserNick).get();
            if (userDoc.exists) {
                currentUserProfile = userDoc.data();
            }
        } catch (e) { console.error("Error fetching local profile", e); }
    }

    const renderLeaderboard = (users, type) => {
        leaderboardContainer.innerHTML = '';
        
        if (users.length === 0) {
            leaderboardContainer.innerHTML = '<div class="loading-spinner">No hay datos en esta categoría aún.</div>';
            return;
        }

        // Display current filter context
        if (type === 'global') {
            filterDisplay.textContent = 'ESCUELA COMPLETA (TOP 50)';
        } else if (type === 'grado' && currentUserProfile) {
            filterDisplay.textContent = `COMPETENCIA DE ${currentUserProfile.grado}º GRADO`;
        } else if (type === 'grupo' && currentUserProfile) {
            filterDisplay.textContent = `SALÓN: ${currentUserProfile.grado}º ${currentUserProfile.grupo}`;
        } else {
            filterDisplay.textContent = 'REGÍSTRATE PARA VER RANKING DE TU GRADO';
        }

        users.forEach((data, index) => {
            const rankItem = document.createElement('div');
            rankItem.className = `leaderboard-item border-glow ${data.nickname === currentUserNick ? 'current-user-rank' : ''}`;
            
            const avatarImg = data.avatar ? `avatars/${data.avatar}` : 'avatars/avatar1.png';
            
            rankItem.innerHTML = `
                <div class="rank-number">#${index + 1}</div>
                <div class="user-pill">
                    <img src="${avatarImg}" class="player-avatar-small" alt="avatar">
                    <div class="user-meta">
                        <span class="user-nickname">${data.nickname}</span>
                        <span class="user-class">${data.grado || '?'}º ${data.grupo || '?'}</span>
                    </div>
                </div>
                <div class="user-score">${data.mejorRacha || 0} pts</div>
            `;
            leaderboardContainer.appendChild(rankItem);
        });
    };

    const fetchAndFilter = async (filterType) => {
        leaderboardContainer.innerHTML = '<div class="loading-spinner">Escaneando base de datos...</div>';
        
        try {
            // For simplicity and since school groups are small, we fetch all and sort in JS
            // This avoids "Query requires an Index" errors in Firebase Console
            const snapshot = await db.collection('usuarios').get();
            let allUsers = [];
            snapshot.forEach(doc => allUsers.push(doc.data()));

            // Initial sort by best score
            allUsers.sort((a, b) => (b.mejorRacha || 0) - (a.mejorRacha || 0));

            let filtered = [];
            if (filterType === 'global') {
                filtered = allUsers.slice(0, 50);
            } else if (filterType === 'grado') {
                if (!currentUserProfile) {
                    alert('Debes registrar tu perfil primero.');
                    return;
                }
                filtered = allUsers.filter(u => u.grado == currentUserProfile.grado).slice(0, 50);
            } else if (filterType === 'grupo') {
                if (!currentUserProfile) {
                    alert('Debes registrar tu perfil primero.');
                    return;
                }
                filtered = allUsers.filter(u => u.grado == currentUserProfile.grado && u.grupo == currentUserProfile.grupo).slice(0, 50);
            }

            renderLeaderboard(filtered, filterType);

        } catch (error) {
            console.error("Error al cargar ranking:", error);
            leaderboardContainer.innerHTML = '<div class="loading-spinner">Error al conectar con la base de datos.</div>';
        }
    };

    // Tab Listeners
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetchAndFilter(btn.dataset.filter);
        });
    });

    // Initial Load
    fetchAndFilter('global');
});
