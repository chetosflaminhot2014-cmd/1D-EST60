const API_BASE = "https://oned-est60-server.onrender.com";


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
        const response = await fetch(`${API_BASE}/api/avisos`);

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
        const response = await fetch(`${API_BASE}/api/tareas`);

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
        const response = await fetch(`${API_BASE}/api/eventos`);

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

        let horas = Number(coincidencia[1]);
        const minutos = Number(coincidencia[2]);

        // En esta tabla, 1:10 corresponde a la 1:10 p. m.
        if (horas === 1) horas = 13;

        return horas * 60 + minutos;
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


    // Vista consultable por día y resumen calculado desde la tabla original.
    const dias = [
        { nombre: "Lunes", indice: 0 },
        { nombre: "Martes", indice: 1 },
        { nombre: "Miércoles", indice: 2 },
        { nombre: "Jueves", indice: 3 },
        { nombre: "Viernes", indice: 4 }
    ];

    const estilosVistaDia = document.createElement("style");
    estilosVistaDia.textContent = [
        ".smart-day-tools{margin-top:20px;padding:18px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(3,10,20,.22)}",
        ".smart-day-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px}",
        ".smart-day-toolbar label{display:block;color:#cbd5e1;font-size:12px;font-weight:700;margin-bottom:5px}",
        ".smart-day-toolbar select{min-width:190px;max-width:100%;padding:10px 12px;color:#f8fafc;background:#102035;border:1px solid #334155;border-radius:8px;font:inherit}",
        ".smart-day-save{color:#93c5fd;font-size:11px}",
        ".smart-day-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}",
        ".smart-day-stat{padding:12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.16);border-radius:9px}",
        ".smart-day-stat span{display:block;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.7px}",
        ".smart-day-stat strong{display:block;margin-top:4px;color:#f8fafc;font-size:19px}",
        ".smart-day-agenda{display:grid;gap:7px}",
        ".smart-day-row{display:grid;grid-template-columns:105px minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 12px;background:rgba(15,23,42,.4);border:1px solid rgba(148,163,184,.13);border-radius:8px}",
        ".smart-day-row-time{color:#93c5fd;font-size:11px;font-weight:700}",
        ".smart-day-row-subject{color:#f8fafc;font-size:13px;font-weight:700}",
        ".smart-day-row-duration{color:#94a3b8;font-size:11px;white-space:nowrap}",
        ".smart-day-row.is-break{background:rgba(146,64,14,.15)}",
        ".smart-day-row.is-break .smart-day-row-subject{color:#fcd34d}",
        "@media(max-width:600px){.smart-day-stats{grid-template-columns:1fr}.smart-day-row{grid-template-columns:1fr auto;gap:4px 10px}.smart-day-row-time{grid-column:1/-1}.smart-day-row-subject{font-size:12px}}"
    ].join("\n");
    document.head.appendChild(estilosVistaDia);

    const herramientasDia = document.createElement("div");
    herramientasDia.className = "smart-day-tools";
    herramientasDia.innerHTML =
        '<div class="smart-day-toolbar">' +
            '<div><label for="smartDaySelect">Consultar horario por día</label>' +
            '<select id="smartDaySelect" aria-label="Seleccionar día del horario">' +
                '<option value="auto">Hoy (automático)</option>' +
                dias.map(function(dia) {
                    return '<option value="' + dia.indice + '">' + dia.nombre + '</option>';
                }).join("") +
            '</select></div>' +
            '<span class="smart-day-save" id="smartDaySaved">La selección se guarda en este dispositivo.</span>' +
        '</div>' +
        '<div class="smart-day-stats" id="smartDayStats"></div>' +
        '<div class="smart-day-agenda" id="smartDayAgenda"></div>';

    const avisoHorario = panel.querySelector(".smart-disclaimer");
    if (avisoHorario) {
        avisoHorario.insertAdjacentElement("afterend", herramientasDia);
    } else {
        panel.appendChild(herramientasDia);
    }

    const selectorDia = herramientasDia.querySelector("#smartDaySelect");
    const resumenDia = herramientasDia.querySelector("#smartDayStats");
    const agendaDia = herramientasDia.querySelector("#smartDayAgenda");
    const mensajeGuardado = herramientasDia.querySelector("#smartDaySaved");
    const claveGuardado = "est60_horario_dia_consultado";
    let diaSeleccionado = "auto";

    try {
        const guardado = localStorage.getItem(claveGuardado);
        if (guardado === "auto" || dias.some(function(dia) {
            return String(dia.indice) === guardado;
        })) {
            diaSeleccionado = guardado;
        }
    } catch (error) {
        console.warn("No se pudo leer la preferencia guardada del horario.", error);
    }

    selectorDia.value = diaSeleccionado;

    function mostrarAgendaDia(indiceDia) {
        const agenda = periodos.map(function(periodo) {
            return {
                inicio: periodo.inicio,
                fin: periodo.fin,
                horaInicio: periodo.horaInicio,
                horaFin: periodo.horaFin,
                receso: periodo.receso,
                materia: periodo.receso
                    ? "Receso"
                    : (periodo.materias[indiceDia] || "Materia no identificada")
            };
        });

        const clases = agenda.filter(function(periodo) {
            return !periodo.receso;
        });
        const minutosClase = clases.reduce(function(total, periodo) {
            return total + (periodo.fin - periodo.inicio);
        }, 0);
        const totalMinutosJornada = agenda.length
            ? agenda[agenda.length - 1].fin - agenda[0].inicio
            : 0;

        resumenDia.innerHTML =
            '<div class="smart-day-stat"><span>Clases del día</span><strong>' +
                clases.length + '</strong></div>' +
            '<div class="smart-day-stat"><span>Tiempo en clase</span><strong>' +
                Math.floor(minutosClase / 60) + ' h ' + (minutosClase % 60) + ' min</strong></div>' +
            '<div class="smart-day-stat"><span>Jornada total</span><strong>' +
                Math.floor(totalMinutosJornada / 60) + ' h ' + (totalMinutosJornada % 60) + ' min</strong></div>';

        agendaDia.innerHTML = agenda.map(function(periodo) {
            const duracion = periodo.fin - periodo.inicio;
            return '<div class="smart-day-row ' + (periodo.receso ? 'is-break' : '') + '">' +
                '<span class="smart-day-row-time">' +
                    escapeHTML(periodo.horaInicio) + ' — ' + escapeHTML(periodo.horaFin) +
                '</span>' +
                '<span class="smart-day-row-subject">' + escapeHTML(periodo.materia) + '</span>' +
                '<span class="smart-day-row-duration">' + duracion + ' min</span>' +
            '</div>';
        }).join("");
    }

    function actualizarVistaDia() {
        const ahora = new Date();
        const indiceDia = diaSeleccionado === "auto"
            ? (ahora.getDay() >= 1 && ahora.getDay() <= 5 ? ahora.getDay() - 1 : 0)
            : Number(diaSeleccionado);

        mostrarAgendaDia(indiceDia);

        if (diaSeleccionado === "auto") {
            mensajeGuardado.textContent = "Vista automática: muestra el día actual; el fin de semana muestra el lunes.";
        } else {
            mensajeGuardado.textContent = "Preferencia guardada: " + dias[indiceDia].nombre + ". Solo se guarda en este dispositivo.";
        }
    }

    selectorDia.addEventListener("change", function() {
        diaSeleccionado = selectorDia.value;
        try {
            localStorage.setItem(claveGuardado, diaSeleccionado);
        } catch (error) {
            console.warn("No se pudo guardar la preferencia del horario.", error);
            mensajeGuardado.textContent = "No se pudo guardar; la selección funciona mientras la página esté abierta.";
        }
        actualizarVistaDia();
    });

    actualizarVistaDia();

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


