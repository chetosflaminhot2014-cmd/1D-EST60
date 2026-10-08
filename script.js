
/* ==========================================
   MENÚ MÓVIL
========================================== */

const menuButton = document.getElementById("menuButton");
const nav = document.getElementById("nav");

if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
        nav.classList.toggle("active");
    });

    nav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            nav.classList.remove("active");
        });
    });
}


/* ==========================================
   BOTÓN VOLVER ARRIBA
========================================== */

const backToTop = document.getElementById("backToTop");

if (backToTop) {
    window.addEventListener("scroll", () => {
        backToTop.classList.toggle("show", window.scrollY > 500);
    });

    backToTop.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}


/* ==========================================
   UTILIDADES
========================================== */

function escapeHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function formatearFecha(fecha) {
    if (!fecha) return "Sin fecha";

    const partes = fecha.toString().split("T")[0].split("-");

    if (partes.length !== 3) return fecha;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}


/* ==========================================
   AVISOS
========================================== */

async function cargarAvisosPublicos() {
    const contenedor = document.getElementById("avisosPublicos");
    if (!contenedor) return;

    try {
        const response = await fetch("/api/avisos");

        if (!response.ok) throw new Error("Error HTTP");

        const avisos = await response.json();

        if (!Array.isArray(avisos) || avisos.length === 0) {
            contenedor.innerHTML = `
                <div class="notice-card">
                    <div class="notice-icon">!</div>
                    <div class="notice-content">
                        <span class="notice-tag">AVISO GENERAL</span>
                        <h3>No hay avisos publicados</h3>
                        <p>Actualmente no hay avisos importantes para el grupo.</p>
                    </div>
                    <span class="notice-date">—</span>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = "";

        avisos.forEach((aviso, index) => {
            const fecha = new Date(aviso.fecha);
            const elemento = document.createElement("div");

            elemento.className = "notice-card";

            elemento.innerHTML = `
                <div class="notice-icon">!</div>
                <div class="notice-content">
                    <span class="notice-tag">AVISO GENERAL</span>
                    <h3>${escapeHTML(aviso.titulo)}</h3>
                    <p>${escapeHTML(aviso.contenido)}</p>
                    <small>Publicado: ${
                        Number.isNaN(fecha.getTime())
                            ? "Fecha no disponible"
                            : fecha.toLocaleDateString("es-MX")
                    }</small>
                </div>
                <span class="notice-date">${String(index + 1).padStart(2, "0")}</span>
            `;

            contenedor.appendChild(elemento);
        });
    } catch (error) {
        console.error("Error al cargar avisos:", error);

        contenedor.innerHTML = `
            <div class="notice-card">
                <div class="notice-icon">!</div>
                <div class="notice-content">
                    <span class="notice-tag">ERROR</span>
                    <h3>No se pudieron cargar los avisos</h3>
                    <p>No fue posible conectar con el servidor.</p>
                </div>
            </div>
        `;
    }
}


/* ==========================================
   TAREAS
========================================== */

async function cargarTareasPublicas() {
    const contenedor = document.getElementById("tareasPublicas");
    if (!contenedor) return;

    try {
        const response = await fetch("/api/tareas");

        if (!response.ok) throw new Error("Error HTTP");

        const tareas = await response.json();

        if (!Array.isArray(tareas) || tareas.length === 0) {
            contenedor.innerHTML = `
                <div class="task-card">
                    <div class="task-status">
                        <span class="status-dot"></span>
                        <span>ACTUALMENTE</span>
                    </div>
                    <h3>No hay tareas registradas</h3>
                    <p>Actualmente no hay tareas pendientes registradas para el grupo.</p>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = "";

        tareas.forEach(tarea => {
            const elemento = document.createElement("div");
            elemento.className = "task-card";

            elemento.innerHTML = `
                <div class="task-status">
                    <span class="status-dot"></span>
                    <span>${escapeHTML(tarea.materia)}</span>
                </div>
                <h3>${escapeHTML(tarea.titulo)}</h3>
                <p>${escapeHTML(tarea.descripcion || "")}</p>
                <strong>Entrega: ${escapeHTML(formatearFecha(tarea.fecha_entrega))}</strong>
            `;

            contenedor.appendChild(elemento);
        });
    } catch (error) {
        console.error("Error al cargar tareas:", error);

        contenedor.innerHTML = `
            <div class="task-card">
                <div class="task-status">
                    <span class="status-dot"></span>
                    <span>ERROR</span>
                </div>
                <h3>No se pudieron cargar las tareas</h3>
                <p>No fue posible conectar con el servidor.</p>
            </div>
        `;
    }
}


/* ==========================================
   EVENTOS / CALENDARIO
========================================== */

async function cargarEventosPublicos() {
    const contenedor = document.getElementById("eventosPublicos");
    if (!contenedor) return;

    try {
        const response = await fetch("/api/eventos");

        if (!response.ok) throw new Error("Error HTTP");

        const eventos = await response.json();

        if (!Array.isArray(eventos) || eventos.length === 0) {
            contenedor.innerHTML = `
                <div class="calendar-card">
                    <span>—</span>
                    <strong>No hay eventos</strong>
                    <p>Actualmente no hay fechas importantes registradas.</p>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = "";

        eventos.forEach((evento, index) => {
            const elemento = document.createElement("div");
            elemento.className = "calendar-card";

            elemento.innerHTML = `
                <span>${String(index + 1).padStart(2, "0")}</span>
                <strong>${escapeHTML(evento.titulo)}</strong>
                <p>${escapeHTML(evento.descripcion || "")}</p>
                <small>${escapeHTML(formatearFecha(evento.fecha))}</small>
            `;

            contenedor.appendChild(elemento);
        });
    } catch (error) {
        console.error("Error al cargar eventos:", error);

        contenedor.innerHTML = `
            <div class="calendar-card">
                <span>!</span>
                <strong>Error al cargar</strong>
                <p>No fue posible conectar con el servidor.</p>
            </div>
        `;
    }
}


/* ==========================================
   ÚLTIMA ACTUALIZACIÓN
========================================== */

function actualizarFecha() {
    const elemento = document.getElementById("lastUpdate");
    if (!elemento) return;

    elemento.textContent = new Date().toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


/* ==========================================
   HORARIO INTELIGENTE
========================================== */

/*
   Los periodos se leen de la tabla existente.
   Así no hay que duplicar las materias en JavaScript.
*/

function iniciarHorarioInteligente() {
    const panel = document.getElementById("smartSchedule");
    const tabla = document.querySelector(".schedule-table");

    if (!panel || !tabla) return;

    const elementos = {
        fecha: document.getElementById("smartCurrentDate"),
        reloj: document.getElementById("smartClock"),
        materia: document.getElementById("smartCurrentSubject"),
        mensaje: document.getElementById("smartCurrentMessage"),
        inicio: document.getElementById("smartStartTime"),
        fin: document.getElementById("smartEndTime"),
        progreso: document.getElementById("smartProgressBar"),
        siguiente: document.getElementById("smartNextSubject"),
        horaSiguiente: document.getElementById("smartNextTime"),
        cuenta: document.getElementById("smartCountdown")
    };

    const encabezados = Array.from(tabla.querySelectorAll("thead th"))
        .slice(1)
        .map(th => th.textContent.trim());

    const filas = Array.from(tabla.querySelectorAll("tbody tr"));

    function convertirHora(texto) {
        const coincidencia = texto.match(/(\d{1,2}):(\d{2})/);

        if (!coincidencia) return null;

        return Number(coincidencia[1]) * 60 + Number(coincidencia[2]);
    }

    const periodos = filas.map(fila => {
        const celdas = Array.from(fila.querySelectorAll("td"));
        const textoHora = celdas[0]?.textContent.trim() || "";
        const horas = textoHora.match(
            /(\d{1,2}:\d{2})\s*[—–-]\s*(\d{1,2}:\d{2})/
        );

        if (!horas) return null;

        return {
            fila,
            celdas,
            inicio: convertirHora(horas[1]),
            fin: convertirHora(horas[2]),
            horaInicio: horas[1],
            horaFin: horas[2],
            receso: fila.classList.contains("break-row"),
            materias: celdas.slice(1).map(celda =>
                celda.textContent.trim()
            )
        };
    }).filter(periodo =>
        periodo &&
        periodo.inicio !== null &&
        periodo.fin !== null
    );

    if (encabezados.length !== 5 || periodos.length === 0) {
        elementos.materia.textContent = "Horario no disponible";
        elementos.mensaje.textContent =
            "No se pudo interpretar la tabla del horario.";
        return;
    }

    function formatearCuenta(segundos) {
        const horas = Math.floor(segundos / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        const resto = segundos % 60;

        return [
            String(horas).padStart(2, "0"),
            String(minutos).padStart(2, "0"),
            String(resto).padStart(2, "0")
        ].join(":");
    }

    function horaLegible(minutos) {
        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;
        const periodo = horas >= 12 ? "p. m." : "a. m.";
        const hora12 = horas % 12 || 12;

        return `${hora12}:${String(mins).padStart(2, "0")} ${periodo}`;
    }

    function limpiarResaltado() {
        periodos.forEach(periodo => {
            periodo.fila.classList.remove("smart-current-row");

            periodo.celdas.forEach(celda => {
                celda.classList.remove("smart-current-cell");
            });
        });
    }

    function mostrarEstado({
        materia,
        mensaje,
        siguiente = "No hay más clases hoy",
        horaSiguiente = "Jornada terminada",
        cuenta = "--:--:--",
        inicio = "--:--",
        fin = "--:--",
        progreso = 0
    }) {
        elementos.materia.textContent = materia;
        elementos.mensaje.textContent = mensaje;
        elementos.siguiente.textContent = siguiente;
        elementos.horaSiguiente.textContent = horaSiguiente;
        elementos.cuenta.textContent = cuenta;
        elementos.inicio.textContent = `Inicio: ${inicio}`;
        elementos.fin.textContent = `Fin: ${fin}`;
        elementos.progreso.style.width =
            `${Math.max(0, Math.min(100, progreso))}%`;
    }

    function actualizar() {
        const ahora = new Date();
        const dia = ahora.getDay();
        const minutos = ahora.getHours() * 60 + ahora.getMinutes();
        const segundos = ahora.getSeconds();

        elementos.reloj.textContent = ahora.toLocaleTimeString("es-MX", {
            hour12: false
        });

        elementos.fecha.textContent = ahora.toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        limpiarResaltado();

        if (dia === 0 || dia === 6) {
            mostrarEstado({
                materia: "Sin clases hoy",
                mensaje: "Es fin de semana. El horario se reanudará el próximo día escolar."
            });
            return;
        }

        const indiceDia = dia - 1;

        const actual = periodos.find(periodo =>
            minutos >= periodo.inicio && minutos < periodo.fin
        );

        const siguientes = periodos.filter(periodo =>
            periodo.inicio > minutos && !periodo.receso
        );

        const siguiente = siguientes[0];

        if (actual) {
            actual.fila.classList.add("smart-current-row");

            const celdaActual = actual.celdas[indiceDia + 1];

            if (celdaActual) {
                celdaActual.classList.add("smart-current-cell");
            }

            if (actual.receso) {
                mostrarEstado({
                    materia: "Receso",
                    mensaje: `El descanso termina a las ${horaLegible(actual.fin)}.`,
                    siguiente: siguiente
                        ? actual.materias[indiceDia] || encabezados[indiceDia]
                        : "Fin de jornada",
                    horaSiguiente: siguiente
                        ? `Comienza a las ${horaLegible(siguiente.inicio)}`
                        : "Jornada terminada",
                    cuenta: formatearCuenta(
                        Math.max(0, actual.fin * 60 - (minutos * 60 + segundos))
                    ),
                    inicio: actual.horaInicio,
                    fin: actual.horaFin,
                    progreso: (
                        (minutos - actual.inicio) /
                        (actual.fin - actual.inicio)
                    ) * 100
                });

                return;
            }

            const nombreMateria =
                actual.materias[indiceDia] || "Materia no identificada";

            mostrarEstado({
                materia: nombreMateria,
                mensaje: `La clase termina a las ${horaLegible(actual.fin)}.`,
                siguiente: siguiente
                    ? siguiente.materias[indiceDia] || encabezados[indiceDia]
                    : "Fin de jornada",
                horaSiguiente: siguiente
                    ? `Comienza a las ${horaLegible(siguiente.inicio)}`
                    : "Jornada terminada",
                cuenta: formatearCuenta(
                    Math.max(0, actual.fin * 60 - (minutos * 60 + segundos))
                ),
                inicio: actual.horaInicio,
                fin: actual.horaFin,
                progreso: (
                    (minutos - actual.inicio) /
                    (actual.fin - actual.inicio)
                ) * 100
            });

            return;
        }

        if (siguiente) {
            mostrarEstado({
                materia: minutos < periodos[0].inicio
                    ? "Antes de clases"
                    : "Entre periodos",
                mensaje: minutos < periodos[0].inicio
                    ? "La jornada escolar todavía no comienza."
                    : "No hay una clase en curso en este momento.",
                siguiente: siguiente.materias[indiceDia] || encabezados[indiceDia],
                horaSiguiente: `Comienza a las ${horaLegible(siguiente.inicio)}`,
                cuenta: formatearCuenta(
                    Math.max(0, siguiente.inicio * 60 - (minutos * 60 + segundos))
                )
            });

            return;
        }

        const ultimoPeriodo = periodos[periodos.length - 1];

        mostrarEstado({
            materia: "Jornada terminada",
            mensaje: `Las clases del día finalizaron a las ${horaLegible(ultimoPeriodo.fin)}.`,
            siguiente: "Sin más clases hoy",
            horaSiguiente: "Consulta el horario de mañana",
            cuenta: "00:00:00"
        });
    }

    actualizar();
    window.setInterval(actualizar, 1000);
}


/* ==========================================
   INICIALIZACIÓN
========================================== */

document.addEventListener("DOMContentLoaded", () => {
    cargarAvisosPublicos();
    cargarTareasPublicas();
    cargarEventosPublicos();
    actualizarFecha();
    iniciarHorarioInteligente();
});