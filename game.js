document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

    let streak = 0;
    let totalCorrect = 0;
    let highScore = localStorage.getItem('best_streak') || 0;
    let sessionBest = 0;
    
    let timerInterval = null;
    let isGameOver = false;
    let gameActive = false;

    const nickname = localStorage.getItem('user') || 'Jugador';
    document.getElementById('game-nickname').textContent = nickname;

    const streakDisplay = document.getElementById('streak-val');
    const bestDisplay = document.getElementById('best-val');
    const timerBar = document.getElementById('timer-bar');
    const timerText = document.getElementById('timer-text');
    const questionText = document.getElementById('question-text');
    const optionsGrid = document.getElementById('options-grid');
    const startOverlay = document.getElementById('start-overlay');
    const btnRealStart = document.getElementById('btn-real-start');

    if(bestDisplay) bestDisplay.textContent = highScore;

    const clearGameTimer = () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    };

    const showGameOver = (reason) => {
        gameActive = false;
        clearGameTimer();
        isGameOver = true;
        
        const modal = document.getElementById('game-over-modal');
        const title = modal.querySelector('h2');
        const finalScoreDisplay = document.getElementById('final-score');
        const finalStreakDisplay = document.getElementById('final-streak');

        title.textContent = reason === 'timeout' ? '¡TIEMPO AGOTADO!' : '¡RESPUESTA INCORRECTA!';
        finalScoreDisplay.textContent = totalCorrect;
        finalStreakDisplay.textContent = sessionBest;

        modal.classList.remove('hidden');
        if (streak > 0) saveGameResult(streak);
    };

    // MEASURING TIME WITH SYSTEM CLOCK (FAIL-SAFE)
    const startTimer = () => {
        clearGameTimer();
        if (isGameOver || !gameActive) return;

        const DURATION = 10000; // 10 seconds in ms
        const startTime = Date.now();
        const endTime = startTime + DURATION;

        timerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = endTime - now;

            if (remaining <= 0) {
                clearGameTimer();
                timerBar.style.width = '0%';
                timerText.textContent = '0s';
                onTimeOut();
                return;
            }

            const percentage = (remaining / DURATION) * 100;
            timerBar.style.width = `${percentage}%`;
            timerText.textContent = `${Math.ceil(remaining / 1000)}s`;

            if (remaining <= 3000) {
                timerBar.style.background = '#ff4444';
                timerText.style.color = '#ff4444';
            } else {
                timerBar.style.background = 'linear-gradient(90deg, #39ff14, #00f2ff)';
                timerText.style.color = 'var(--neon-blue)';
            }
        }, 50);
    };

    const onTimeOut = () => {
        if (!gameActive) return;
        showGameOver('timeout');
    };

    let loadedQuestions = [];

    const fetchQuestions = async () => {
        try {
            const snapshot = await db.collection('preguntas').get();
            if (snapshot.empty) {
                loadedQuestions = [
                    { id: 'l1', q: "¿Cuál es la unidad de la fuerza?", options: ["Newton", "Joule", "Watt", "Pascal"], correct: 0, dificultad: 'Fácil' }
                ];
            } else {
                loadedQuestions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    q: doc.data().pregunta,
                    options: doc.data().opciones,
                    correct: doc.data().correcta,
                    dificultad: doc.data().dificultad || 'Fácil'
                }));
            }
            // Enable start button once questions are ready
            btnRealStart.disabled = false;
            btnRealStart.textContent = "¡INICIAR MISIÓN!";
        } catch (e) { console.error(e); }
    };

    const loadQuestion = () => {
        if (isGameOver || !gameActive || loadedQuestions.length === 0) return;

        clearGameTimer();

        let pool = loadedQuestions.filter(q => {
            if (streak < 3) return q.dificultad === 'Fácil';
            if (streak < 7) return q.dificultad === 'Media';
            return q.dificultad === 'Difícil';
        });

        if (pool.length === 0) pool = loadedQuestions;
        let available = pool.filter(q => q.id !== lastQuestionId);
        if (available.length === 0) available = pool;

        const currentQuestion = available[Math.floor(Math.random() * available.length)];
        lastQuestionId = currentQuestion.id;

        questionText.textContent = currentQuestion.q;
        optionsGrid.innerHTML = '';

        currentQuestion.options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => {
                if (!gameActive) return;
                checkAnswer(index, currentQuestion.correct, btn);
            };
            optionsGrid.appendChild(btn);
        });

        startTimer();
    };

    const checkAnswer = (index, correct, btn) => {
        clearGameTimer();
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');

        if (index === correct) {
            btn.classList.add('correct');
            streak++;
            totalCorrect++;
            if (streak > sessionBest) sessionBest = streak;
            streakDisplay.textContent = streak;

            if (streak > highScore) {
                highScore = streak;
                localStorage.setItem('best_streak', highScore);
                if (bestDisplay) bestDisplay.textContent = highScore;
                updateFirestoreScore(highScore);
            }
            setTimeout(loadQuestion, 1000);
        } else {
            btn.classList.add('wrong');
            allBtns[correct].classList.add('correct');
            setTimeout(() => showGameOver('incorrect'), 1000);
        }
    };

    const saveGameResult = async (finalStreak) => {
        if (!db || nickname === 'Jugador') return;
        try {
            await db.collection('partidas').add({
                nickname: nickname,
                puntaje: finalStreak,
                fecha: new Date().toISOString()
            });
        } catch (e) {}
    };

    const updateFirestoreScore = async (newScore) => {
        if (!db || nickname === 'Jugador') return;
        try {
            await db.collection('usuarios').doc(nickname).update({ mejorRacha: parseInt(newScore) });
        } catch (e) {}
    };

    // START FLOW
    btnRealStart.addEventListener('click', () => {
        startOverlay.classList.add('hidden');
        gameActive = true;
        isGameOver = false;
        loadQuestion();
    });

    document.getElementById('btn-restart').onclick = () => {
        document.getElementById('game-over-modal').classList.add('hidden');
        gameActive = true;
        isGameOver = false;
        streak = 0;
        totalCorrect = 0;
        streakDisplay.textContent = '0';
        loadQuestion();
    };

    document.getElementById('btn-home').onclick = () => window.location.href = 'index.html';

    btnRealStart.disabled = true;
    btnRealStart.textContent = "Cargando Preguntas...";
    fetchQuestions();
});
