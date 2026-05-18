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
        best: parseInt(localStorage.getItem('best_streak')) || 0,
        active: false,
        timer: null,
        questions: [],
        currentQ: null,
        recentIds: [],      // historial anti-repetición reciente
        correctIds: [],     // preguntas ya respondidas correctamente en esta sesión
        correctText: '',    // texto de la respuesta correcta (tras shuffle)
        endTime: 0,
        missionEnded: false,
        allQuestions: []
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

    // ─────────────────────────────────────────────────────────
    // 4. Guardar resultado en Firestore
    // ─────────────────────────────────────────────────────────
    const saveResult = async (val) => {
        if (!db || nickname === 'Jugador') return;
        const numVal = parseInt(val) || 0;
        if (numVal <= 0) return;

        try {
            // Registrar la partida siempre
            await db.collection('partidas').add({
                nickname,
                puntaje: numVal,
                fecha: new Date().toISOString()
            });

            // Comparar contra Firestore (fuente de verdad entre dispositivos)
            const userDoc = await db.collection('usuarios').doc(nickname).get();
            if (userDoc.exists) {
                const firestoreBest = parseInt(userDoc.data().mejorRacha) || 0;
                if (numVal > firestoreBest) {
                    await db.collection('usuarios').doc(nickname).update({ mejorRacha: numVal });
                    localStorage.setItem('best_streak', numVal);
                    gameState.best = numVal;
                    els.best.textContent = numVal;
                }
            }
        } catch (e) {
            console.error('❌ Error al guardar resultado en Firestore:', e);
        }
    };

    // ─────────────────────────────────────────────────────────
    // 5. Fin de misión
    // ─────────────────────────────────────────────────────────
    const endMission = (reason) => {
        if (gameState.missionEnded) return;  // evitar doble llamada
        gameState.missionEnded = true;
        gameState.active = false;
        if (gameState.timer) clearInterval(gameState.timer);

        const title    = els.gameOverModal.querySelector('h2');
        const subtitle = els.gameOverModal.querySelector('.modal-subtitle');

        if (reason === 'perfect') {
            title.textContent = '¡TEMA COMPLETADO!';
            if (subtitle) subtitle.textContent = `¡Terminaste todas las preguntas de ${selectedCategory}!`;

            // Ocultar botón reintentar y mostrar solo inicio
            const btnRestart = document.getElementById('btn-restart');
            if (btnRestart) btnRestart.style.display = 'none';
        } else {
            // Si pierden (por tiempo, error, o salida), se reinician las preguntas
            if (selectedCategory) {
                localStorage.removeItem(`fisica_correct_${nickname}_${selectedCategory}`);
            }
            gameState.correctIds = [];

            const btnRestart = document.getElementById('btn-restart');
            if (btnRestart) btnRestart.style.display = '';
            if (reason === 'timeout')   title.textContent = '¡TIEMPO AGOTADO!';
            else if (reason === 'away') title.textContent = '¡SALISTE DE LA MISIÓN!';
            else                        title.textContent = '¡MISIÓN FALLIDA!';
            if (subtitle) subtitle.textContent = '';
        }

        els.finalScore.textContent  = gameState.totalCorrect;
        els.finalStreak.textContent = gameState.streak;

        els.gameOverModal.classList.remove('hidden');

        if (gameState.streak > 0) saveResult(gameState.streak);
    };

    // ─────────────────────────────────────────────────────────
    // 6. Detectar bloqueo de pantalla / cambio de pestaña / cierre
    // ─────────────────────────────────────────────────────────

    // Cuando el alumno minimiza, bloquea el cel o cambia de app
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameState.active) {
            endMission('away');
        }
    });

    // Cuando el alumno cierra la pestaña o navega fuera (desktop)
    window.addEventListener('pagehide', () => {
        if (gameState.active) {
            // pagehide no es async, usamos sendBeacon para guardar en Firestore
            // Como fallback, guardamos en localStorage para recuperación posterior
            if (gameState.streak > 0) {
                localStorage.setItem('pending_streak', JSON.stringify({
                    nickname,
                    streak: gameState.streak,
                    fecha: new Date().toISOString()
                }));
            }
            endMission('away');
        }
    });

    // ─────────────────────────────────────────────────────────
    // 7. Recuperar racha pendiente (si la página se cerró antes de guardar)
    // ─────────────────────────────────────────────────────────
    const recoverPendingStreak = async () => {
        const pendingRaw = localStorage.getItem('pending_streak');
        if (!pendingRaw || !db || nickname === 'Jugador') return;

        try {
            const pending = JSON.parse(pendingRaw);
            if (pending.nickname === nickname && pending.streak > 0) {
                console.log(`🔄 Recuperando racha pendiente: ${pending.streak}`);
                await saveResult(pending.streak);
            }
        } catch (e) {
            console.error('Error al recuperar racha pendiente:', e);
        } finally {
            localStorage.removeItem('pending_streak');
        }
    };

    // ─────────────────────────────────────────────────────────
    // 8. Timer
    // ─────────────────────────────────────────────────────────
    const runTimer = () => {
        if (gameState.timer) clearInterval(gameState.timer);
        const DURATION = 10000;
        gameState.endTime = Date.now() + DURATION;

        gameState.timer = setInterval(() => {
            if (!gameState.active) return;

            const now  = Date.now();
            const left = gameState.endTime - now;

            if (left <= 0) {
                clearInterval(gameState.timer);
                endMission('timeout');
                return;
            }

            const pct = (left / DURATION) * 100;
            els.timerBar.style.width = `${pct}%`;
            els.timerText.textContent = `${Math.ceil(left / 1000)}s`;

            els.timerBar.style.background = left < 3000
                ? '#ff4444'
                : 'linear-gradient(90deg, #39ff14, #00f2ff)';
        }, 50);
    };

    // ─────────────────────────────────────────────────────────
    // 9. Siguiente pregunta
    // ─────────────────────────────────────────────────────────

    // Mezcla un array con Fisher-Yates (in-place)
    const shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    const nextQuestion = () => {
        if (!gameState.active) return;

        // 1. Excluir preguntas ya contestadas correctamente en esta sesión
        const unanswered = gameState.questions.filter(
            q => !gameState.correctIds.includes(q.id)
        );

        // 🏆 Si no quedan preguntas sin contestar → ¡RACHA MÁXIMA!
        if (unanswered.length === 0) {
            endMission('perfect');
            return;
        }

        // 2. Preferir dificultad según racha, pero solo dentro de las no contestadas
        let pool = unanswered.filter(q => {
            if (gameState.streak < 3)  return (q.dificultad || 'Fácil') === 'Fácil';
            if (gameState.streak < 7)  return (q.dificultad || 'Media') === 'Media';
            return (q.dificultad || 'Difícil') === 'Difícil';
        });

        // Si no hay suficientes en la dificultad actual, usar todas las no contestadas
        if (pool.length < 2) pool = [...unanswered];

        // 3. Excluir las vistas recientemente (anti-repetición de corto plazo)
        const HISTORY_SIZE = Math.min(5, pool.length - 1);
        let available = HISTORY_SIZE > 0
            ? pool.filter(q => !gameState.recentIds.slice(-HISTORY_SIZE).includes(q.id))
            : pool;
        if (available.length === 0) available = [...pool];

        // 4. Elegir al azar
        const q = available[Math.floor(Math.random() * available.length)];
        gameState.currentQ = q;

        // Actualizar historial reciente
        gameState.recentIds.push(q.id);
        if (gameState.recentIds.length > 8) gameState.recentIds.shift();

        // 5. Guardar texto correcto antes de mezclar opciones
        let correctText = '';
        if (typeof q.correcta === 'number') {
            correctText = String(q.opciones[q.correcta] || '').trim().toLowerCase();
        } else {
            correctText = String(q.correcta).trim().toLowerCase();
        }
        gameState.correctText = correctText;

        // 6. Mostrar progreso: preguntas respondidas / total
        const progress = document.getElementById('q-progress');
        if (progress) {
            progress.textContent =
                `${gameState.correctIds.length} / ${gameState.questions.length} ✓`;
        }

        // 7. Mezclar opciones (anti-memorización de posición)
        const shuffledOpts = shuffle([...q.opciones]);

        // 8. Renderizar
        els.qText.textContent = q.pregunta;
        els.options.innerHTML = '';

        shuffledOpts.forEach(opt => {
            const b = document.createElement('button');
            b.className       = 'option-btn';
            b.textContent     = opt;
            b.dataset.optText = String(opt).trim().toLowerCase();
            b.onclick         = () => handleAnswer(b);
            els.options.appendChild(b);
        });

        runTimer();
    };

    // ─────────────────────────────────────────────────────────
    // 10. Respuesta del alumno
    // ─────────────────────────────────────────────────────────
    const handleAnswer = (btn) => {
        if (!gameState.active) return;
        if (gameState.timer) clearInterval(gameState.timer);

        const chosenText = btn.dataset.optText || '';
        const isCorrect  = chosenText === gameState.correctText;

        const all = document.querySelectorAll('.option-btn');
        all.forEach(b => b.style.pointerEvents = 'none');

        // Resaltar la respuesta correcta siempre
        all.forEach(b => {
            if ((b.dataset.optText || '') === gameState.correctText)
                b.classList.add('correct');
        });

        if (isCorrect) {
            // Marcar esta pregunta como respondida correctamente (no vuelve a aparecer)
            if (gameState.currentQ && !gameState.correctIds.includes(gameState.currentQ.id)) {
                gameState.correctIds.push(gameState.currentQ.id);
                if (selectedCategory) {
                    localStorage.setItem(`fisica_correct_${nickname}_${selectedCategory}`, JSON.stringify(gameState.correctIds));
                }
            }

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
            setTimeout(() => endMission('wrong'), 1000);
        }
    };

    // ─────────────────────────────────────────────────────────
    // 11. Inicialización
    // ─────────────────────────────────────────────────────────
    const init = async () => {
        els.startBtn.disabled    = true;
        els.startBtn.textContent = 'CONECTANDO...';

        try {
            // Recuperar racha pendiente del cierre anterior
            await recoverPendingStreak();

            // Cargar preguntas
            const snap = await db.collection('preguntas').get();
            gameState.allQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            gameState.questions = gameState.allQuestions;

            // Sincronizar mejor racha desde Firestore
            if (nickname !== 'Jugador') {
                const userDoc = await db.collection('usuarios').doc(nickname).get();
                if (userDoc.exists) {
                    const firestoreBest = parseInt(userDoc.data().mejorRacha) || 0;
                    if (firestoreBest > gameState.best) {
                        gameState.best = firestoreBest;
                        localStorage.setItem('best_streak', firestoreBest);
                        els.best.textContent = firestoreBest;
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error al iniciar:', e);
        }

        if (!gameState.questions || gameState.questions.length === 0) {
            gameState.questions = [{
                id: 'default',
                pregunta: '¿Qué fuerza nos mantiene en la Tierra?',
                opciones: ['Gravedad', 'Fricción', 'Magnetismo', 'Inercia'],
                correcta: 0
            }];
        }

        if (!selectedCategory) {
            els.startBtn.disabled = true;
        } else {
            els.startBtn.disabled = false;
        }
        els.startBtn.textContent = 'INICIAR MISIÓN';
    };

    // ─────────────────────────────────────────────────────────
    // 12. Botones
    // ─────────────────────────────────────────────────────────
    // Lógica para seleccionar categoría
    let selectedCategory = null;
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.onclick = () => {
            categoryBtns.forEach(b => {
                b.style.background = 'transparent';
                b.style.color = 'var(--neon-blue)';
            });
            btn.style.background = 'rgba(0, 242, 255, 0.2)';
            btn.style.color = '#fff';
            selectedCategory = btn.dataset.tema;
            if (els.startBtn.textContent !== 'CONECTANDO...') {
                els.startBtn.disabled = false;
            }
        };
    });

    els.startBtn.onclick = () => {
        if (!selectedCategory) return;

        // Cargar preguntas respondidas anteriormente en este tema
        const savedIds = localStorage.getItem(`fisica_correct_${nickname}_${selectedCategory}`);
        if (savedIds) {
            try {
                gameState.correctIds = JSON.parse(savedIds);
            } catch(e) {
                gameState.correctIds = [];
            }
        } else {
            gameState.correctIds = [];
        }

        // Filtrar preguntas por tema
        gameState.questions = gameState.allQuestions.filter(q => q.tema === selectedCategory);
        if (gameState.questions.length === 0) {
            gameState.questions = gameState.allQuestions; // fallback
        }

        els.startOverlay.classList.add('hidden');
        gameState.active       = true;
        gameState.missionEnded = false;
        nextQuestion();
    };

    document.getElementById('btn-restart').onclick = () => {
        els.gameOverModal.classList.add('hidden');
        gameState.streak       = 0;
        gameState.totalCorrect = 0;
        gameState.missionEnded = false;
        gameState.recentIds    = [];
        // No reseteamos correctIds para que no se repitan en esta sesión
        gameState.correctText  = '';
        els.streak.textContent = '0';
        gameState.active       = true;
        nextQuestion();
    };

    document.getElementById('btn-home').onclick = () => window.location.href = 'index.html';

    init();
});
