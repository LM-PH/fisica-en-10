document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = firebase.firestore();

    const form = document.getElementById('register-form');
    const nicknameInput = document.getElementById('nickname');
    const extraFields = document.getElementById('extra-fields');
    const checkMsg = document.getElementById('check-msg');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    const avatarInput = document.getElementById('selected-avatar');
    const submitBtn = document.getElementById('submit-btn');

    let isNewUser = false;
    let checkTimeout;

    // Avatar Selection logic
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            avatarInput.value = option.dataset.avatar;
        });
    });

    // Smart Nickname check
    nicknameInput.addEventListener('input', () => {
        clearTimeout(checkTimeout);
        checkMsg.textContent = 'Buscando piloto en la NASA...';
        checkMsg.style.color = 'var(--neon-blue)';
        
        checkTimeout = setTimeout(async () => {
            const nick = nicknameInput.value.trim();
            if (nick.length < 3) {
                checkMsg.textContent = '';
                extraFields.classList.add('hidden');
                return;
            }

            try {
                const docRef = db.collection('usuarios').doc(nick);
                const doc = await docRef.get();

                if (doc.exists) {
                    const data = doc.data();
                    checkMsg.textContent = `¡Piloto reconocido! Bienvenido de nuevo.`;
                    checkMsg.style.color = 'var(--neon-green)';
                    extraFields.classList.add('hidden');
                    isNewUser = false;
                    submitBtn.textContent = 'INGRESAR A LA MISIÓN';
                } else {
                    checkMsg.textContent = 'Nuevo piloto detectado. Completa tu perfil.';
                    checkMsg.style.color = '#ffcc00';
                    extraFields.classList.remove('hidden');
                    isNewUser = true;
                    submitBtn.textContent = 'REGISTRAR Y COMENZAR';
                }
            } catch (error) {
                console.error("Error checking nick:", error);
            }
        }, 800);
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nick = nicknameInput.value.trim();

        if (isNewUser) {
            const userData = {
                nombre: document.getElementById('nombre').value || 'Anónimo',
                grado: document.getElementById('grado').value || '?',
                grupo: document.getElementById('grupo').value || '?',
                nickname: nick,
                avatar: avatarInput.value || 'avatar1.png',
                mejorRacha: 0,
                createdAt: new Date().toISOString()
            };

            try {
                await db.collection('usuarios').doc(nick).set(userData);
                localStorage.setItem('user', nick);
                window.location.href = 'game.html';
            } catch (error) {
                alert('No pudimos registrarte. Revisa tu conexión.');
            }
        } else {
            // Existing user, just login
            localStorage.setItem('user', nick);
            window.location.href = 'game.html';
        }
    });
});