/* ==========================================
   SOPORTE PWA: INSTALACIÓN Y SERVICE WORKER
========================================== */

let eventoInstalacionPWA = null;

const botonInstalarPWA = document.getElementById("installAppButton");
const ayudaInstalacionPWA = document.getElementById("installAppHelp");

function mostrarAyudaInstalacion(mensaje) {
    if (!ayudaInstalacionPWA) return;
    ayudaInstalacionPWA.textContent = mensaje;
    ayudaInstalacionPWA.hidden = false;
}

window.addEventListener("beforeinstallprompt", evento => {
    evento.preventDefault();
    eventoInstalacionPWA = evento;
    if (botonInstalarPWA) {
        botonInstalarPWA.hidden = false;
        botonInstalarPWA.textContent = "Instalar app";
    }
});

window.addEventListener("appinstalled", () => {
    eventoInstalacionPWA = null;
    if (botonInstalarPWA) botonInstalarPWA.hidden = true;
    if (ayudaInstalacionPWA) {
        ayudaInstalacionPWA.hidden = false;
        ayudaInstalacionPWA.textContent = "La app se instaló correctamente en este dispositivo.";
    }
});

if (botonInstalarPWA) {
    botonInstalarPWA.addEventListener("click", async () => {
        if (eventoInstalacionPWA) {
            eventoInstalacionPWA.prompt();
            await eventoInstalacionPWA.userChoice;
            eventoInstalacionPWA = null;
            return;
        }

        const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const estaInstalada = window.matchMedia("(display-mode: standalone)").matches
            || window.navigator.standalone === true;

        if (estaInstalada) {
            mostrarAyudaInstalacion("La app ya está instalada en este dispositivo.");
        } else if (esIOS) {
            mostrarAyudaInstalacion('Para instalarla en iPhone o iPad: abre el menú Compartir de Safari y elige “Añadir a pantalla de inicio”.');
        } else {
            mostrarAyudaInstalacion('Si no aparece la ventana de instalación, abre el menú del navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.');
        }
    });
}

// Se registra únicamente en la página principal; el service worker no intercepta
// la API externa ni guarda respuestas de tareas, avisos o datos administrativos.
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .catch(error => console.error("No se pudo registrar la app instalable:", error));
    });
}
