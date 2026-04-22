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
    let timerInterval = null;
    let timeLeft = 10;
    let currentQuestion = null;
    let lastQuestionId = null;
    let isGameOver = false;

    const nickname = localStorage.getItem('user') || 'Jugador';
    document.getElementById('game-nickname').textContent = nickname;

    const streakDisplay = document.getElementById('streak-val');
    const bestDisplay = document.getElementById('best-val');
    const timerBar = document.getElementById('timer-bar');
    const timerText = document.getElementById('timer-text');
    const questionText = document.getElementById('question-text');
    const optionsGrid = document.getElementById('options-grid');

    if(bestDisplay) bestDisplay.textContent = highScore;

    // Reset timer completely
    const clearEveryTimer = () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    };

    const showGameOver = (reason) => {
        clearEveryTimer();
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

    const saveGameResult = async (finalStreak) => {
        if (!db || nickname === 'Jugador') return;
        try {
            await db.collection('partidas').add({
                nickname: nickname,
                puntaje: finalStreak,
                fecha: new Date().toISOString()
            });
        } catch (e) { console.error(e); }
    };

    const updateFirestoreScore = async (newScore) => {
        if (!db || nickname === 'Jugador') return;
        try {
            await db.collection('usuarios').doc(nickname).update({ mejorRacha: parseInt(newScore) });
        } catch (e) { console.error(e); }
    };

    const startTimer = () => {
        clearEveryTimer();
        if (isGameOver) return;

        timeLeft = 10.0;
        timerBar.style.width = '100%';
        timerBar.style.background = 'linear-gradient(90deg, #39ff14, #00f2ff)';
        timerText.textContent = '10s';

        timerInterval = setInterval(() => {
            if (isGameOver) {
                clearEveryTimer();
                return;
            }

            timeLeft -= 0.1;
            
            if (timeLeft <= 0) {
                timeLeft = 0;
                clearEveryTimer();
                onTimeOut();
            }

            const percentage = (timeLeft / 10) * 100;
            timerBar.style.width = `${percentage}%`;
            timerText.textContent = `${Math.ceil(timeLeft)}s`;

            if (timeLeft <= 3) {
                timerBar.style.background = '#ff4444';
                timerText.style.color = '#ff4444';
            } else {
                timerText.style.color = 'var(--neon-blue)';
            }
        }, 100);
    };

    const onTimeOut = () => {
        if (isGameOver) return;
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');
        showGameOver('timeout');
    };

    let loadedQuestions = [];

    const fetchQuestions = async () => {
        try {
            const snapshot = await db.collection('preguntas').get();
            if (snapshot.empty) {
                loadedQuestions = [
                    { id: 'l1', q: "¿Cuál es la unidad de la fuerza?", options: ["Newton", "Joule", "Watt", "Pascal"], correct: 0, dificultad: 'Fácil', tema: 'Mecánica' }
                ];
            } else {
                loadedQuestions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    q: doc.data().pregunta,
                    options: doc.data().opciones,
                    correct: doc.data().correcta,
                    dificultad: doc.data().dificultad || 'Fácil',
                    tema: doc.data().tema || 'Física'
                }));
            }
            loadQuestion();
        } catch (e) {
            questionText.textContent = "Error al conectar con la base de datos.";
        }
    };

    const loadQuestion = () => {
        if (isGameOver || loadedQuestions.length === 0) return;

        clearEveryTimer();

        let pool = loadedQuestions.filter(q => {
            if (streak < 3) return q.dificultad === 'Fácil';
            if (streak < 7) return q.dificultad === 'Media';
            return q.dificultad === 'Difícil';
        });

        if (pool.length === 0) pool = loadedQuestions;
        let available = pool.filter(q => q.id !== lastQuestionId);
        if (available.length === 0) available = pool;

        currentQuestion = available[Math.floor(Math.random() * available.length)];
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
        clearEveryTimer();
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');

        if (index === currentQuestion.correct) {
            btn.classList.add('correct');
            streak++;
            totalCorrect++;
            if (streak > sessionBest) sessionBest = streak;
            streakDisplay.textContent = streak;

            if (streak > highScore) {
                highScore = streak;
                localStorage.setItem('best_streak', highScore);
                if(bestDisplay) bestDisplay.textContent = highScore;
                updateFirestoreScore(highScore);
            }

            setTimeout(loadQuestion, 1000);
        } else {
            btn.classList.add('wrong');
            allBtns[currentQuestion.correct].classList.add('correct');
            setTimeout(() => showGameOver('incorrect'), 1000);
        }
    };

    document.getElementById('btn-restart').onclick = () => {
        isGameOver = false;
        streak = 0;
        totalCorrect = 0;
        streakDisplay.textContent = '0';
        document.getElementById('game-over-modal').classList.add('hidden');
        loadQuestion();
    };

    document.getElementById('btn-home').onclick = () => window.location.href = 'index.html';

    fetchQuestions();
});
