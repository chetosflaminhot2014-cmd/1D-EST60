const express = require("express");
const path = require("path");
const { Pool } = require("pg");

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
    "https://oned-est60.onrender.com"
];

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Vary", "Origin");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Admin-Key"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());

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

async function registrarCambio(accion, entidad, registro, anterior = null, nuevo = null) {
    try {
        const titulo = (nuevo && (nuevo.titulo || nuevo.materia))
            || (anterior && (anterior.titulo || anterior.materia))
            || "Registro";
        await pool.query(
            `INSERT INTO historial_admin
             (accion, entidad, registro_id, titulo, datos_anteriores, datos_nuevos)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [accion, entidad, registro ? registro.id : null, titulo, anterior, nuevo]
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

        const {
            titulo,
            contenido
        } = req.body;

        if (!titulo || !contenido) {
            return res.status(400).json({
                error: "Título y contenido son obligatorios"
            });
        }

        const result = await pool.query(
            `INSERT INTO avisos
            (titulo, contenido)
            VALUES ($1, $2)
            RETURNING *`,
            [
                titulo,
                contenido
            ]
        );

        await registrarCambio("CREACIÓN", "Aviso", result.rows[0], null, result.rows[0]);
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
        if (typeof titulo !== "string" || !titulo.trim() || typeof contenido !== "string" || !contenido.trim()) {
            return res.status(400).json({ error: "Título y contenido son obligatorios." });
        }
        const anterior = await pool.query("SELECT * FROM avisos WHERE id = $1", [req.params.id]);
        if (!anterior.rows.length) return res.status(404).json({ error: "Aviso no encontrado." });
        const result = await pool.query(
            "UPDATE avisos SET titulo = $1, contenido = $2 WHERE id = $3 RETURNING *",
            [titulo.trim(), contenido.trim(), req.params.id]
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

        const {
            materia,
            titulo,
            descripcion,
            fecha_entrega
        } = req.body;

        if (!materia || !titulo || !fecha_entrega) {
            return res.status(400).json({
                error: "Materia, título y fecha son obligatorios"
            });
        }

        const result = await pool.query(
            `INSERT INTO tareas
            (materia, titulo, descripcion, fecha_entrega)
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [
                materia,
                titulo,
                descripcion || "",
                fecha_entrega
            ]
        );

        await registrarCambio("CREACIÓN", "Tarea", result.rows[0], null, result.rows[0]);
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
        if (typeof materia !== "string" || !materia.trim() || typeof titulo !== "string" || !titulo.trim() || typeof fecha_entrega !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_entrega)) {
            return res.status(400).json({ error: "Materia, título y fecha válida son obligatorios." });
        }
        const anterior = await pool.query("SELECT * FROM tareas WHERE id = $1", [req.params.id]);
        if (!anterior.rows.length) return res.status(404).json({ error: "Tarea no encontrada." });
        const result = await pool.query(
            "UPDATE tareas SET materia = $1, titulo = $2, descripcion = $3, fecha_entrega = $4 WHERE id = $5 RETURNING *",
            [materia.trim(), titulo.trim(), typeof descripcion === "string" ? descripcion.trim() : "", fecha_entrega, req.params.id]
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

        const {
            titulo,
            descripcion,
            fecha
        } = req.body;

        if (!titulo || !fecha) {
            return res.status(400).json({
                error: "Título y fecha son obligatorios"
            });
        }

        const result = await pool.query(
            `INSERT INTO eventos
            (titulo, descripcion, fecha)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [
                titulo,
                descripcion || "",
                fecha
            ]
        );

        await registrarCambio("CREACIÓN", "Evento", result.rows[0], null, result.rows[0]);
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
        if (typeof titulo !== "string" || !titulo.trim() || typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({ error: "Título y fecha válida son obligatorios." });
        }
        const anterior = await pool.query("SELECT * FROM eventos WHERE id = $1", [req.params.id]);
        if (!anterior.rows.length) return res.status(404).json({ error: "Evento no encontrado." });
        const result = await pool.query(
            "UPDATE eventos SET titulo = $1, descripcion = $2, fecha = $3 WHERE id = $4 RETURNING *",
            [titulo.trim(), typeof descripcion === "string" ? descripcion.trim() : "", fecha, req.params.id]
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