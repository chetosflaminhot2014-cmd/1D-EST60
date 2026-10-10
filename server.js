const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");
const admin = require("firebase-admin");

// Firebase Admin solo se activa cuando la clave de servicio está configurada
// como variable privada FIREBASE_SERVICE_ACCOUNT_JSON en el servidor.
let firebaseMessaging = null;
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        firebaseMessaging = admin.messaging();
        console.log("Firebase Cloud Messaging: CONFIGURADO");
    } else {
        console.log("Firebase Cloud Messaging: pendiente de configurar FIREBASE_SERVICE_ACCOUNT_JSON");
    }
} catch (error) {
    console.error("ERROR AL CONFIGURAR FIREBASE CLOUD MESSAGING:", error.message);
}

async function enviarNotificacionPush(titulo, contenido) {
    if (!firebaseMessaging) return false;

    const safeTitle = String(titulo || "Aviso de 1°D EST60").slice(0, 200);
    const safeBody = String(contenido || "Hay una nueva actualización escolar.").slice(0, 1000);

    try {
        const messageId = await firebaseMessaging.send({
            topic: "1d-est60-all",
            notification: {
                title: safeTitle,
                body: safeBody
            },
            data: {
                title: safeTitle,
                body: safeBody
            }
        });
        console.log("Notificación push enviada:", messageId);
        return true;
    } catch (error) {
        console.error("ERROR AL ENVIAR NOTIFICACIÓN PUSH:", error.message);
        return false;
    }
}

const app = express();
const PORT = process.env.PORT || 10000;

// ========================================
// CONFIGURACIÓN DE POSTGRESQL
// LOCAL + RENDER
// ========================================

const isRender = process.env.RENDER === "true";

let poolConfig;

if (isRender) {
    // ========================================
    // RENDER
    // ========================================

    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    };

    console.log("========================================");
    console.log("Configuración PostgreSQL");
    console.log("========================================");
    console.log("Entorno: RENDER");
    console.log(
        "DATABASE_URL:",
        process.env.DATABASE_URL ? "CONFIGURADA" : "NO CONFIGURADA"
    );
    console.log("========================================");

} else {
    // ========================================
    // LOCAL
    // ========================================

    poolConfig = {
        host: process.env.PGHOST || "localhost",
        port: process.env.PGPORT || 5432,
        database: process.env.PGDATABASE || "est60",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD,
        ssl: false
    };

    console.log("========================================");
    console.log("Configuración PostgreSQL");
    console.log("========================================");
    console.log("Entorno: LOCAL");
    console.log("Host:", process.env.PGHOST || "localhost");
    console.log("Puerto:", process.env.PGPORT || 5432);
    console.log("Base de datos:", process.env.PGDATABASE || "est60");
    console.log("Usuario:", process.env.PGUSER || "postgres");
    console.log(
        "Contraseña:",
        process.env.PGPASSWORD ? "CONFIGURADA" : "NO CONFIGURADA"
    );
    console.log("========================================");
}

const pool = new Pool(poolConfig);

// ========================================
// ERRORES DEL POOL
// ========================================

pool.on("error", (error) => {
    console.error("ERROR DEL POOL DE POSTGRESQL:", error);
});

// ========================================
// MIDDLEWARE
// ========================================

const allowedOrigins = [
    "https://oned-est60.onrender.com",
    "https://localhost"
];

