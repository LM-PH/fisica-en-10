document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = firebase.firestore();

    const form = document.getElementById('register-form');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    const avatarInput = document.getElementById('selected-avatar');
    const nicknameInput = document.getElementById('nickname');
    const checkMsg = document.getElementById('check-msg');

    // Avatar Selection logic
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            avatarInput.value = option.dataset.avatar;
        });
    });

    // Just a quick check to see if nickname is taken as they type
    nicknameInput.addEventListener('input', () => {
        const nick = nicknameInput.value.trim();
        if (nick.length < 3) {
            checkMsg.textContent = '';
            return;
        }

        db.collection('usuarios').doc(nick).get().then(doc => {
            if (doc.exists) {
                checkMsg.textContent = 'Nickname ya ocupado ⚠️';
                checkMsg.style.color = '#ff4444';
            } else {
                checkMsg.textContent = 'Nickname disponible ✅';
                checkMsg.style.color = 'var(--neon-green)';
            }
        });
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nick = nicknameInput.value.trim();
        const avatar = avatarInput.value;

        if (!avatar) {
            alert('¡Elige un avatar antes de despegar!');
            return;
        }

        const userData = {
            nombre: document.getElementById('nombre').value,
            correo: document.getElementById('correo').value,
            grado: document.getElementById('grado').value,
            grupo: document.getElementById('grupo').value,
            nickname: nick,
            avatar: avatar,
            mejorRacha: 0,
            createdAt: new Date().toISOString()
        };

        try {
            // Check availability again before saving
            const doc = await db.collection('usuarios').doc(nick).get();
            if (doc.exists) {
                alert('Este nickname ya está en uso. Elige otro por favor.');
                return;
            }

            // Save to Firebase
            await db.collection('usuarios').doc(nick).set(userData);

            // Save to local storage for automatic login
            localStorage.setItem('user', nick);
            
            alert('¡Registro exitoso, Piloto ' + nick + '!');
            window.location.href = 'game.html';

        } catch (error) {
            console.error("Error al registrar:", error);
            alert('Error en la comunicación con la base de datos de la NASA.');
        }
    });
});
