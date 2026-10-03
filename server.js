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

app.use(express.json());

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
app.post("/api/avisos", async (req, res) => {
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

        res.status(201).json(result.rows[0]);

    } catch (error) {

        console.error("ERROR AL CREAR AVISO:", error);

        res.status(500).json({
            error: "Error al crear el aviso",
            detalle: error.message
        });
    }
});

// Eliminar aviso
app.delete("/api/avisos/:id", async (req, res) => {
    try {

        await pool.query(
            "DELETE FROM avisos WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true
        });

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

// Obtener tareas
app.get("/api/tareas", async (req, res) => {
    try {

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
app.post("/api/tareas", async (req, res) => {
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

        res.status(201).json(result.rows[0]);

    } catch (error) {

        console.error("ERROR AL CREAR TAREA:", error);

        res.status(500).json({
            error: "Error al crear la tarea",
            detalle: error.message
        });
    }
});

// Eliminar tarea
app.delete("/api/tareas/:id", async (req, res) => {
    try {

        await pool.query(
            "DELETE FROM tareas WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true
        });

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
app.post("/api/eventos", async (req, res) => {
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

        res.status(201).json(result.rows[0]);

    } catch (error) {

        console.error("ERROR AL CREAR EVENTO:", error);

        res.status(500).json({
            error: "Error al crear el evento",
            detalle: error.message
        });
    }
});

// Eliminar evento
app.delete("/api/eventos/:id", async (req, res) => {
    try {

        await pool.query(
            "DELETE FROM eventos WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true
        });

    } catch (error) {

        console.error("ERROR AL ELIMINAR EVENTO:", error);

        res.status(500).json({
            error: "Error al eliminar el evento",
            detalle: error.message
        });
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