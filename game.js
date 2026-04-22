document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

    let streak = 0;
    let sessionBest = 0;
    let totalCorrect = 0;
    let highScore = localStorage.getItem('best_streak') || 0;
    let timerInterval;
    let timeLeft = 10;
    let currentQuestion = null;
    let lastQuestionId = null;

    const nickname = localStorage.getItem('user') || 'Jugador';
    document.getElementById('game-nickname').textContent = nickname;

    // Sync Firestore Best Score
    const updateFirestoreScore = async (newScore) => {
        if (!db || nickname === 'Jugador') return;
        try {
            await db.collection('usuarios').doc(nickname).update({
                mejorRacha: parseInt(newScore)
            });
            console.log('Récord actualizado');
        } catch (e) {
            console.error('Error al actualizar récord:', e);
        }
    };

    // Save Game Result Session
    const saveGameResult = async (finalStreak) => {
        if (!db || !nickname || nickname === 'Jugador' || finalStreak === 0) return;
        try {
            await db.collection('partidas').add({
                nickname: nickname,
                puntaje: finalStreak,
                rachaMax: finalStreak,
                fecha: new Date().toISOString()
            });
            console.log('Partida registrada');
        } catch (e) {
            console.error("Error al registrar partida:", e);
        }
    };

    // Show Game Over Screen
    const showGameOver = (reason) => {
        clearInterval(timerInterval);
        const modal = document.getElementById('game-over-modal');
        const title = modal.querySelector('h2');
        const finalScoreDisplay = document.getElementById('final-score');
        const finalStreakDisplay = document.getElementById('final-streak');

        title.textContent = reason === 'timeout' ? '¡TIEMPO AGOTADO!' : '¡RESPUESTA INCORRECTA!';
        finalScoreDisplay.textContent = totalCorrect;
        finalStreakDisplay.textContent = sessionBest;

        modal.classList.remove('hidden');
        saveGameResult(streak); // Save to DB
    };

    const restartGame = () => {
        document.getElementById('game-over-modal').classList.add('hidden');
        streak = 0;
        totalCorrect = 0;
        sessionBest = 0;
        streakDisplay.textContent = '0';
        loadQuestion();
    };

    // Update Progress by Theme
    const updateThemeProgress = async (theme, questionId) => {
        if (!db || !nickname || nickname === 'Jugador') return;
        const userRef = db.collection('usuarios').doc(nickname);
        
        try {
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(userRef);
                if (!doc.exists) return;

                const userData = doc.data();
                const progreso = userData.progresoTemas || {};
                const temaStats = progreso[theme] || { correctasUnicas: [], total: 0 };

                if (!temaStats.correctasUnicas.includes(questionId)) {
                    temaStats.correctasUnicas.push(questionId);
                }
                
                temaStats.total = temaStats.correctasUnicas.length;
                progreso[theme] = temaStats;

                transaction.update(userRef, { progresoTemas: progreso });
            });
            console.log(`Progreso en ${theme} sincronizado.`);
        } catch (e) {
            console.error("Error al actualizar progreso por tema:", e);
        }
    };

    const questionText = document.getElementById('question-text');
    const optionsGrid = document.getElementById('options-grid');
    const streakDisplay = document.getElementById('streak-val');
    const timerBar = document.getElementById('timer-bar');

    const showStreakMessage = (msg, color = 'var(--neon-blue)') => {
        const msgEl = document.createElement('div');
        msgEl.className = 'streak-message';
        msgEl.textContent = msg;
        msgEl.style.textShadow = `0 0 20px ${color}`;
        document.body.appendChild(msgEl);
        setTimeout(() => msgEl.remove(), 1500);
    };

    let loadedQuestions = [];

    const fetchQuestions = async () => {
        questionText.textContent = "Cargando preguntas desde la red neuronal...";
        if (!db) return;
        try {
            const snapshot = await db.collection('preguntas').get();
            if (snapshot.empty) {
                console.warn('No hay preguntas en Firestore, usando locales temporalmente.');
                loadedQuestions = [
                    { id: 'l1', q: "¿Cuál es la velocidad de la luz aproximadamente?", options: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"], correct: 0, dificultad: 'Fácil' },
                    { id: 'l2', q: "Segunda Ley de Newton se resume en:", options: ["E = mc²", "F = m * a", "a² + b² = c²", "V = d / t"], correct: 1, dificultad: 'Fácil' }
                ];
            } else {
                loadedQuestions = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        q: data.pregunta,
                        options: data.opciones,
                        correct: data.correcta,
                        tema: data.tema || 'General',
                        dificultad: data.dificultad || 'Fácil'
                    };
                });
            }
            loadQuestion();
        } catch (e) {
            console.error('Error cargando preguntas:', e);
            questionText.textContent = "Error de conexión con Firestore.";
        }
    };

    const timerText = document.getElementById('timer-text');
    const bestDisplay = document.getElementById('best-val');
    // Initialize Best Display
    if(bestDisplay) bestDisplay.textContent = highScore;

    const startTimer = () => {
        clearInterval(timerInterval);
        timeLeft = 10;
        timerBar.style.width = '100%';
        timerBar.style.background = 'linear-gradient(90deg, #39ff14, #00f2ff)';
        timerText.textContent = '10s';
        timerText.style.color = 'var(--neon-blue)';

        timerInterval = setInterval(() => {
            timeLeft -= 0.1;
            const percentage = (timeLeft / 10) * 100;
            timerBar.style.width = `${percentage}%`;

            // Update digital display
            timerText.textContent = `${Math.ceil(timeLeft)}s`;

            if (timeLeft <= 3) {
                timerBar.style.background = '#ff4444';
                timerText.style.color = '#ff4444';
            }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerText.textContent = '0s';
                onTimeOut();
            }
        }, 100);
    };

    const loadQuestion = () => {
        if (loadedQuestions.length === 0) return;

        // 1. Determinar dificultad objetivo según racha
        let targetDifficulty = 'Fácil';
        if (streak >= 3 && streak <= 5) targetDifficulty = 'Media';
        else if (streak >= 6) targetDifficulty = 'Difícil';

        // 2. Filtrar por dificultad
        let pool = loadedQuestions.filter(q => q.dificultad === targetDifficulty);
        
        // Fallback si no hay preguntas de esa dificultad aún
        if (pool.length === 0) pool = loadedQuestions;

        // 3. Evitar repetición consecutiva
        let available = pool.filter(q => q.id !== lastQuestionId);
        if (available.length === 0) available = pool; 

        const randomIndex = Math.floor(Math.random() * available.length);
        currentQuestion = available[randomIndex];
        lastQuestionId = currentQuestion.id;
        
        questionText.textContent = currentQuestion.q;
        optionsGrid.innerHTML = '';

        currentQuestion.options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => checkAnswer(index, btn);
            optionsGrid.appendChild(btn);
        });

        startTimer();
    };

    const checkAnswer = (index, btn) => {
        clearInterval(timerInterval);
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');

        if (index === currentQuestion.correct) {
            btn.classList.add('correct');
            streak++;
            totalCorrect++;
            if (streak > sessionBest) sessionBest = streak;

            // Feedback por racha
            if (streak === 3) showStreakMessage('¡Vas bien!', '#39ff14');
            if (streak === 5) showStreakMessage('¡Imparable!', '#00f2ff');
            if (streak === 8) showStreakMessage('¡Nivel experto!', '#ff00ff');
            
            // Check High Score
            if (streak > highScore) {
                highScore = streak;
                localStorage.setItem('best_streak', highScore);
                if(bestDisplay) bestDisplay.textContent = highScore;
                updateFirestoreScore(highScore);
            }
            
            streakDisplay.textContent = streak;
            updateThemeProgress(currentQuestion.tema, currentQuestion.id);
            setTimeout(loadQuestion, 1000);
        } else {
            btn.classList.add('wrong');
            allBtns[currentQuestion.correct].classList.add('correct');
            showGameOver('incorrect');
        }
    };

    const onTimeOut = () => {
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');
        if (currentQuestion) {
            const correctBtn = allBtns[currentQuestion.correct];
            if (correctBtn) correctBtn.classList.add('correct');
        }
        showGameOver('timeout');
    };

    // Modal Listeners
    document.getElementById('btn-restart').onclick = restartGame;
    document.getElementById('btn-home').onclick = () => window.location.href = 'index.html';

    // Start!
    fetchQuestions();
});
