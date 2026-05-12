document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = firebase.firestore();

    // =========================================================
    // CREDENTIALS  (password stored as SHA-256 hash)
    // Plain password:  F10@Admin2025!
    // =========================================================
    const ADMIN_EMAIL = 'zlagustin10@gmail.com';
    // SHA-256 of "F10@Admin2025!"
    const ADMIN_PASS_HASH = '8c0bd0f999c8a5f914b113a179a7557cafb1d46afe91b7f30f03594b4380b9cb';

    // DOM refs
    const loginView        = document.getElementById('login-view');
    const dashboardView    = document.getElementById('dashboard-view');
    const loginForm        = document.getElementById('admin-login-form');
    const loginError       = document.getElementById('login-error');
    const studentsBody     = document.getElementById('students-body');
    const logoutBtn        = document.getElementById('logout-btn');
    const resultCount      = document.getElementById('result-count');
    const statTotal        = document.getElementById('stat-total');
    const statGrades       = document.getElementById('stat-grades');
    const statGroups       = document.getElementById('stat-groups');
    const statBest         = document.getElementById('stat-best');
    const filterGrade      = document.getElementById('filter-grade');
    const filterGroup      = document.getElementById('filter-group');
    const btnApply         = document.getElementById('btn-apply-filter');
    const btnReset         = document.getElementById('btn-reset-filter');
    const btnBulkDelete    = document.getElementById('btn-bulk-delete');
    const togglePass       = document.getElementById('toggle-pass');
    const passInput        = document.getElementById('admin-password');

    // All students cache
    let allStudents = [];

    // ---- Show/hide password ----
    togglePass.addEventListener('click', () => {
        const isHidden = passInput.type === 'password';
        passInput.type = isHidden ? 'text' : 'password';
        togglePass.textContent = isHidden ? '🙈' : '👁';
    });

    // ---- SHA-256 helper ----
    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray  = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ---- Session check ----
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        showDashboard();
    }

    // ---- Login submit ----
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';

        const email = document.getElementById('admin-email').value.trim().toLowerCase();
        const pass  = document.getElementById('admin-password').value;

        const submitBtn = document.getElementById('login-submit-btn');
        submitBtn.textContent = 'Verificando...';
        submitBtn.disabled = true;

        try {
            const hash = await sha256(pass);
            if (email === ADMIN_EMAIL && hash === ADMIN_PASS_HASH) {
                sessionStorage.setItem('adminLoggedIn', 'true');
                showDashboard();
            } else {
                loginError.style.display = 'block';
                passInput.value = '';
            }
        } catch (err) {
            loginError.textContent = '⚠️ Error al procesar credenciales.';
            loginError.style.display = 'block';
        } finally {
            submitBtn.textContent = 'Acceder al Sistema';
            submitBtn.disabled = false;
        }
    });

    // ---- Logout ----
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminLoggedIn');
        window.location.reload();
    });

    // ---- Show dashboard ----
    function showDashboard() {
        loginView.style.display = 'none';
        dashboardView.classList.add('visible');
        loadStudents();
    }

    // ---- Load all students from Firestore ----
    async function loadStudents() {
        try {
            studentsBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">⏳</div><p>Cargando alumnos...</p></div></td></tr>`;
            const snapshot = await db.collection('usuarios').get();
            allStudents = [];
            snapshot.forEach(doc => {
                allStudents.push({ id: doc.id, ...doc.data() });
            });

            // Sort: grado asc, grupo asc, nickname asc
            allStudents.sort((a, b) => {
                const ga = parseInt(a.grado) || 0;
                const gb = parseInt(b.grado) || 0;
                if (ga !== gb) return ga - gb;
                const grpCmp = (a.grupo || '').localeCompare(b.grupo || '');
                if (grpCmp !== 0) return grpCmp;
                return (a.nickname || '').localeCompare(b.nickname || '');
            });

            updateStats(allStudents);
            renderTable(allStudents);
        } catch (error) {
            console.error('Error loading students:', error);
            studentsBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">❌</div><p>Error al cargar la base de datos.</p></div></td></tr>`;
        }
    }

    // ---- Update statistics ----
    function updateStats(students) {
        statTotal.textContent = students.length;
        const grades  = new Set(students.map(s => s.grado)).size;
        const groups  = new Set(students.map(s => `${s.grado}-${s.grupo}`)).size;
        const best    = students.reduce((max, s) => Math.max(max, s.mejorRacha || 0), 0);
        statGrades.textContent = grades;
        statGroups.textContent = groups;
        statBest.textContent   = best;
    }

    // ---- Render table ----
    function renderTable(students) {
        resultCount.textContent = `${students.length} alumno${students.length !== 1 ? 's' : ''} encontrado${students.length !== 1 ? 's' : ''}`;

        if (students.length === 0) {
            studentsBody.innerHTML = `
                <tr><td colspan="5">
                    <div class="empty-state">
                        <div class="empty-icon">🔭</div>
                        <p>No se encontraron alumnos con los filtros aplicados.</p>
                    </div>
                </td></tr>`;
            return;
        }

        studentsBody.innerHTML = '';
        students.forEach(student => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="student-info">
                        <img src="${student.avatar || 'avatars/avatar1.png'}"
                             class="student-avatar"
                             onerror="this.src='avatars/avatar1.png'"
                             alt="avatar">
                        <div>
                            <div class="student-name">${escHtml(student.nombre || '-')}</div>
                            <div class="student-nick">@${escHtml(student.nickname || student.id)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="grade-badge">${escHtml(String(student.grado || '-'))}° ${escHtml(student.grupo || '-')}</span>
                </td>
                <td style="font-size:0.85rem;opacity:0.8;">${escHtml(student.correo || '-')}</td>
                <td><span class="score-value">🔥 ${student.mejorRacha ?? 0}</span></td>
                <td>
                    <button class="delete-btn" data-id="${escHtml(student.id)}" data-name="${escHtml(student.nombre || student.id)}">
                        🗑 Eliminar
                    </button>
                </td>
            `;
            studentsBody.appendChild(tr);
        });

        // Attach delete listeners
        studentsBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteStudent(btn.dataset.id, btn.dataset.name);
            });
        });
    }

    // ---- HTML escaping helper ----
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---- Get filtered list ----
    function getFiltered() {
        const grade = filterGrade.value;
        const group = filterGroup.value;
        return allStudents.filter(s => {
            const matchGrade = !grade || String(s.grado) === grade;
            const matchGroup = !group || s.grupo === group;
            return matchGrade && matchGroup;
        });
    }

    // ---- Apply filter button ----
    btnApply.addEventListener('click', () => {
        renderTable(getFiltered());
    });

    // ---- Reset filter button ----
    btnReset.addEventListener('click', () => {
        filterGrade.value = '';
        filterGroup.value = '';
        renderTable(allStudents);
    });

    // ---- Bulk delete ----
    btnBulkDelete.addEventListener('click', async () => {
        const filtered = getFiltered();
        if (filtered.length === 0) {
            showToast('No hay alumnos que coincidan con los filtros seleccionados.', 'warn');
            return;
        }

        const grade = filterGrade.value || 'todos los grados';
        const group = filterGroup.value || 'todos los grupos';

        if (!confirm(`⚠️ ADVERTENCIA CRÍTICA\n\nSe eliminarán ${filtered.length} alumno(s) de:\nGrado: ${grade} | Grupo: ${group}\n\nEsta acción NO se puede deshacer. ¿Continuar?`)) return;

        btnBulkDelete.disabled = true;
        btnBulkDelete.textContent = 'Eliminando...';

        try {
            const batch = db.batch();
            filtered.forEach(s => batch.delete(db.collection('usuarios').doc(s.id)));
            await batch.commit();
            showToast(`✅ ${filtered.length} alumno(s) eliminados correctamente.`, 'success');
            await loadStudents();
        } catch (err) {
            console.error('Bulk delete error:', err);
            showToast('❌ Error al eliminar: ' + err.message, 'error');
        } finally {
            btnBulkDelete.disabled = false;
            btnBulkDelete.textContent = '🗑 Eliminar Filtrados';
        }
    });

    // ---- Individual delete ----
    async function deleteStudent(id, name) {
        if (!confirm(`¿Eliminar al alumno "${name}" (@${id})?\nEsta acción no se puede deshacer.`)) return;
        try {
            await db.collection('usuarios').doc(id).delete();
            showToast(`✅ Alumno @${id} eliminado.`, 'success');
            // Remove from cache and re-render
            allStudents = allStudents.filter(s => s.id !== id);
            updateStats(allStudents);
            renderTable(getFiltered());
        } catch (err) {
            console.error('Delete error:', err);
            showToast('❌ Error al eliminar: ' + err.message, 'error');
        }
    }

    // ---- Toast notification ----
    function showToast(message, type = 'info') {
        const existing = document.getElementById('admin-toast');
        if (existing) existing.remove();

        const colors = {
            success: { bg: 'rgba(57,255,20,0.15)', border: 'rgba(57,255,20,0.5)', color: '#39ff14' },
            error:   { bg: 'rgba(255,68,68,0.15)',  border: 'rgba(255,68,68,0.5)',  color: '#ff6b6b' },
            warn:    { bg: 'rgba(255,200,0,0.15)',   border: 'rgba(255,200,0,0.5)',  color: '#ffc800' },
            info:    { bg: 'rgba(0,242,255,0.15)',   border: 'rgba(0,242,255,0.5)',  color: '#00f2ff' },
        };
        const c = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: c.bg,
            border: `1px solid ${c.border}`,
            color: c.color,
            padding: '1rem 2rem',
            borderRadius: '14px',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: '700',
            fontSize: '0.9rem',
            zIndex: '9999',
            backdropFilter: 'blur(12px)',
            boxShadow: `0 0 20px ${c.border}`,
            maxWidth: '90vw',
            textAlign: 'center',
            animation: 'slide-up 0.3s ease-out',
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // =========================================================
    // DANGER ZONE — Reset de rachas
    // =========================================================
    const dzToggle  = document.getElementById('dz-toggle');
    const dzBody    = document.getElementById('dz-body');
    const dzArrow   = document.getElementById('dz-arrow');
    const dzChk1    = document.getElementById('dz-chk1');
    const dzChk2    = document.getElementById('dz-chk2');
    const dzBtn     = document.getElementById('btn-danger-reset');
    const dzLog     = document.getElementById('dz-log');

    // Toggle abrir/cerrar
    dzToggle.addEventListener('click', () => {
        const open = dzBody.style.display === 'block';
        dzBody.style.display = open ? 'none' : 'block';
        dzArrow.classList.toggle('open', !open);
    });

    // Activar botón solo si ambos checks marcados
    function updateDzBtn() {
        if (dzChk1 && dzChk2 && dzChk1.checked && dzChk2.checked) {
            dzBtn.classList.add('enabled');
        } else {
            dzBtn.classList.remove('enabled');
        }
    }
    if (dzChk1) dzChk1.addEventListener('change', updateDzBtn);
    if (dzChk2) dzChk2.addEventListener('change', updateDzBtn);

    function dzLogLine(msg, type = 'inf') {
        const line = document.createElement('div');
        line.className = `dz-log-line dz-${type}`;
        line.textContent = `[${new Date().toLocaleTimeString('es-MX')}] ${msg}`;
        dzLog.appendChild(line);
        dzLog.scrollTop = dzLog.scrollHeight;
    }

    if (dzBtn) {
        dzBtn.addEventListener('click', async () => {
            if (!dzBtn.classList.contains('enabled')) return;
            if (!confirm('⛔ ÚLTIMA CONFIRMACIÓN\n\n¿Resetear TODAS las rachas a 0 y borrar historial de partidas?\nEsta acción NO se puede deshacer.')) return;

            dzBtn.disabled    = true;
            dzBtn.textContent = '⏳ Procesando...';
            dzLog.innerHTML   = '';
            dzLog.style.display = 'block';

            try {
                // 1. Resetear mejorRacha en todos los usuarios
                dzLogLine('Leyendo alumnos...', 'hdr');
                const usuSnap = await db.collection('usuarios').get();
                dzLogLine(`${usuSnap.size} alumnos encontrados.`, 'inf');

                const docs = usuSnap.docs;
                for (let i = 0; i < docs.length; i += 400) {
                    const chunk = docs.slice(i, i + 400);
                    const batch = db.batch();
                    chunk.forEach(d => batch.update(d.ref, { mejorRacha: 0 }));
                    await batch.commit();
                    dzLogLine(`  ${Math.min(i + 400, docs.length)}/${docs.length} alumnos reseteados`, 'ok');
                }
                dzLogLine(`✅ Todas las rachas → 0`, 'ok');

                // 2. Borrar colección partidas en lotes
                dzLogLine('Eliminando historial de partidas...', 'hdr');
                let totalPartidas = 0;
                let snap;
                do {
                    snap = await db.collection('partidas').limit(400).get();
                    if (snap.empty) break;
                    const batch = db.batch();
                    snap.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    totalPartidas += snap.size;
                    dzLogLine(`  ${totalPartidas} partidas eliminadas...`, 'inf');
                } while (!snap.empty);
                dzLogLine(`✅ ${totalPartidas} partidas borradas.`, 'ok');

                dzLogLine('─── Reset completado ───', 'hdr');
                showToast(`✅ Listo. ${usuSnap.size} alumnos reseteados a 0.`, 'success');

                // Recargar tabla
                await loadStudents();
                dzBtn.textContent = '✅ Reset completado';

            } catch (err) {
                console.error(err);
                dzLogLine(`❌ ERROR: ${err.message}`, 'err');
                dzBtn.disabled    = false;
                dzBtn.textContent = '🗑 Reiniciar Todas las Rachas a 0';
            }
        });
    }
});

