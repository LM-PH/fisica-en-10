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
        shownInAttempt: [],   // preguntas mostradas en el intento actual (se reinicia al fallar)
        correctIds: [],       // preguntas respondidas correctamente en el intento actual
        correctText: '',      // texto de la respuesta correcta (tras shuffle)
        completedTopics: [],  // temas completados sin fallar en esta sesión
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

        // Capturar valores antes de cualquier reset
        const earnedStreak = gameState.streak;
        const earnedTotal  = gameState.totalCorrect;
        const topicsAlreadyDone = gameState.completedTopics.length;

        const ALL_TOPICS = ['Pascal', 'Arquímedes', 'Energía', 'Electricidad', 'Electromagnetismo', 'Universo'];

        if (reason === 'perfect') {
            // Marcar el tema como completado
            if (selectedCategory && !gameState.completedTopics.includes(selectedCategory)) {
                gameState.completedTopics.push(selectedCategory);
            }

            const allDone = ALL_TOPICS.every(t => gameState.completedTopics.includes(t));

            if (allDone) {
                // ¡MISIÓN TOTAL COMPLETADA!
                title.textContent = '🏆 ¡MISIÓN TOTAL!';
                if (subtitle) subtitle.textContent =
                    `¡Completaste los ${ALL_TOPICS.length} temas con una racha de ${earnedStreak}! ¡Eres un genio!`;

                document.getElementById('btn-restart').style.display    = 'none';
                document.getElementById('btn-change-topic').style.display = 'none';
                document.getElementById('btn-reset-topic').style.display  = '';
                document.getElementById('btn-reset-topic').textContent     = 'JUGAR DE NUEVO';
            } else {
                title.textContent = '¡TEMA COMPLETADO!';
                const remaining = ALL_TOPICS.filter(t => !gameState.completedTopics.includes(t));
                if (subtitle) subtitle.textContent =
                    `¡Terminaste ${selectedCategory}! Racha: ${earnedStreak}. Selecciona el siguiente tema para continuar.`;

                document.getElementById('btn-restart').style.display    = 'none';
                document.getElementById('btn-change-topic').style.display = '';
                document.getElementById('btn-reset-topic').style.display  = 'none';
            }

            if (earnedStreak > 0) saveResult(earnedStreak);

        } else {
            // FALLO: reiniciar TODO — racha, temas completados y progreso de preguntas
            if (earnedStreak > 0) saveResult(earnedStreak);

            gameState.completedTopics = [];
            gameState.shownInAttempt  = [];
            gameState.correctIds      = [];
            gameState.streak          = 0;
            gameState.totalCorrect    = 0;
            els.streak.textContent    = '0';

            document.getElementById('btn-restart').style.display    = '';
            document.getElementById('btn-restart').textContent       = 'VOLVER A ELEGIR TEMA';
            document.getElementById('btn-change-topic').style.display = 'none';
            document.getElementById('btn-reset-topic').style.display  = 'none';

            if (reason === 'timeout')   title.textContent = '¡TIEMPO AGOTADO!';
            else if (reason === 'away') title.textContent = '¡SALISTE DE LA MISIÓN!';
            else                        title.textContent = '¡MISIÓN FALLIDA!';

            if (subtitle) {
                if (topicsAlreadyDone > 0) {
                    subtitle.textContent = `Habías completado ${topicsAlreadyDone} tema(s). Debes volver a empezar desde el principio.`;
                } else {
                    subtitle.textContent = `Debes responder todas las preguntas del tema sin fallar.`;
                }
            }
        }

        els.finalScore.textContent  = earnedTotal;
        els.finalStreak.textContent = earnedStreak;
        els.gameOverModal.classList.remove('hidden');
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

        // 1. Preguntas NO mostradas aún en este intento
        let pending = gameState.questions.filter(
            q => !gameState.shownInAttempt.includes(q.id)
        );

        // Si ya se mostraron todas → las preguntas correctas determinan el resultado
        if (pending.length === 0) {
            // Si el alumno respondió TODAS correctamente → ¡TEMA COMPLETADO!
            if (gameState.correctIds.length === gameState.questions.length) {
                endMission('perfect');
            } else {
                // Hubo errores en el camino (no debería llegar aquí por flujo normal)
                endMission('wrong');
            }
            return;
        }

        // 2. Elegir al azar entre las pendientes (sin filtro de dificultad)
        const q = pending[Math.floor(Math.random() * pending.length)];
        gameState.currentQ = q;

        // Registrar como mostrada en este intento
        gameState.shownInAttempt.push(q.id);

        // 3. Guardar texto correcto antes de mezclar opciones
        let correctText = '';
        if (typeof q.correcta === 'number') {
            correctText = String(q.opciones[q.correcta] || '').trim().toLowerCase();
        } else {
            correctText = String(q.correcta).trim().toLowerCase();
        }
        gameState.correctText = correctText;

        // 4. Mostrar progreso: preguntas vistas / total del tema
        const progress = document.getElementById('q-progress');
        if (progress) {
            progress.textContent =
                `${gameState.shownInAttempt.length} / ${gameState.questions.length}`;
        }

        // 5. Mezclar opciones (anti-memorización de posición)
        let shuffledOpts = shuffle([...q.opciones]);
        shuffledOpts = shuffle(shuffledOpts); // Doble mezcla asegurada

        // 6. Renderizar
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
            // Marcar esta pregunta como respondida correctamente
            if (gameState.currentQ && !gameState.correctIds.includes(gameState.currentQ.id)) {
                gameState.correctIds.push(gameState.currentQ.id);
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
            const savedRecent = localStorage.getItem(`fisica_v2_recent_${nickname}`);
            if (savedRecent) {
                gameState.recentIds = JSON.parse(savedRecent);
            }
        } catch(e) {}

        try {
            // Habilitar caché offline (si no está habilitado ya)
            if (db) {
                db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
            }

            // Recuperar racha pendiente en background (sin bloquear)
            recoverPendingStreak();

            let userDocPromise = Promise.resolve({ exists: false });
            if (nickname !== 'Jugador') {
                userDocPromise = db.collection('usuarios').doc(nickname).get();
            }

            // Cargar preguntas y usuario al mismo tiempo para ahorrar tiempo
            const [snap, userDoc] = await Promise.all([
                db.collection('preguntas').get(),
                userDocPromise
            ]);

            gameState.allQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            gameState.questions = gameState.allQuestions;

            // Sincronizar mejor racha desde Firestore
            if (userDoc.exists) {
                const firestoreBest = parseInt(userDoc.data().mejorRacha) || 0;
                if (firestoreBest > gameState.best) {
                    gameState.best = firestoreBest;
                    localStorage.setItem('best_streak', firestoreBest);
                    els.best.textContent = firestoreBest;
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
    // ─────────────────────────────────────────────────────────
    // Helper: actualizar visualmente los botones de tema
    // ─────────────────────────────────────────────────────────
    const updateCategoryDisplay = () => {
        const catBtns = document.querySelectorAll('.category-btn');
        catBtns.forEach(btn => {
            const tema = btn.dataset.tema;
            if (!tema || tema === 'Aleatorio') return;

            // Guardar texto original la primera vez
            if (!btn.dataset.originalText) {
                btn.dataset.originalText = btn.textContent.trim();
            }

            const done = gameState.completedTopics.includes(tema);
            if (done) {
                btn.disabled = true;
                btn.style.opacity      = '0.6';
                btn.style.cursor       = 'not-allowed';
                btn.style.background   = 'rgba(57, 255, 20, 0.15)';
                btn.style.borderColor  = 'var(--neon-green)';
                btn.style.color        = 'var(--neon-green)';
                btn.textContent        = btn.dataset.originalText + ' ✓';
            } else {
                btn.disabled = false;
                btn.style.opacity      = '1';
                btn.style.cursor       = '';
                btn.style.background   = 'transparent';
                btn.style.borderColor  = '';
                btn.style.color        = 'var(--neon-blue)';
                btn.textContent        = btn.dataset.originalText;
            }
        });
    };

    // Lógica para seleccionar categoría
    let selectedCategory = null;
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.onclick = () => {
            if (btn.disabled) return; // tema ya completado, no se puede repetir
            categoryBtns.forEach(b => {
                if (!gameState.completedTopics.includes(b.dataset.tema)) {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--neon-blue)';
                }
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
        if (gameState.completedTopics.includes(selectedCategory)) return; // ya completado

        // Reiniciar solo el progreso del TEMA ACTUAL — la racha se conserva
        gameState.correctIds     = [];
        gameState.shownInAttempt = [];
        gameState.totalCorrect   = 0;
        // ⚠️ NO se resetea gameState.streak — se acumula entre temas

        // Filtrar preguntas por tema (o todas si es Aleatorio)
        if (selectedCategory === 'Aleatorio') {
            gameState.questions = [...gameState.allQuestions];
        } else {
            gameState.questions = gameState.allQuestions.filter(q => q.tema === selectedCategory);
        }

        if (gameState.questions.length === 0) {
            gameState.questions = [...gameState.allQuestions]; // fallback
        }

        els.startOverlay.classList.add('hidden');
        gameState.active       = true;
        gameState.missionEnded = false;
        nextQuestion();
    };

    document.getElementById('btn-restart').onclick = () => {
        // Después de un fallo: todo ya fue reseteado en endMission
        // Volver a la selección de tema
        document.getElementById('btn-restart').textContent = 'VOLVER A ELEGIR TEMA';
        els.gameOverModal.classList.add('hidden');
        gameState.missionEnded = false;
        gameState.correctText  = '';
        updateCategoryDisplay();
        selectedCategory = null;
        els.startBtn.disabled = true;
        els.startOverlay.classList.remove('hidden');
    };

    const btnChangeTopic = document.getElementById('btn-change-topic');
    if (btnChangeTopic) {
        btnChangeTopic.onclick = () => {
            // La racha SE CONSERVA — solo volvemos a elegir el siguiente tema
            els.gameOverModal.classList.add('hidden');
            els.startOverlay.classList.remove('hidden');
            updateCategoryDisplay();  // marcar temas completados con ✓
            selectedCategory = null;
            els.startBtn.disabled = true;
        };
    }

    const btnResetTopic = document.getElementById('btn-reset-topic');
    if (btnResetTopic) {
        btnResetTopic.onclick = () => {
            // Reiniciar todo desde cero y volver a selección de tema
            gameState.completedTopics = [];
            gameState.shownInAttempt  = [];
            gameState.correctIds      = [];
            gameState.streak          = 0;
            gameState.totalCorrect    = 0;
            gameState.missionEnded    = false;
            gameState.correctText     = '';
            els.streak.textContent    = '0';

            document.getElementById('btn-reset-topic').textContent = 'REINICIAR TEMA';
            els.gameOverModal.classList.add('hidden');
            updateCategoryDisplay();
            selectedCategory = null;
            els.startBtn.disabled = true;
            els.startOverlay.classList.remove('hidden');
        };
    }

    document.getElementById('btn-home').onclick = () => window.location.href = 'index.html';

    init();
});