app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Permite el sitio oficial y subdominios de Render, donde se aloja la web.
    const isRenderOrigin =
        typeof origin === "string" &&
        /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);

    if (allowedOrigins.includes(origin) || isRenderOrigin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Vary", "Origin");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Admin-Key, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json({ limit: "5mb" }));

function imagenValida(imagen) {
    return imagen === null || imagen === undefined || imagen === ""
        || (typeof imagen === "string"
            && imagen.length <= 1450000
            && imagen.startsWith("data:image/jpeg;base64,")
            && /^[A-Za-z0-9+/=]+$/.test(imagen.slice("data:image/jpeg;base64,".length)));
}

const imagenesSchemaReady = Promise.all([
    pool.query("ALTER TABLE avisos ADD COLUMN IF NOT EXISTS imagen TEXT").catch(error => console.error("Migración imagen avisos:", error.message)),
    pool.query("ALTER TABLE tareas ADD COLUMN IF NOT EXISTS imagen TEXT").catch(error => console.error("Migración imagen tareas:", error.message)),
    pool.query("ALTER TABLE eventos ADD COLUMN IF NOT EXISTS imagen TEXT").catch(error => console.error("Migración imagen eventos:", error.message)),
    pool.query(`CREATE TABLE IF NOT EXISTS imagenes_calendario (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        imagen TEXT NOT NULL,
        actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).catch(error => console.error("Migración imagen calendario:", error.message))
]);

app.use((req, res, next) => {
    const rutasConImagen = ["/api/avisos", "/api/tareas", "/api/eventos", "/api/calendario/imagen"];
    if (rutasConImagen.some(ruta => req.path === ruta || req.path.startsWith(ruta + "/"))) {
        imagenesSchemaReady.then(() => next()).catch(next);
    } else {
        next();
    }
});

// Historial persistente de operaciones administrativas.
pool.query(`
    CREATE TABLE IF NOT EXISTS historial_admin (
        id SERIAL PRIMARY KEY,
        accion VARCHAR(30) NOT NULL,
        entidad VARCHAR(30) NOT NULL,
        registro_id INTEGER,
        titulo TEXT NOT NULL DEFAULT '',
        datos_anteriores JSONB,
        datos_nuevos JSONB,
        fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`).catch(error => console.error("ERROR AL PREPARAR EL HISTORIAL:", error));

function quitarImagenDeHistorial(datos) {
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) return datos;
    const { imagen: imagenOmitida, ...copia } = datos;
    return copia;
}

async function registrarCambio(accion, entidad, registro, anterior = null, nuevo = null) {
    try {
        const titulo = (nuevo && (nuevo.titulo || nuevo.materia))
            || (anterior && (anterior.titulo || anterior.materia))
            || "Registro";
        await pool.query(
            `INSERT INTO historial_admin
             (accion, entidad, registro_id, titulo, datos_anteriores, datos_nuevos)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [accion, entidad, registro ? registro.id : null, titulo, quitarImagenDeHistorial(anterior), quitarImagenDeHistorial(nuevo)]
        );
    } catch (error) {
        console.error("ERROR AL REGISTRAR CAMBIO:", error);
    }
}

// La clave de administración debe configurarse como variable ADMIN_KEY en Render.
function requireAdmin(req, res, next) {
    const configuredKey = process.env.ADMIN_KEY;
    const providedKey = req.get("x-admin-key");

    if (!configuredKey) {
        return res.status(503).json({
            error: "Falta configurar ADMIN_KEY en las variables de entorno de Render."
        });
    }

    if (!providedKey || providedKey !== configuredKey) {
        return res.status(401).json({ error: "Acceso de administrador no autorizado." });
    }

    next();
}

app.post("/api/admin/login", (req, res) => {
    const configuredKey = process.env.ADMIN_KEY;
    const providedKey = req.body && req.body.password;

    if (!configuredKey) {
        return res.status(503).json({
            error: "El administrador aún no ha configurado la clave en Render."
        });
    }

    if (typeof providedKey !== "string" || providedKey !== configuredKey) {
        return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    res.json({ success: true });
});

app.use(express.static(path.join(__dirname)));

// ========================================
// AVISOS
// ========================================

// Obtener avisos
app.get("/api/avisos", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM avisos ORDER BY fecha DESC, id DESC"
        );

        res.json(result.rows);

    } catch (error) {

        console.error("ERROR AL OBTENER AVISOS:", error);

        res.status(500).json({
            error: "Error al obtener los avisos",
            detalle: error.message
        });
    }
});

