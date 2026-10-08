// ==========================================
// MENÚ MÓVIL
// ==========================================

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



// ==========================================
// BOTÓN VOLVER ARRIBA
// ==========================================

const backToTop =
    document.getElementById("backToTop");


if (backToTop) {

    window.addEventListener("scroll", () => {

        if (window.scrollY > 500) {

            backToTop.classList.add("show");

        } else {

            backToTop.classList.remove("show");

        }

    });


    backToTop.addEventListener("click", () => {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

}



// ==========================================
// UTILIDADES
// ==========================================

function escapeHTML(texto) {

    const div =
        document.createElement("div");

    div.textContent =
        texto ?? "";

    return div.innerHTML;

}



function formatearFecha(fecha) {

    if (!fecha) {
        return "Sin fecha";
    }


    const partes =
        fecha
            .toString()
            .split("T")[0]
            .split("-");


    if (partes.length !== 3) {
        return fecha;
    }


    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}



// ==========================================
// AVISOS
// ==========================================

async function cargarAvisosPublicos() {

    const contenedor =
        document.getElementById("avisosPublicos");


    if (!contenedor) {
        return;
    }


    try {

        const response =
            await fetch("/api/avisos");


        if (!response.ok) {
            throw new Error("Error HTTP");
        }


        const avisos =
            await response.json();


        if (avisos.length === 0) {

            contenedor.innerHTML = `

                <div class="notice-card">

                    <div class="notice-icon">
                        !
                    </div>

                    <div class="notice-content">

                        <span class="notice-tag">
                            AVISO GENERAL
                        </span>

                        <h3>
                            No hay avisos publicados
                        </h3>

                        <p>
                            Actualmente no hay avisos importantes
                            para el grupo.
                        </p>

                    </div>

                    <span class="notice-date">
                        —
                    </span>

                </div>

            `;

            return;
        }


        contenedor.innerHTML = "";


        avisos.forEach((aviso, index) => {

            const fecha =
                new Date(aviso.fecha);


            const elemento =
                document.createElement("div");


            elemento.className =
                "notice-card";


            elemento.innerHTML = `

                <div class="notice-icon">
                    !
                </div>

                <div class="notice-content">

                    <span class="notice-tag">
                        AVISO GENERAL
                    </span>

                    <h3>
                        ${escapeHTML(aviso.titulo)}
                    </h3>

                    <p>
                        ${escapeHTML(aviso.contenido)}
                    </p>

                    <small>
                        Publicado:
                        ${fecha.toLocaleDateString("es-MX")}
                    </small>

                </div>

                <span class="notice-date">
                    ${String(index + 1).padStart(2, "0")}
                </span>

            `;


            contenedor.appendChild(elemento);

        });


    } catch (error) {

        console.error(
            "Error al cargar avisos:",
            error
        );


        contenedor.innerHTML = `

            <div class="notice-card">

                <div class="notice-icon">
                    !
                </div>

                <div class="notice-content">

                    <span class="notice-tag">
                        ERROR
                    </span>

                    <h3>
                        No se pudieron cargar los avisos
                    </h3>

                    <p>
                        No fue posible conectar con el servidor.
                    </p>

                </div>

            </div>

        `;

    }

}



// ==========================================
// TAREAS
// ==========================================

async function cargarTareasPublicas() {

    const contenedor =
        document.getElementById("tareasPublicas");


    if (!contenedor) {
        return;
    }


    try {

        const response =
            await fetch("/api/tareas");


        if (!response.ok) {
            throw new Error("Error HTTP");
        }


        const tareas =
            await response.json();


        if (tareas.length === 0) {

            contenedor.innerHTML = `

                <div class="task-card">

                    <div class="task-status">

                        <span class="status-dot"></span>

                        <span>
                            ACTUALMENTE
                        </span>

                    </div>

                    <h3>
                        No hay tareas registradas
                    </h3>

                    <p>
                        Actualmente no hay tareas pendientes
                        registradas para el grupo.
                    </p>

                </div>

            `;

            return;
        }


        contenedor.innerHTML = "";


        tareas.forEach(tarea => {

            const elemento =
                document.createElement("div");


            elemento.className =
                "task-card";


            elemento.innerHTML = `

                <div class="task-status">

                    <span class="status-dot"></span>

                    <span>
                        ${escapeHTML(tarea.materia)}
                    </span>

                </div>

                <h3>
                    ${escapeHTML(tarea.titulo)}
                </h3>

                <p>
                    ${escapeHTML(
                        tarea.descripcion || ""
                    )}
                </p>

                <strong>
                    Entrega:
                    ${formatearFecha(
                        tarea.fecha_entrega
                    )}
                </strong>

            `;


            contenedor.appendChild(elemento);

        });


    } catch (error) {

        console.error(
            "Error al cargar tareas:",
            error
        );


        contenedor.innerHTML = `

            <div class="task-card">

                <div class="task-status">

                    <span class="status-dot"></span>

                    <span>
                        ERROR
                    </span>

                </div>

                <h3>
                    No se pudieron cargar las tareas
                </h3>

                <p>
                    No fue posible conectar con el servidor.
                </p>

            </div>

        `;

    }

}



// ==========================================
// EVENTOS / CALENDARIO
// ==========================================

async function cargarEventosPublicos() {

    const contenedor =
        document.getElementById("eventosPublicos");


    if (!contenedor) {
        return;
    }


    try {

        const response =
            await fetch("/api/eventos");


        if (!response.ok) {
            throw new Error("Error HTTP");
        }


        const eventos =
            await response.json();


        if (eventos.length === 0) {

            contenedor.innerHTML = `

                <div class="calendar-card">

                    <span>
                        —
                    </span>

                    <strong>
                        No hay eventos
                    </strong>

                    <p>
                        Actualmente no hay fechas importantes
                        registradas.
                    </p>

                </div>

            `;

            return;
        }


        contenedor.innerHTML = "";


        eventos.forEach((evento, index) => {

            const elemento =
                document.createElement("div");


            elemento.className =
                "calendar-card";


            elemento.innerHTML = `

                <span>
                    ${String(index + 1).padStart(2, "0")}
                </span>

                <strong>
                    ${escapeHTML(evento.titulo)}
                </strong>

                <p>
                    ${escapeHTML(
                        evento.descripcion || ""
                    )}
                </p>

                <small>
                    ${formatearFecha(
                        evento.fecha
                    )}
                </small>

            `;


            contenedor.appendChild(elemento);

        });


    } catch (error) {

        console.error(
            "Error al cargar eventos:",
            error
        );


        contenedor.innerHTML = `

            <div class="calendar-card">

                <span>
                    !
                </span>

                <strong>
                    Error al cargar
                </strong>

                <p>
                    No fue posible conectar con el servidor.
                </p>

            </div>

        `;

    }

}



// ==========================================
// ÚLTIMA ACTUALIZACIÓN
// ==========================================

function actualizarFecha() {

    const elemento =
        document.getElementById("lastUpdate");


    if (!elemento) {
        return;
    }


    const ahora =
        new Date();


    elemento.textContent =
        ahora.toLocaleString("es-MX", {

            dateStyle: "medium",

            timeStyle: "short"

        });

}



// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        cargarAvisosPublicos();

        cargarTareasPublicas();

        cargarEventosPublicos();

        actualizarFecha();

    }
);