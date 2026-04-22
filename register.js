document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = firebase.firestore();

    const form = document.getElementById('register-form');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    const avatarInput = document.getElementById('selected-avatar');

    // Avatar Selection logic
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            avatarInput.value = option.dataset.avatar;
        });
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validation
        const userData = {
            nombre: document.getElementById('nombre').value,
            grado: document.getElementById('grado').value,
            grupo: document.getElementById('grupo').value,
            nickname: document.getElementById('nickname').value,
            avatar: avatarInput.value,
            createdAt: new Date().toISOString()
        };

        if (!userData.avatar) {
            alert('Por favor selecciona un avatar (son geniales, no lo ignores)');
            return;
        }

        try {
            // Check if nickname already exists
            const docRef = db.collection('usuarios').doc(userData.nickname);
            const doc = await docRef.get();
            
            if (doc.exists) {
                alert('Este nickname ya está en uso. ¡Sé más original!');
                return;
            }

            // Save to Firebase using nickname as document ID
            await docRef.set(userData);

            // Save to LocalStorage
            localStorage.setItem('user', userData.nickname); // Primary display field
            localStorage.setItem('full_profile', JSON.stringify(userData));

            alert('¡Perfil guardado! Redirigiendo...');
            
            // Return to main screen
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Error al guardar:", error);
            alert('Hubo un problema al guardar. Revisa tu conexión.');
        }
    });
});
