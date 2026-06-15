/**
 * examen.js — Lógica del Examen Especial
 * Grupos 2A y 2B | 20 preguntas aleatorias | 20 seg/pregunta | 2 intentos
 * Calificación 0–10 guardada en Firestore (campo mejorCalExamen)
 */
document.addEventListener('DOMContentLoaded', async () => {

    // ── Firebase ──────────────────────────────────────────────
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

    // ── Constantes ────────────────────────────────────────────
    const MAX_QUESTIONS   = 20;
    const TIMER_SECONDS   = 20;
    const MAX_ATTEMPTS    = 2;
    const ALLOWED_GROUPS  = ['A', 'B'];
    const ALLOWED_GRADE   = '2';           // Solo 2° grado

    // ── Estado ────────────────────────────────────────────────
    let state = {
        nickname:       '',
        grupo:          '',
        grado:          '',
        allQuestions:   [],
        examQuestions:  [],   // 20 preguntas del intento actual
        currentIndex:   0,
        correctCount:   0,
        attemptNumber:  0,    // 1 o 2
        usedAttempts:   0,    // leído de Firestore
        bestGrade:      null, // leído de Firestore
        timer:          null,
        timerEnd:       0,
        active:         false,
        correctText:    ''
    };

    // ── DOM refs ──────────────────────────────────────────────
    const screens = {
        loading:  document.getElementById('loading-overlay'),
        welcome:  document.getElementById('welcome-screen'),
        blocked:  document.getElementById('blocked-screen'),
        game:     document.getElementById('game-screen'),
        result:   document.getElementById('result-screen')
    };

    // ── Helpers ───────────────────────────────────────────────
    const show = (name) => {
        Object.values(screens).forEach(s => { if (s) s.style.display = 'none'; });
        const el = screens[name];
        if (el) {
            el.style.display = ['game','result','blocked'].includes(name) ? 'flex' : 'flex';
        }
    };

    const shuffle = (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    /** Convierte número correcto/20 → nota 0–10 (1 decimal) */
    const toGrade = (correct) => parseFloat(((correct / MAX_QUESTIONS) * 10).toFixed(1));

    /** Color de la calificación según rango */
    const gradeClass = (g) => {
        if (g >= 9)  return 'excellent';
        if (g >= 7)  return 'good';
        return 'poor';
    };

    /** Emoji según calificación */
    const gradeEmoji = (g) => {
        if (g >= 9)  return '🏆';
        if (g >= 7)  return '🎯';
        if (g >= 6)  return '✅';
        return '📚';
    };

    // ── Inicialización ────────────────────────────────────────
    const init = async () => {
        show('loading');

        // Leer usuario de localStorage
        state.nickname = localStorage.getItem('user') || '';

        if (!state.nickname || !db) {
            // No logueado → redirigir
            window.location.href = 'game.html';
            return;
        }

        try {
            // Cargar datos del usuario y preguntas en paralelo
            const [userDoc, questionsSnap] = await Promise.all([
                db.collection('usuarios').doc(state.nickname).get(),
                db.collection('preguntas').get()
            ]);

            if (!userDoc.exists) {
                window.location.href = 'game.html';
                return;
            }

            const userData = userDoc.data();
            state.grado   = String(userData.grado || '');
            state.grupo   = String(userData.grupo || '').toUpperCase();
            state.usedAttempts = parseInt(userData.intentosExamen) || 0;
            state.bestGrade    = userData.mejorCalExamen != null ? parseFloat(userData.mejorCalExamen) : null;

            // Verificar que sea grado 2 y grupo A o B
            if (state.grado !== ALLOWED_GRADE || !ALLOWED_GROUPS.includes(state.grupo)) {
                // No autorizado — mostrar mensaje en lugar de redirigir
                show('blocked');
                const blockedCard = document.querySelector('#blocked-screen .blocked-card');
                if (blockedCard) {
                    blockedCard.innerHTML = `
                        <div style="font-size:3rem;margin-bottom:1rem;">🚫</div>
                        <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:0.6rem;color:#ff6b6b;">Sin acceso</h2>
                        <p style="font-size:0.85rem;color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:1.5rem;">
                            Este examen es exclusivo para los grupos <strong style="color:#ffb400;">2A y 2B</strong>.
                            Tu grupo actual es <strong style="color:var(--neon-blue);">${state.grado}${state.grupo || '?'}</strong>.
                        </p>
                        <a href="game.html" class="btn btn-secondary" style="display:flex;text-decoration:none;">← Volver al Juego</a>
                    `;
                }
                return;
            }

            // Cargar preguntas
            state.allQuestions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Actualizar etiqueta de grupo
            const groupLabel = document.getElementById('group-label');
            if (groupLabel) groupLabel.textContent = `Grupo ${state.grado}${state.grupo} · Física en 10`;

            // Mostrar pantalla correcta
            if (state.usedAttempts >= MAX_ATTEMPTS) {
                showBlockedScreen();
            } else {
                showWelcomeScreen();
            }

        } catch (e) {
            console.error('Error al iniciar examen:', e);
            window.location.href = 'game.html';
        }
    };

    // ── Pantalla de bienvenida ────────────────────────────────
    const showWelcomeScreen = () => {
        show('welcome');

        // Dots de intentos
        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');
        [dot1, dot2].forEach((d, i) => {
            d.className = 'attempt-dot ' + (i < state.usedAttempts ? 'used' : 'available');
        });

        // Mostrar mejor calificación previa
        if (state.bestGrade !== null) {
            document.getElementById('best-score-display').style.display = 'block';
            document.getElementById('best-score-val').textContent = state.bestGrade;
        }

        // Deshabilitar botón si no hay intentos
        const startBtn = document.getElementById('btn-start-exam');
        if (state.usedAttempts >= MAX_ATTEMPTS) {
            startBtn.disabled = true;
            startBtn.style.opacity = '0.4';
            startBtn.textContent = '🔒 Sin intentos disponibles';
        } else {
            startBtn.disabled = false;
            startBtn.onclick = startExam;
        }
    };

    // ── Pantalla bloqueada ────────────────────────────────────
    const showBlockedScreen = () => {
        show('blocked');
        const bestEl = document.getElementById('blocked-best-score');
        if (bestEl) bestEl.textContent = state.bestGrade !== null ? state.bestGrade : '—';
    };

    // ── Iniciar examen ────────────────────────────────────────
    const startExam = () => {
        if (state.usedAttempts >= MAX_ATTEMPTS) return;

        // Seleccionar 20 preguntas al azar
        const shuffled = shuffle(state.allQuestions);
        state.examQuestions = shuffled.slice(0, MAX_QUESTIONS);
        state.currentIndex  = 0;
        state.correctCount  = 0;
        state.attemptNumber = state.usedAttempts + 1;
        state.active        = true;

        // Actualizar numero de intento en pantalla
        const attemptNumEl = document.getElementById('current-attempt-num');
        if (attemptNumEl) attemptNumEl.textContent = state.attemptNumber;

        // Actualizar total
        const totalEl = document.getElementById('q-total');
        if (totalEl) totalEl.textContent = state.examQuestions.length;

        show('game');
        renderQuestion();
    };

    // ── Renderizar pregunta ───────────────────────────────────
    const renderQuestion = () => {
        if (!state.active) return;

        const q = state.examQuestions[state.currentIndex];
        const questionNum = state.currentIndex + 1;

        // Texto de pregunta
        document.getElementById('exam-question-text').textContent = q.pregunta;

        // Contadores
        document.getElementById('q-current').textContent = questionNum;

        // Progress bar
        const pct = ((state.currentIndex) / state.examQuestions.length) * 100;
        document.getElementById('q-progress-fill').style.width = pct + '%';

        // Calcular respuesta correcta
        if (typeof q.correcta === 'number') {
            state.correctText = String(q.opciones[q.correcta] || '').trim().toLowerCase();
        } else {
            state.correctText = String(q.correcta).trim().toLowerCase();
        }

        // Mezclar opciones
        const shuffledOpts = shuffle([...q.opciones]);

        // Renderizar opciones
        const grid = document.getElementById('exam-options-grid');
        grid.innerHTML = '';
        shuffledOpts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'exam-option-btn';
            btn.textContent = opt;
            btn.dataset.optText = String(opt).trim().toLowerCase();
            btn.onclick = () => handleAnswer(btn);
            grid.appendChild(btn);
        });

        // Iniciar timer
        startTimer();
    };

    // ── Timer ─────────────────────────────────────────────────
    const startTimer = () => {
        clearTimer();
        const DURATION = TIMER_SECONDS * 1000;
        state.timerEnd = Date.now() + DURATION;

        const bar  = document.getElementById('exam-timer-bar');
        const text = document.getElementById('exam-timer-text');

        state.timer = setInterval(() => {
            if (!state.active) return;
            const left = state.timerEnd - Date.now();

            if (left <= 0) {
                clearTimer();
                // Tiempo agotado → respuesta incorrecta, avanzar
                flashTimeout();
                return;
            }

            const pct = (left / DURATION) * 100;
            bar.style.width = pct + '%';
            text.textContent = `${Math.ceil(left / 1000)}s`;

            if (left < 5000) {
                bar.style.background = '#ff4444';
                text.style.color = '#ff6b6b';
            } else {
                bar.style.background = 'linear-gradient(90deg, #ffb400, #ff6b00)';
                text.style.color = 'rgba(255,255,255,0.5)';
            }
        }, 50);
    };

    const clearTimer = () => {
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
    };

    /** Cuando se acaba el tiempo */
    const flashTimeout = () => {
        // Mostrar respuesta correcta brevemente
        const btns = document.querySelectorAll('.exam-option-btn');
        btns.forEach(b => {
            b.disabled = true;
            if ((b.dataset.optText || '') === state.correctText) b.classList.add('correct');
        });
        document.getElementById('exam-timer-text').textContent = '¡Tiempo!';
        document.getElementById('exam-timer-bar').style.width = '0%';
        setTimeout(nextQuestion, 1100);
    };

    // ── Manejar respuesta ─────────────────────────────────────
    const handleAnswer = (btn) => {
        if (!state.active) return;
        clearTimer();

        const chosen    = btn.dataset.optText || '';
        const isCorrect = chosen === state.correctText;

        // Deshabilitar todos
        document.querySelectorAll('.exam-option-btn').forEach(b => b.disabled = true);

        // Resaltar correcta
        document.querySelectorAll('.exam-option-btn').forEach(b => {
            if ((b.dataset.optText || '') === state.correctText) b.classList.add('correct');
        });

        if (isCorrect) {
            state.correctCount++;
            setTimeout(nextQuestion, 800);
        } else {
            btn.classList.add('wrong');
            setTimeout(nextQuestion, 1100);
        }
    };

    // ── Siguiente pregunta ────────────────────────────────────
    const nextQuestion = () => {
        state.currentIndex++;

        // Actualizar progress bar al 100% si terminó
        if (state.currentIndex >= state.examQuestions.length) {
            document.getElementById('q-progress-fill').style.width = '100%';
            finishAttempt();
            return;
        }

        renderQuestion();
    };

    // ── Finalizar intento ─────────────────────────────────────
    const finishAttempt = async () => {
        state.active = false;
        clearTimer();

        const correct   = state.correctCount;
        const wrong     = MAX_QUESTIONS - correct;
        const grade     = toGrade(correct);
        const newBest   = state.bestGrade === null || grade > state.bestGrade;

        // Incrementar intentos
        state.usedAttempts++;

        // Actualizar Firestore
        try {
            const updates = { intentosExamen: state.usedAttempts };
            if (newBest) {
                updates.mejorCalExamen = grade;
                updates.fechaExamen = new Date().toISOString();
                state.bestGrade = grade;
            }
            await db.collection('usuarios').doc(state.nickname).update(updates);
        } catch (e) {
            console.error('Error al guardar resultado:', e);
        }

        // Mostrar pantalla de resultado
        showResultScreen(correct, wrong, grade, newBest);
    };

    // ── Pantalla de resultado ─────────────────────────────────
    const showResultScreen = (correct, wrong, grade, newBest) => {
        show('result');

        const attempsLeft = MAX_ATTEMPTS - state.usedAttempts;

        // Emoji y título
        document.getElementById('result-emoji').textContent = gradeEmoji(grade);
        document.getElementById('result-title').textContent =
            grade >= 6 ? '¡Aprobado! 🎉' : 'Intento completado';
        document.getElementById('result-subtitle').textContent =
            `INTENTO ${state.attemptNumber} DE ${MAX_ATTEMPTS}`;

        // Calificación
        const gradeEl = document.getElementById('result-grade');
        gradeEl.textContent = grade;
        gradeEl.className   = 'grade-value ' + gradeClass(grade);

        // Detalles
        document.getElementById('result-correct').textContent = correct;
        document.getElementById('result-wrong').textContent   = wrong;

        // Badge de nuevo récord
        document.getElementById('new-best-badge').style.display = newBest ? 'inline-flex' : 'none';

        // Botón reintentar
        const retryBtn = document.getElementById('btn-retry');
        if (attempsLeft > 0) {
            retryBtn.style.display = 'block';
            retryBtn.onclick = startExam;
            document.getElementById('no-more-msg').style.display = 'none';
        } else {
            retryBtn.style.display = 'none';
            document.getElementById('no-more-msg').style.display = 'block';
        }
    };

    // ── Evento: retry desde pantalla de resultado ─────────────
    // (se asigna dinámicamente en showResultScreen)

    // ── Detectar cambio de pestaña durante examen ─────────────
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.active) {
            clearTimer();
            // Mostrar respuesta correcta brevemente y marcar como trampa/incorrecta
            const btns = document.querySelectorAll('.exam-option-btn');
            btns.forEach(b => {
                b.disabled = true;
                if ((b.dataset.optText || '') === state.correctText) b.classList.add('correct');
            });
            const timerText = document.getElementById('exam-timer-text');
            const timerBar = document.getElementById('exam-timer-bar');
            if (timerText) {
                timerText.textContent = '¡No salgas!';
                timerText.style.color = '#ff6b6b';
            }
            if (timerBar) {
                timerBar.style.width = '0%';
                timerBar.style.background = '#ff4444';
            }
            // Pasar a la siguiente pregunta después de una breve pausa
            setTimeout(nextQuestion, 1500);
        }
    });

    // ── Arrancar ──────────────────────────────────────────────
    await init();
});