// Crear aviso
app.post("/api/avisos", requireAdmin, async (req, res) => {
    try {

        const { titulo, contenido, imagen = null } = req.body;
        if (!imagenValida(imagen)) return res.status(400).json({ error: "La imagen no es válida o supera el límite permitido." });

        if (!titulo || !contenido) {
            return res.status(400).json({
                error: "Título y contenido son obligatorios"
            });
        }

        const result = await pool.query(
            `INSERT INTO avisos
            (titulo, contenido, imagen)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [titulo, contenido, imagen]
        );

        await registrarCambio("CREACIÓN", "Aviso", result.rows[0], null, result.rows[0]);
        await enviarNotificacionPush(result.rows[0].titulo, result.rows[0].contenido);
        res.status(201).json(result.rows[0]);

    } catch (error) {

        console.error("ERROR AL CREAR AVISO:", error);

        res.status(500).json({
            error: "Error al crear el aviso",
            detalle: error.message
        });
    }
});

// Editar aviso
app.put("/api/avisos/:id", requireAdmin, async (req, res) => {
    try {
        const { titulo, contenido } = req.body;
        const imagen = Object.prototype.hasOwnProperty.call(req.body, "imagen") ? req.body.imagen : undefined;
        if (imagen !== undefined && !imagenValida(imagen)) return res.status(400).json({ error: "La imagen no es válida o supera el límite permitido." });
        if (typeof titulo !== "string" || !titulo.trim() || typeof contenido !== "string" || !contenido.trim()) {
            return res.status(400).json({ error: "Título y contenido son obligatorios." });
        }
        const anterior = await pool.query("SELECT * FROM avisos WHERE id = $1", [req.params.id]);
        if (!anterior.rows.length) return res.status(404).json({ error: "Aviso no encontrado." });
        const result = await pool.query(
            "UPDATE avisos SET titulo = $1, contenido = $2, imagen = COALESCE($3, imagen) WHERE id = $4 RETURNING *",
            [titulo.trim(), contenido.trim(), imagen === undefined ? null : imagen, req.params.id]
        );
        await registrarCambio("EDICIÓN", "Aviso", result.rows[0], anterior.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("ERROR AL EDITAR AVISO:", error);
        res.status(500).json({ error: "Error al editar el aviso." });
    }
});

// Eliminar aviso
app.delete("/api/avisos/:id", requireAdmin, async (req, res) => {
    try {

        const result = await pool.query(
            "DELETE FROM avisos WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: "Aviso no encontrado." });
        }
        await registrarCambio("ELIMINACIÓN", "Aviso", result.rows[0], result.rows[0], null);
        res.json({ success: true });

    } catch (error) {

        console.error("ERROR AL ELIMINAR AVISO:", error);

        res.status(500).json({
            error: "Error al eliminar el aviso",
            detalle: error.message
        });
    }
});

// ========================================
// TAREAS
// ========================================

// Elimina tareas cuya fecha de entrega fue hace dos días o más.
// Se usa la fecha local de México y se conserva el registro en el historial.
let limpiezaTareasEnCurso = false;

async function eliminarTareasVencidas() {
    if (limpiezaTareasEnCurso) return;
    limpiezaTareasEnCurso = true;

    try {
        const result = await pool.query(
            `DELETE FROM tareas
             WHERE fecha_entrega <=
                 (CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')::date - 2
             RETURNING *`
        );

        for (const tarea of result.rows) {
            await registrarCambio(
                "ELIMINACIÓN AUTOMÁTICA",
                "Tarea",
                tarea,
                tarea,
                null
            );
        }

        if (result.rowCount > 0) {
            console.log(`Limpieza automática: se eliminaron ${result.rowCount} tarea(s) vencida(s).`);
        }
    } catch (error) {
        console.error("ERROR AL ELIMINAR TAREAS VENCIDAS:", error);
    } finally {
        limpiezaTareasEnCurso = false;
    }
}

// Ejecuta la limpieza al iniciar y después cada seis horas.
// Si el servicio se duerme, también se limpia cuando alguien consulta las tareas.
eliminarTareasVencidas();
const intervaloLimpiezaTareas = setInterval(eliminarTareasVencidas, 6 * 60 * 60 * 1000);
if (typeof intervaloLimpiezaTareas.unref === "function") {
    intervaloLimpiezaTareas.unref();
}

// Obtener tareas
app.get("/api/tareas", async (req, res) => {
    try {
        await eliminarTareasVencidas();

        const result = await pool.query(
            "SELECT * FROM tareas ORDER BY fecha_entrega ASC, id ASC"
        );

        res.json(result.rows);

    } catch (error) {

        console.error("ERROR AL OBTENER TAREAS:", error);

        res.status(500).json({
            error: "Error al obtener las tareas",
            detalle: error.message
        });
    }
});

// Crear tarea
app.post("/api/tareas", requireAdmin, async (req, res) => {
    try {

        const { materia, titulo, descripcion, fecha_entrega, imagen = null } = req.body;
        if (!imagenValida(imagen)) return res.status(400).json({ error: "La imagen no es válida o supera el límite permitido." });

        if (!materia || !titulo || !fecha_entrega) {
            return res.status(400).json({
                error: "Materia, título y fecha son obligatorios"
            });
        }

        const result = await pool.query(
            `INSERT INTO tareas
            (materia, titulo, descripcion, fecha_entrega, imagen)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [materia, titulo, descripcion || "", fecha_entrega, imagen]
        );

        await registrarCambio("CREACIÓN", "Tarea", result.rows[0], null, result.rows[0]);
        await enviarNotificacionPush(
            `Nueva tarea: ${result.rows[0].materia}`,
            `${result.rows[0].titulo} — Entrega: ${result.rows[0].fecha_entrega}`
        );
        res.status(201).json(result.rows[0]);

    } catch (error) {

        console.error("ERROR AL CREAR TAREA:", error);

        res.status(500).json({
            error: "Error al crear la tarea",
            detalle: error.message
        });
    }
});

// Editar tarea
app.put("/api/tareas/:id", requireAdmin, async (req, res) => {
    try {
        const { materia, titulo, descripcion, fecha_entrega } = req.body;
        const imagen = Object.prototype.hasOwnProperty.call(req.body, "imagen") ? req.body.imagen : undefined;
        if (imagen !== undefined && !imagenValida(imagen)) return res.status(400).json({ error: "La imagen no es válida o supera el límite permitido." });
        if (typeof materia !== "string" || !materia.trim() || typeof titulo !== "string" || !titulo.trim() || typeof fecha_entrega !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_entrega)) {
            return res.status(400).json({ error: "Materia, título y fecha válida son obligatorios." });
        }
        const anterior = await pool.query("SELECT * FROM tareas WHERE id = $1", [req.params.id]);
        if (!anterior.rows.length) return res.status(404).json({ error: "Tarea no encontrada." });
        const result = await pool.query(
            "UPDATE tareas SET materia = $1, titulo = $2, descripcion = $3, fecha_entrega = $4, imagen = COALESCE($5, imagen) WHERE id = $6 RETURNING *",
            [materia.trim(), titulo.trim(), typeof descripcion === "string" ? descripcion.trim() : "", fecha_entrega, imagen === undefined ? null : imagen, req.params.id]
        );
        await registrarCambio("EDICIÓN", "Tarea", result.rows[0], anterior.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("ERROR AL EDITAR TAREA:", error);
        res.status(500).json({ error: "Error al editar la tarea." });
    }
});

// Eliminar tarea
app.delete("/api/tareas/:id", requireAdmin, async (req, res) => {
    try {

        const result = await pool.query(
            "DELETE FROM tareas WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: "Tarea no encontrada." });
        }
        await registrarCambio("ELIMINACIÓN", "Tarea", result.rows[0], result.rows[0], null);
        res.json({ success: true });

    } catch (error) {

        console.error("ERROR AL ELIMINAR TAREA:", error);

        res.status(500).json({
            error: "Error al eliminar la tarea",
            detalle: error.message
        });
    }
});

// ========================================
// EVENTOS
// ========================================

// Obtener eventos
app.get("/api/eventos", async (req, res) => {
    try {

        const result = await pool.query(
            "SELECT * FROM eventos ORDER BY fecha ASC, id ASC"
        );

        res.json(result.rows);

    } catch (error) {

        console.error("ERROR AL OBTENER EVENTOS:", error);

        res.status(500).json({
            error: "Error al obtener los eventos",
            detalle: error.message
        });
    }
});

// Crear evento
app.post("/api/eventos", requireAdmin, async (req, res) => {
    try {

        const { titulo, descripcion, fecha, imagen = null } = req.body;
        if (!imagenValida(imagen)) return res.status(400).json({ error: "La imagen no es válida o supera el límite permitido." });

        if (!titulo || !fecha) {
            return res.status(400).json({
                error: "Título y fecha son obligatorios"
            });
        }

        const result = await pool.query(
            `INSERT INTO eventos
            (titulo, descripcion, fecha, imagen)
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [titulo, descripcion || "", fecha, imagen]
        );

        await registrarCambio("CREACIÓN", "Evento", result.rows[0], null, result.rows[0]);
        await enviarNotificacionPush(
            `Nuevo evento: ${result.rows[0].titulo}`,
            result.rows[0].descripcion || `Fecha: ${result.rows[0].fecha}`
        );
        res.status(201).json(result.rows[0]);

    } catch (error) {

        console.error("ERROR AL CREAR EVENTO:", error);

        res.status(500).json({
            error: "Error al crear el evento",
            detalle: error.message
        });
    }
});

// Editar evento
app.put("/api/eventos/:id", requireAdmin, async (req, res) => {
    try {
        const { titulo, descripcion, fecha } = req.body;
        const imagen = Object.prototype.hasOwnProperty.call(req.body, "imagen") ? req.body.imagen : undefined;
        if (imagen !== undefined && !imagenValida(imagen)) return res.status(400).json({ error: "La imagen no es válida o supera el límite permitido." });
        if (typeof titulo !== "string" || !titulo.trim() || typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({ error: "Título y fecha válida son obligatorios." });
        }
        const anterior = await pool.query("SELECT * FROM eventos WHERE id = $1", [req.params.id]);
        if (!anterior.rows.length) return res.status(404).json({ error: "Evento no encontrado." });
        const result = await pool.query(
            "UPDATE eventos SET titulo = $1, descripcion = $2, fecha = $3, imagen = COALESCE($4, imagen) WHERE id = $5 RETURNING *",
            [titulo.trim(), typeof descripcion === "string" ? descripcion.trim() : "", fecha, imagen === undefined ? null : imagen, req.params.id]
        );
        await registrarCambio("EDICIÓN", "Evento", result.rows[0], anterior.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("ERROR AL EDITAR EVENTO:", error);
        res.status(500).json({ error: "Error al editar el evento." });
    }
});

// Eliminar evento
app.delete("/api/eventos/:id", requireAdmin, async (req, res) => {
    try {

        const result = await pool.query(
            "DELETE FROM eventos WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: "Evento no encontrado." });
        }
        await registrarCambio("ELIMINACIÓN", "Evento", result.rows[0], result.rows[0], null);
        res.json({ success: true });

    } catch (error) {

        console.error("ERROR AL ELIMINAR EVENTO:", error);

        res.status(500).json({
            error: "Error al eliminar el evento",
            detalle: error.message
        });
    }
});

// Consultar historial administrativo (solo administrador).
app.get("/api/admin/historial", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, accion, entidad, registro_id, titulo, datos_anteriores, datos_nuevos, fecha FROM historial_admin ORDER BY fecha DESC, id DESC LIMIT 200"
        );
        res.json(result.rows);
    } catch (error) {
        console.error("ERROR AL OBTENER HISTORIAL:", error);
        res.status(500).json({ error: "No se pudo obtener el historial." });
    }
});

// Gemini API: la clave se guarda solo como variable privada en Render.
// Si Gemini 3.8 Flash está saturado, se reintenta y luego se usa un modelo alternativo.
app.post("/api/gemini", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const task = typeof req.body?.taskContext === "string" ? req.body.taskContext.slice(0, 1000) : "";

    if (!apiKey) {
        return res.status(503).json({ error: "Gemini no está configurado todavía. Falta GEMINI_API_KEY en Render." });
    }
    if (!message || message.length > 1200) {
        return res.status(400).json({ error: "Escribe una pregunta de hasta 1200 caracteres." });
    }

    const prompt = (task ? "Contexto de la tarea:\n" + task + "\n\n" : "") + message;
    const requestBody = {
        system_instruction: {
            parts: [{
                text: "Eres un asistente educativo para alumnos de secundaria de México. Responde en español claro y útil. Da una explicación completa pero concisa, con pasos claros y un ejemplo cuando ayude. Termina todas las frases y no cortes la respuesta a la mitad. Prioriza la exactitud sobre la seguridad aparente: no inventes datos, fuentes, citas ni instrucciones escolares. En temas históricos, culturales o científicos, distingue las variantes regionales y los hechos confirmados de las interpretaciones. Si no tienes suficiente certeza, dilo claramente y recomienda verificar con el libro de texto o el profesor. No pidas datos personales."
            }]
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1400 }
    };

    async function pedirModelo(modelo) {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent?key=" + encodeURIComponent(apiKey),
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            }
        );
        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            data = {};
        }
        return { response, data };
    }

    try {
        let resultado = await pedirModelo("gemini-3.8-flash");

        // 503 suele indicar saturación temporal. Reintenta una vez y, si persiste,
        // cambia a Gemini 3.5 Flash-Lite como alternativa.
        if (resultado.response.status === 503) {
            console.warn("Gemini 3.8 Flash está saturado; reintentando una vez.");
            await new Promise(resolve => setTimeout(resolve, 1200));
            resultado = await pedirModelo("gemini-3.8-flash");

            if (resultado.response.status === 503) {
                console.warn("Gemini 3.8 Flash sigue saturado; probando gemini-3.5-flash-lite.");
                resultado = await pedirModelo("gemini-3.5-flash-lite");
            }
        }

        const { response, data } = resultado;
        if (!response.ok) {
            const apiMessage = typeof data.error?.message === "string" ? data.error.message : "";
            console.error("Gemini API error:", response.status, apiMessage.slice(0, 300));

            let mensaje = "Gemini no pudo responder. Inténtalo más tarde.";
            if (response.status === 400 || response.status === 403) {
                mensaje = "La clave de Gemini parece inválida o no tiene permiso. Revisa GEMINI_API_KEY en Render.";
            } else if (response.status === 429) {
                mensaje = "Gemini alcanzó el límite de uso de la API. Espera un poco e inténtalo de nuevo.";
            } else if (response.status === 404) {
                mensaje = "El modelo de Gemini no está disponible para esta clave. Hay que revisar la configuración del modelo.";
            } else if (response.status === 503) {
                mensaje = "Los modelos de Gemini están temporalmente saturados. Espera un momento e inténtalo de nuevo.";
            }
            return res.status(502).json({ error: mensaje });
        }

        const answer = (data.candidates?.[0]?.content?.parts || [])
            .map(part => part.text || "")
            .join("\n")
            .trim();

        if (!answer) {
            return res.status(502).json({ error: "Gemini no devolvió una respuesta." });
        }
        return res.json({ answer });
    } catch (error) {
        console.error("Error de Gemini:", error.message);
        return res.status(500).json({ error: "No se pudo conectar con Gemini." });
    }
});

app.get("/api/calendario/imagen", async (req, res) => {
    try {
        const result = await pool.query("SELECT imagen, actualizado FROM imagenes_calendario WHERE id = 1");
        res.json(result.rows[0] || { imagen: null });
    } catch (error) {
        console.error("ERROR AL OBTENER IMAGEN DEL CALENDARIO:", error);
        res.status(500).json({ error: "No se pudo cargar la imagen del calendario." });
    }
});

app.put("/api/calendario/imagen", requireAdmin, async (req, res) => {
    try {
        const { imagen } = req.body || {};
        if (typeof imagen !== "string" || !imagenValida(imagen) || !imagen) {
            return res.status(400).json({ error: "Selecciona una imagen válida de calendario." });
        }
        const result = await pool.query(
            `INSERT INTO imagenes_calendario (id, imagen, actualizado)
             VALUES (1, $1, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET imagen = EXCLUDED.imagen, actualizado = CURRENT_TIMESTAMP
             RETURNING imagen, actualizado`,
            [imagen]
        );
        await registrarCambio("ACTUALIZACIÓN", "Calendario", { id: 1, titulo: "Imagen del calendario" }, null, { actualizado: result.rows[0].actualizado });
        res.json({ success: true, actualizado: result.rows[0].actualizado });
    } catch (error) {
        console.error("ERROR AL GUARDAR IMAGEN DEL CALENDARIO:", error);
        res.status(500).json({ error: "No se pudo guardar la imagen del calendario." });
    }
});

app.delete("/api/calendario/imagen", requireAdmin, async (req, res) => {
    try {
        await pool.query("DELETE FROM imagenes_calendario WHERE id = 1");
        await registrarCambio("ELIMINACIÓN", "Calendario", { id: 1, titulo: "Imagen del calendario" });
        res.json({ success: true });
    } catch (error) {
        console.error("ERROR AL ELIMINAR IMAGEN DEL CALENDARIO:", error);
        res.status(500).json({ error: "No se pudo quitar la imagen del calendario." });
    }
});

// ========================================
// ESTADO DEL SISTEMA
// ========================================

app.get("/api/health", async (req, res) => {
    try {

        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "online",
            database: "connected",
            environment: isRender ? "render" : "local",
            time: result.rows[0].now
        });

    } catch (error) {

        console.error("ERROR DE BASE DE DATOS:", error);

        res.status(500).json({
            status: "online",
            database: "disconnected",
            environment: isRender ? "render" : "local",
            error: error.message
        });
    }
});

// ========================================
// CHAT GRUPAL CON CORREO INSTITUCIONAL
// ========================================
const chatTablesReady = Promise.all([
    pool.query("CREATE TABLE IF NOT EXISTS credenciales_alumnos (id BIGSERIAL PRIMARY KEY, correo VARCHAR(254) NOT NULL UNIQUE, apodo VARCHAR(32) NOT NULL, edad SMALLINT NOT NULL CHECK (edad BETWEEN 10 AND 15), foto TEXT, estado VARCHAR(16) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')), motivo TEXT NOT NULL DEFAULT '', autorizacion_tutor BOOLEAN NOT NULL DEFAULT FALSE, creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, revisada_en TIMESTAMPTZ)"),
    pool.query("CREATE TABLE IF NOT EXISTS chat_mensajes (id BIGSERIAL PRIMARY KEY, correo VARCHAR(254) NOT NULL, apodo VARCHAR(32), mensaje VARCHAR(1200) NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    pool.query("ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS apodo VARCHAR(32)"),
    pool.query("CREATE TABLE IF NOT EXISTS chat_sesiones (token_hash CHAR(64) PRIMARY KEY, correo VARCHAR(254) NOT NULL, expira_en TIMESTAMPTZ NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)")
]).catch(error => {
    console.error("ERROR PREPARANDO CHAT Y CREDENCIALES:", error.message);
    throw error;
});
const credencialesHabilitadas = () => process.env.CREDENTIALS_ENABLED === "true";
function correoEscolarValido(email) {
    return typeof email === "string" && email.length <= 254 && /^[^\s@]+@chih\.nuevaescuela\.mx$/i.test(email.trim());
}
const chatCodes = new Map();
const chatLastRequest = new Map();
const chatDomain = "@chih.nuevaescuela.mx";
function validInstitutionalEmail(email) {
    return typeof email === "string" && email.length <= 254 && /^[^\s@]+@chih\.nuevaescuela\.mx$/i.test(email.trim());
}
function chatHash(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}
function chatResendConfig() {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) return null;
    return { apiKey, from };
}
app.use((req, res, next) => {
    if (req.path.startsWith("/api/chat/")) {
        chatTablesReady.then(() => next()).catch(() => {
            if (!res.headersSent) res.status(503).json({ error: "El chat no está disponible temporalmente." });
        });
    } else next();
});
app.post("/api/chat/auth/request-code", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!credencialesHabilitadas()) return res.status(503).json({ error: "El acceso al chat por credencial todavía no está habilitado por el administrador responsable." });
    if (!validInstitutionalEmail(email)) return res.status(400).json({ error: "Usa tu correo terminado en @chih.nuevaescuela.mx." });
    try {
        const access = await pool.query("SELECT estado FROM credenciales_alumnos WHERE correo = $1", [email]);
        if (!access.rows.length || access.rows[0].estado !== "aprobada") return res.status(403).json({ error: "Necesitas una credencial aprobada para acceder al chat." });
    } catch (error) {
        console.error("ERROR COMPROBANDO CREDENCIAL:", error.message);
        return res.status(503).json({ error: "No se pudo comprobar tu credencial. Inténtalo más tarde." });
    }
    const resend = chatResendConfig();
    if (!resend) return res.status(503).json({ error: "El envío de códigos todavía no está configurado. Revisa RESEND_API_KEY y RESEND_FROM en Render." });
    const now = Date.now();
    if (now - (chatLastRequest.get(email) || 0) < 60000) return res.status(429).json({ error: "Espera un minuto antes de pedir otro código." });
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    chatCodes.set(email, { hash: chatHash(code), expires: now + 600000, attempts: 0 });
    chatLastRequest.set(email, now);
    try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + resend.apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: resend.from,
                to: [email],
                subject: "Código de acceso al chat de 1°D EST60",
                text: "Tu código de verificación es: " + code + "\nCaduca en 10 minutos. No lo compartas con nadie.",
                html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2>Chat de 1°D EST60</h2><p>Tu código de verificación es:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">' + code + '</p><p>Caduca en 10 minutos. No lo compartas con nadie.</p></div>'
            })
        });
        const emailResult = await emailResponse.json().catch(() => ({}));
        if (!emailResponse.ok) {
            const detail = typeof emailResult.message === "string" ? emailResult.message : "Error HTTP " + emailResponse.status;
            throw new Error("Resend rechazó el envío: " + detail);
        }
        res.json({ success: true, message: "Código enviado. Revisa tu correo institucional." });
    } catch (error) {
        chatCodes.delete(email);
        console.error("ERROR ENVIANDO CÓDIGO DE CHAT:", error.message);
        res.status(502).json({ error: "No se pudo enviar el correo. Inténtalo más tarde." });
    }
});
app.post("/api/chat/auth/verify-code", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!credencialesHabilitadas()) return res.status(503).json({ error: "El acceso al chat por credencial todavía no está habilitado por el administrador responsable." });
    if (!validInstitutionalEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Correo o código no válido." });
    const approved = await pool.query("SELECT estado FROM credenciales_alumnos WHERE correo = $1", [email]);
    if (!approved.rows.length || approved.rows[0].estado !== "aprobada") {
        chatCodes.delete(email);
        return res.status(403).json({ error: "Tu credencial no está aprobada para entrar al chat." });
    }
    const entry = chatCodes.get(email);
    if (!entry || Date.now() > entry.expires) {
        chatCodes.delete(email);
        return res.status(400).json({ error: "El código venció o no existe. Solicita uno nuevo." });
    }
    entry.attempts++;
    if (entry.attempts > 5) {
        chatCodes.delete(email);
        return res.status(429).json({ error: "Demasiados intentos. Solicita otro código." });
    }
    if (chatHash(code) !== entry.hash) return res.status(400).json({ error: "Código incorrecto." });
    chatCodes.delete(email);
    const token = crypto.randomBytes(32).toString("hex");
    await pool.query("INSERT INTO chat_sesiones (token_hash, correo, expira_en) VALUES ($1, $2, NOW() + INTERVAL '30 days')", [chatHash(token), email]);
    res.json({ success: true, token: token, email: email });
});
async function requireChatSession(req, res, next) {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token || token.length > 200) return res.status(401).json({ error: "Inicia sesión para usar el chat." });
    try {
        if (!credencialesHabilitadas()) return res.status(503).json({ error: "El acceso al chat está temporalmente deshabilitado." });
        const result = await pool.query("SELECT s.correo, c.apodo FROM chat_sesiones s JOIN credenciales_alumnos c ON c.correo = s.correo WHERE s.token_hash = $1 AND s.expira_en > NOW() AND c.estado = 'aprobada'", [chatHash(token)]);
        if (!result.rows.length) return res.status(401).json({ error: "Tu sesión venció o tu credencial ya no está aprobada." });
        req.chatEmail = result.rows[0].correo;
        req.chatNickname = result.rows[0].apodo;
        next();
    } catch (error) {
        console.error("ERROR VALIDANDO CHAT:", error.message);
        res.status(500).json({ error: "No se pudo validar tu sesión." });
    }
}
app.get("/api/chat/messages", requireChatSession, async (req, res) => {
    try {
        const after = Math.max(0, Number.parseInt(req.query.after, 10) || 0);
        const result = await pool.query("SELECT id, COALESCE(apodo, 'Alumno') AS apodo, mensaje, creado_en FROM chat_mensajes WHERE id > $1 ORDER BY id ASC LIMIT 100", [after]);
        res.json(result.rows);
    } catch (error) {
        console.error("ERROR LEYENDO CHAT:", error.message);
        res.status(500).json({ error: "No se pudieron cargar los mensajes." });
    }
});
app.post("/api/chat/messages", requireChatSession, async (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 1200) return res.status(400).json({ error: "El mensaje debe tener entre 1 y 1200 caracteres." });
    try {
        const result = await pool.query("INSERT INTO chat_mensajes (correo, apodo, mensaje) VALUES ($1, $2, $3) RETURNING id, apodo, mensaje, creado_en", [req.chatEmail, req.chatNickname, message]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("ERROR PUBLICANDO CHAT:", error.message);
        res.status(500).json({ error: "No se pudo publicar el mensaje." });
    }
});
app.post("/api/credentials", async (req, res) => {
    if (!credencialesHabilitadas()) return res.status(503).json({ error: "Las solicitudes están pausadas mientras se configura la revisión responsable." });
    const correo = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const apodo = typeof req.body?.nickname === "string" ? req.body.nickname.trim() : "";
    const edad = Number(req.body?.age);
    const foto = typeof req.body?.photo === "string" ? req.body.photo : "";
    const autorizacion = req.body?.guardianAuthorization === true;
    if (!correoEscolarValido(correo)) return res.status(400).json({ error: "Usa tu correo escolar institucional." });
    if (!/^[\p{L}0-9 _.-]{2,32}$/u.test(apodo)) return res.status(400).json({ error: "El apodo debe tener entre 2 y 32 caracteres." });
    if (!Number.isInteger(edad) || edad < 10 || edad > 15) return res.status(400).json({ error: "La edad permitida es de 10 a 15 años." });
    if (!autorizacion) return res.status(400).json({ error: "Un padre, madre o tutor debe autorizar la solicitud antes de enviarla." });
    if (!foto.startsWith("data:image/jpeg;base64,") || !imagenValida(foto)) return res.status(400).json({ error: "Sube una foto JPG válida y optimizada." });
    try {
        await chatTablesReady;
        const existing = await pool.query("SELECT estado FROM credenciales_alumnos WHERE correo = $1", [correo]);
        if (existing.rows[0]?.estado === "aprobada") return res.status(409).json({ error: "Este correo ya tiene una credencial aprobada." });
        await pool.query(
            `INSERT INTO credenciales_alumnos (correo, apodo, edad, foto, estado, motivo, autorizacion_tutor, creada_en, revisada_en)
             VALUES ($1, $2, $3, $4, 'pendiente', '', TRUE, CURRENT_TIMESTAMP, NULL)
             ON CONFLICT (correo) DO UPDATE SET apodo = EXCLUDED.apodo, edad = EXCLUDED.edad, foto = EXCLUDED.foto, estado = 'pendiente', motivo = '', autorizacion_tutor = TRUE, creada_en = CURRENT_TIMESTAMP, revisada_en = NULL`,
            [correo, apodo, edad, foto]
        );
        res.status(201).json({ success: true, message: "Solicitud recibida. Un administrador revisará la foto de forma privada." });
    } catch (error) {
        console.error("ERROR GUARDANDO SOLICITUD DE CREDENCIAL:", error.message);
        res.status(500).json({ error: "No se pudo guardar la solicitud." });
    }
});
app.get("/api/credentials/status", async (req, res) => {
    const correo = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
    if (!correoEscolarValido(correo)) return res.status(400).json({ error: "Correo escolar no válido." });
    if (!credencialesHabilitadas()) return res.status(503).json({ error: "El sistema de credenciales aún no está habilitado." });
    try {
        await chatTablesReady;
        const result = await pool.query("SELECT estado, motivo FROM credenciales_alumnos WHERE correo = $1", [correo]);
        if (!result.rows.length) return res.json({ status: "sin_solicitud" });
        return res.json({ status: result.rows[0].estado, reason: result.rows[0].estado === "rechazada" ? result.rows[0].motivo : "" });
    } catch (error) {
        res.status(500).json({ error: "No se pudo consultar el estado." });
    }
});
app.get("/api/admin/credentials", requireAdmin, async (req, res) => {
    try {
        await chatTablesReady;
        const result = await pool.query("SELECT id, correo, apodo, edad, foto, estado, motivo, creada_en FROM credenciales_alumnos WHERE estado = 'pendiente' ORDER BY creada_en ASC");
        res.json(result.rows);
    } catch (error) {
        console.error("ERROR LEYENDO SOLICITUDES:", error.message);
        res.status(500).json({ error: "No se pudieron cargar las solicitudes." });
    }
});
app.post("/api/admin/credentials/:id/review", requireAdmin, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const action = req.body?.action;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Solicitud no válida." });
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Elige aprobar o rechazar." });
    if (action === "reject" && !reason) return res.status(400).json({ error: "Escribe un motivo breve para que la persona sepa qué corregir." });
    try {
        await chatTablesReady;
        const result = await pool.query(
            "UPDATE credenciales_alumnos SET estado = $1, motivo = $2, foto = NULL, revisada_en = CURRENT_TIMESTAMP WHERE id = $3 AND estado = 'pendiente' RETURNING id, correo, apodo, estado",
            [action === "approve" ? "aprobada" : "rechazada", reason, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: "La solicitud ya no está pendiente o no existe." });
        if (action === "reject") await pool.query("DELETE FROM chat_sesiones WHERE correo = $1", [result.rows[0].correo]);
        await registrarCambio(action === "approve" ? "APROBACIÓN" : "RECHAZO", "Credencial", { id, titulo: result.rows[0].apodo }, null, { estado: result.rows[0].estado });
        res.json({ success: true, status: result.rows[0].estado, nickname: result.rows[0].apodo });
    } catch (error) {
        console.error("ERROR REVISANDO CREDENCIAL:", error.message);
        res.status(500).json({ error: "No se pudo actualizar la solicitud." });
    }
});
app.post("/api/chat/auth/logout", requireChatSession, async (req, res) => {
    const token = (req.get("authorization") || "").slice(7).trim();
    await pool.query("DELETE FROM chat_sesiones WHERE token_hash = $1", [chatHash(token)]);
    res.json({ success: true });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, "0.0.0.0", () => {

    console.log("========================================");
    console.log(`Servidor iniciado en puerto ${PORT}`);
    console.log(
        `Entorno: ${isRender ? "RENDER" : "LOCAL"}`
    );
    console.log("========================================");

});