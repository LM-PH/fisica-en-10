document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    const db = firebase.firestore();

    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('admin-login-form');
    const studentsBody = document.getElementById('students-body');
    const logoutBtn = document.getElementById('logout-btn');
    const totalStudentsEl = document.getElementById('total-students');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

    // Admin Credentials (suggested password: FisicaAdmin2024*)
    const ADMIN_EMAIL = 'zlagustin10@gmail.com';
    const ADMIN_PASS = 'FisicaAdmin2024*';

    // Check session
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        showDashboard();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-password').value;

        if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            showDashboard();
        } else {
            alert('Credenciales incorrectas. Acceso denegado.');
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminLoggedIn');
        window.location.reload();
    });

    function showDashboard() {
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        loadStudents();
    }

    async function loadStudents() {
        try {
            const snapshot = await db.collection('usuarios').get();
            let students = [];
            snapshot.forEach(doc => {
                students.push({ id: doc.id, ...doc.data() });
            });

            // Sort by grade and then by group
            students.sort((a, b) => {
                if (a.grado !== b.grado) {
                    return a.grado - b.grado;
                }
                return a.grupo.localeCompare(b.grupo);
            });

            renderTable(students);
            totalStudentsEl.textContent = students.length;
        } catch (error) {
            console.error("Error loading students:", error);
            alert("Error al cargar la base de datos.");
        }
    }

    function renderTable(students) {
        studentsBody.innerHTML = '';
        students.forEach(student => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${student.avatar || 'avatars/avatar1.png'}" style="width: 30px; height: 30px; border-radius: 50%;">
                        <div>
                            <div style="font-weight: bold;">${student.nombre}</div>
                            <div style="font-size: 0.7rem; opacity: 0.7;">@${student.nickname}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="group-badge">${student.grado}° ${student.grupo}</span>
                </td>
                <td>${student.correo}</td>
                <td><span style="color: var(--neon-green); font-weight: bold;">${student.mejorRacha}</span></td>
                <td>
                    <button class="delete-btn" onclick="deleteUser('${student.id}')">Eliminar</button>
                </td>
            `;
            studentsBody.appendChild(tr);
        });
    }

    // Global function for individual deletion
    window.deleteUser = async (id) => {
        if (confirm(`¿Estás seguro de eliminar al usuario ${id}? Esta acción no se puede deshacer.`)) {
            try {
                await db.collection('usuarios').doc(id).delete();
                alert('Usuario eliminado correctamente.');
                loadStudents();
            } catch (error) {
                console.error("Error deleting user:", error);
                alert("Error al eliminar el usuario.");
            }
        }
    };

    // Bulk deletion by group
    bulkDeleteBtn.addEventListener('click', async () => {
        const grade = document.getElementById('delete-grade-select').value;
        const group = document.getElementById('delete-group-select').value;

        if (!grade || !group) {
            alert('Por favor selecciona grado y grupo para eliminar en masa.');
            return;
        }

        if (confirm(`¿ADVERTENCIA CRÍTICA: ¿Estás seguro de eliminar a TODOS los alumnos de ${grade}° ${group}?`)) {
            try {
                const snapshot = await db.collection('usuarios')
                    .where('grado', '==', grade)
                    .where('grupo', '==', group)
                    .get();

                if (snapshot.empty) {
                    alert('No se encontraron alumnos en este grupo.');
                    return;
                }

                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                alert(`Se han eliminado ${snapshot.size} alumnos del grupo ${grade}° ${group}.`);
                loadStudents();
            } catch (error) {
                console.error("Error in bulk delete:", error);
                alert("Error al realizar la eliminación masiva.");
            }
        }
    });
});
