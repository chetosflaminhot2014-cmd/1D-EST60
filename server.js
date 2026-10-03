const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));


// =========================
// AVISOS
// =========================

app.get("/api/avisos", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM avisos ORDER BY fecha DESC, id DESC"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error al obtener los avisos"
        });
    }
});


app.post("/api/avisos", async (req, res) => {
    try {
        const { titulo, contenido } = req.body;

        if (!titulo || !contenido) {
            return res.status(400).json({
                error: "Título y contenido son obligatorios"
            });
        }

        const result = await pool.query(
            `INSERT INTO avisos (titulo, contenido)
             VALUES ($1, $2)
             RETURNING *`,
            [titulo, contenido]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error al crear el aviso"
        });
    }
});


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
        console.error(error);
        res.status(500).json({
            error: "Error al eliminar el aviso"
        });
    }
});


// =========================
// TAREAS
// =========================

app.get("/api/tareas", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM tareas ORDER BY fecha_entrega ASC"
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error al obtener las tareas"
        });
    }
});


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
        console.error(error);
        res.status(500).json({
            error: "Error al crear la tarea"
        });
    }
});


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
        console.error(error);
        res.status(500).json({
            error: "Error al eliminar la tarea"
        });
    }
});


// =========================
// EVENTOS / CALENDARIO
// =========================

app.get("/api/eventos", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM eventos ORDER BY fecha ASC"
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error al obtener los eventos"
        });
    }
});


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
        console.error(error);
        res.status(500).json({
            error: "Error al crear el evento"
        });
    }
});


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
        console.error(error);
        res.status(500).json({
            error: "Error al eliminar el evento"
        });
    }
});


// =========================
// HEALTH CHECK
// =========================

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT NOW()");

        res.json({
            status: "online",
            database: "connected"
        });

    } catch {
        res.status(500).json({
            status: "online",
            database: "disconnected"
        });
    }
});


app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
});