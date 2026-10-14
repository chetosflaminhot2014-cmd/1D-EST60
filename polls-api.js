module.exports = function registerPollRoutes(app, pool, requireAdmin) {
  let ready = false;
  async function init() {
    if (ready) return;
    await pool.query("CREATE TABLE IF NOT EXISTS group_polls (id SERIAL PRIMARY KEY, question TEXT NOT NULL, options JSONB NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE)");
    await pool.query("CREATE TABLE IF NOT EXISTS group_poll_votes (id SERIAL PRIMARY KEY, poll_id INTEGER REFERENCES group_polls(id) ON DELETE CASCADE, voter TEXT NOT NULL, choice INTEGER NOT NULL, UNIQUE(poll_id, voter))");
    ready = true;
  }
  app.get("/api/encuestas", async (_req,res) => {
    try { await init(); const q=await pool.query("SELECT * FROM group_polls WHERE active=TRUE ORDER BY id DESC"); const out=[]; for (const p of q.rows) { const v=await pool.query("SELECT choice,COUNT(*)::int n FROM group_poll_votes WHERE poll_id=$1 GROUP BY choice",[p.id]); const counts=p.options.map((_,i)=>Number((v.rows.find(x=>x.choice===i)||{}).n||0)); out.push({id:p.id,pregunta:p.question,opciones:p.options,resultados:counts,total_votos:counts.reduce((a,b)=>a+b,0)}); } res.json(out); }
    catch(e) { res.status(500).json({error:"Encuestas no disponibles."}); }
  });
  app.post("/api/encuestas/:id/votar", async (req,res) => {
    try { await init(); const id=Number(req.params.id), choice=Number(req.body.opcion), voter=String(req.body.votante||"").slice(0,120); if(!Number.isInteger(id)||!voter||!Number.isInteger(choice)) return res.status(400).json({error:"Voto inválido."}); const q=await pool.query("SELECT * FROM group_polls WHERE id=$1 AND active=TRUE",[id]); if(!q.rows.length||choice<0||choice>=q.rows[0].options.length) return res.status(400).json({error:"Encuesta u opción no válida."}); const r=await pool.query("INSERT INTO group_poll_votes(poll_id,voter,choice) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id",[id,voter,choice]); if(!r.rows.length)return res.status(409).json({error:"Ya votaste en esta encuesta desde este navegador."}); res.json({success:true}); }
    catch(e) { res.status(500).json({error:"No se pudo registrar el voto."}); }
  });
  app.post("/api/admin/encuestas", requireAdmin, async (req,res) => {
    try { await init(); const question=String(req.body.pregunta||"").trim().slice(0,220), options=Array.isArray(req.body.opciones)?req.body.opciones.map(x=>String(x).trim().slice(0,100)).filter(Boolean):[]; if(question.length<5||options.length<2||options.length>6)return res.status(400).json({error:"Escribe una pregunta y entre 2 y 6 opciones."}); const r=await pool.query("INSERT INTO group_polls(question,options) VALUES($1,$2::jsonb) RETURNING id",[question,JSON.stringify(options)]); res.status(201).json({success:true,id:r.rows[0].id}); }
    catch(e) { res.status(500).json({error:"No se pudo crear la encuesta."}); }
  });
  app.get("/api/admin/encuestas", requireAdmin, async (_req,res) => {
    try { await init(); const q=await pool.query("SELECT * FROM group_polls ORDER BY id DESC"); res.json(q.rows); }
    catch(e) { res.status(500).json({error:"No se pudieron cargar las encuestas."}); }
  });
  app.post("/api/admin/encuestas/:id/cerrar", requireAdmin, async (req,res) => {
    try { await init(); await pool.query("UPDATE group_polls SET active=FALSE WHERE id=$1",[req.params.id]); res.json({success:true}); }
    catch(e) { res.status(500).json({error:"No se pudo cerrar la encuesta."}); }
  });
};