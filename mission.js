document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración Inicial
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

    // 2. Estado del Juego
    let gameState = {
        streak: 0,
        totalCorrect: 0,
        best: localStorage.getItem('best_streak') || 0,
        active: false,
        timer: null,
        questions: [],
        currentQ: null,
        lastId: null,
        endTime: 0
    };

    // 3. Elementos del DOM
    const els = {
        nick: document.getElementById('game-nickname'),
        streak: document.getElementById('streak-val'),
        best: document.getElementById('best-val'),
        qText: document.getElementById('question-text'),
        options: document.getElementById('options-grid'),
        timerBar: document.getElementById('timer-bar'),
        timerText: document.getElementById('timer-text'),
        startOverlay: document.getElementById('start-overlay'),
        startBtn: document.getElementById('btn-real-start'),
        gameOverModal: document.getElementById('game-over-modal'),
        finalScore: document.getElementById('final-score'),
        finalStreak: document.getElementById('final-streak')
    };

    const nickname = localStorage.getItem('user') || 'Jugador';
    els.nick.textContent = nickname;
    els.best.textContent = gameState.best;

    // 4. Funciones de Control
    const endMission = (reason) => {
        gameState.active = false;
        if (gameState.timer) clearInterval(gameState.timer);
        
        const title = els.gameOverModal.querySelector('h2');
        title.textContent = reason === 'timeout' ? '¡TIEMPO AGOTADO!' : '¡MISIÓN FALLIDA!';
        els.finalScore.textContent = gameState.totalCorrect;
        els.finalStreak.textContent = gameState.streak;
        
        els.gameOverModal.classList.remove('hidden');
        
        if (gameState.streak > 0) saveResult(gameState.streak);
    };

    const saveResult = async (val) => {
        if (!db || nickname === 'Jugador') return;
        try {
            await db.collection('partidas').add({
                nickname, puntaje: val, fecha: new Date().toISOString()
            });
            if (val > gameState.best) {
                await db.collection('usuarios').doc(nickname).update({ mejorRacha: val });
            }
        } catch (e) {}
    };

    const runTimer = () => {
        if (gameState.timer) clearInterval(gameState.timer);
        const DURATION = 10000;
        gameState.endTime = Date.now() + DURATION;

        gameState.timer = setInterval(() => {
            if (!gameState.active) return;
            
            const now = Date.now();
            const left = gameState.endTime - now;

            if (left <= 0) {
                clearInterval(gameState.timer);
                endMission('timeout');
                return;
            }

            const pct = (left / DURATION) * 100;
            els.timerBar.style.width = `${pct}%`;
            els.timerText.textContent = `${Math.ceil(left / 1000)}s`;

            if (left < 3000) {
                els.timerBar.style.background = '#ff4444';
            } else {
                els.timerBar.style.background = 'linear-gradient(90deg, #39ff14, #00f2ff)';
            }
        }, 50);
    };

    const nextQuestion = () => {
        if (!gameState.active) return;

        // Filtrar dificultad
        let pool = gameState.questions.filter(q => {
            if (gameState.streak < 3) return (q.dificultad || 'Fácil') === 'Fácil';
            if (gameState.streak < 7) return (q.dificultad || 'Media') === 'Media';
            return (q.dificultad || 'Difícil') === 'Difícil';
        });

        if (pool.length === 0) pool = gameState.questions;
        let available = pool.filter(q => q.id !== gameState.lastId);
        if (available.length === 0) available = pool;

        const q = available[Math.floor(Math.random() * available.length)];
        gameState.currentQ = q;
        gameState.lastId = q.id;

        els.qText.textContent = q.pregunta;
        els.options.innerHTML = '';

        q.opciones.forEach((opt, i) => {
            const b = document.createElement('button');
            b.className = 'option-btn';
            b.textContent = opt;
            b.onclick = () => handleAnswer(i, b);
            els.options.appendChild(b);
        });

        runTimer();
    };

    const handleAnswer = (idx, btn) => {
        if (!gameState.active) return;
        if (gameState.timer) clearInterval(gameState.timer);

        const correctAns = gameState.currentQ.correcta;
        let idxCorrecta = -1;
        if (typeof correctAns === 'string') {
            idxCorrecta = gameState.currentQ.opciones.findIndex(
                opt => String(opt).trim().toLowerCase() === String(correctAns).trim().toLowerCase()
            );
        } else if (typeof correctAns === 'number') {
            idxCorrecta = correctAns;
        }

        const isCorrect = idx === idxCorrecta;
        const all = document.querySelectorAll('.option-btn');
        all.forEach(b => b.style.pointerEvents = 'none');

        if (isCorrect) {
            btn.classList.add('correct');
            gameState.streak++;
            gameState.totalCorrect++;
            els.streak.textContent = gameState.streak;
            
            if (gameState.streak > gameState.best) {
                gameState.best = gameState.streak;
                els.best.textContent = gameState.best;
                localStorage.setItem('best_streak', gameState.best);
            }
            setTimeout(nextQuestion, 800);
        } else {
            btn.classList.add('wrong');
            if (idxCorrecta !== -1 && all[idxCorrecta]) {
                all[idxCorrecta].classList.add('correct');
            }
            setTimeout(() => endMission('wrong'), 1000);
        }
    };

    // 5. Inicio Real
    const init = async () => {
        els.startBtn.disabled = true;
        els.startBtn.textContent = "CONECTANDO...";
        
        try {
            const snap = await db.collection('preguntas').get();
            gameState.questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Error al conectar con base de datos:", e);
            // El juego usará fallback si hay error y fallback vacío
        }
        
        if (!gameState.questions || gameState.questions.length === 0) {
            gameState.questions = [{
                id: 'default', pregunta: "¿Qué fuerza nos mantiene en la Tierra?",
                opciones: ["Gravedad", "Fricción", "Magnetismo", "Inercia"], correcta: 0
            }];
        }

        els.startBtn.disabled = false;
        els.startBtn.textContent = "INICIAR MISIÓN";
    };

    els.startBtn.onclick = () => {
        els.startOverlay.classList.add('hidden');
        gameState.active = true;
        nextQuestion();
    };

    document.getElementById('btn-restart').onclick = () => {
        els.gameOverModal.classList.add('hidden');
        gameState.streak = 0;
        gameState.totalCorrect = 0;
        els.streak.textContent = '0';
        gameState.active = true;
        nextQuestion();
    };

    document.getElementById('btn-home').onclick = () => window.location.href = 'index.html';

    init();
});
