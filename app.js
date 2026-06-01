const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');

const hashAdmin = bcrypt.hashSync('admin123', 10);
const hashCristal = bcrypt.hashSync('alumna123', 10);

const app = express();
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('sierrapics.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Conectado a SQLite');
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS generaciones (
    id TEXT PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL,
    passHash TEXT NOT NULL,
    idGeneracion TEXT,
    esAdmin INTEGER DEFAULT 0,
    fotoPerfil TEXT,
    fechaRegistro TEXT,
    FOREIGN KEY (idGeneracion) REFERENCES generaciones(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS fotos (
    id TEXT PRIMARY KEY,
    descripcion TEXT NOT NULL,
    idUsuario TEXT NOT NULL,
    idGeneracion TEXT,
    dataUrl TEXT NOT NULL,
    esExternal INTEGER DEFAULT 0,
    fecha TEXT NOT NULL,
    FOREIGN KEY (idUsuario) REFERENCES usuarios(id),
    FOREIGN KEY (idGeneracion) REFERENCES generaciones(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comentarios (
    id TEXT PRIMARY KEY,
    idFoto TEXT NOT NULL,
    idUsuario TEXT NOT NULL,
    contenido TEXT NOT NULL,
    fecha TEXT NOT NULL,
    FOREIGN KEY (idFoto) REFERENCES fotos(id),
    FOREIGN KEY (idUsuario) REFERENCES usuarios(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reacciones (
    id TEXT PRIMARY KEY,
    idFoto TEXT NOT NULL,
    idUsuario TEXT NOT NULL,
    tipo TEXT DEFAULT 'like',
    fecha TEXT NOT NULL,
    FOREIGN KEY (idFoto) REFERENCES fotos(id),
    FOREIGN KEY (idUsuario) REFERENCES usuarios(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reportes (
    id TEXT PRIMARY KEY,
    idFoto TEXT NOT NULL,
    idUsuario TEXT NOT NULL,
    motivo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    FOREIGN KEY (idFoto) REFERENCES fotos(id),
    FOREIGN KEY (idUsuario) REFERENCES usuarios(id)
  )`);
});

setTimeout(() => {
  db.get('SELECT COUNT(*) as c FROM generaciones', [], (err, row) => {
    if (err || row.c > 0) return;

    db.run('INSERT INTO generaciones (id, nombre) VALUES (?, ?)', ['gen1', '2020-2024']);
    db.run('INSERT INTO generaciones (id, nombre) VALUES (?, ?)', ['gen2', '2021-2025']);
    db.run('INSERT INTO generaciones (id, nombre) VALUES (?, ?)', ['gen3', '2022-2026']);

    db.run(
      'INSERT INTO usuarios (id, nombre, apellidos, correo, passHash, idGeneracion, esAdmin, fechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['u1', 'Admin', 'Sistema', 'admin@unisierra.edu.mx', hashAdmin, 'gen1', 1, new Date().toISOString()]
    );
    db.run(
      'INSERT INTO usuarios (id, nombre, apellidos, correo, passHash, idGeneracion, esAdmin, fechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['u2', 'Cristal Alejandra', 'Arvayo Cota', 'a23050008@unisierra.edu.mx', hashCristal, 'gen2', 0, new Date().toISOString()]
    );

    db.run(
      'INSERT INTO fotos (id, descripcion, idUsuario, idGeneracion, dataUrl, esExternal, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['f1', 'Ceremonia de bienvenida generación 2020', 'u1', 'gen1', 'logoSierraPics.png', 1, new Date(2024, 8, 10).toISOString()]
    );
    db.run(
      'INSERT INTO fotos (id, descripcion, idUsuario, idGeneracion, dataUrl, esExternal, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['f2', 'Graduación campus universitario', 'u2', 'gen2', 'logoSierraPics.png', 1, new Date(2025, 2, 15).toISOString()]
    );
    db.run(
      'INSERT INTO fotos (id, descripcion, idUsuario, idGeneracion, dataUrl, esExternal, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['f3', 'Día del estudiante UniSierra', 'u1', 'gen1', 'logoSierraPics.png', 1, new Date(2025, 5, 20).toISOString()]
    );
  });
}, 500);

function verificarSesion(req, res, next) {
  const idUsuario = req.headers['x-usuario-id'];
  if (!idUsuario) return res.status(401).json({ error: 'No autenticado.' });

  db.get('SELECT * FROM usuarios WHERE id = ?', [idUsuario], (err, usuario) => {
    if (err || !usuario) return res.status(401).json({ error: 'Usuario no encontrado.' });
    req.usuario = usuario;
    next();
  });
}

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { correo, pass } = req.body;
  if (!correo || !pass) return res.json({ error: 'Campos incompletos.' });

  db.get(
    'SELECT * FROM usuarios WHERE correo = ?', [correo], (err, usuario) => {
      if (err || !usuario) {
        return res.json({ error: 'Correo o contraseña incorrectos.' });
      }

      const coincide = bcrypt.compareSync(pass, usuario.passHash);

      if (!coincide) {
        return res.json({ error: 'Correo o contraseña incorrectos.' });
      }
      res.json({
        id: usuario.id,
        esAdmin: usuario.esAdmin === 1
      });
    });
});

app.post('/api/usuarios', (req, res) => {
  const { nombre, apellidos, correo, pass } = req.body;
  if (!nombre || !apellidos || !correo || !pass) return res.json({ error: 'Campos incompletos.' });

  db.get('SELECT id FROM usuarios WHERE correo = ?', [correo], (err, existe) => {
    if (existe) return res.json({ error: 'Este correo ya está registrado.' });

    const hash = bcrypt.hashSync(pass, 10);

    const id = generarId();
    db.run(
      'INSERT INTO usuarios (id, nombre, apellidos, correo, passHash, idGeneracion, esAdmin, fechaRegistro) VALUES (?, ?, ?, ?, ?, NULL, 0, ?)',
      [id, nombre, apellidos, correo, hash, new Date().toISOString()],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true, id });
      }
    );
  });
});

app.get('/api/usuarios', verificarSesion, (req, res) => {
  if (!req.usuario.esAdmin) return res.status(403).json({ error: 'Sin permisos.' });

  db.all('SELECT id, nombre, apellidos, correo, idGeneracion, esAdmin FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/usuarios/:id', verificarSesion, (req, res) => {
  db.get(`
    SELECT u.id, u.nombre, u.apellidos, u.correo, u.idGeneracion, u.esAdmin, u.fotoPerfil,
           g.nombre AS generacionNombre
    FROM usuarios u
    LEFT JOIN generaciones g ON u.idGeneracion = g.id
    WHERE u.id = ?
  `, [req.params.id], (err, usuario) => {
    if (err || !usuario) return res.json({ error: 'Usuario no encontrado.' });
    res.json({ ...usuario, esAdmin: usuario.esAdmin === 1 });
  });
});

app.put('/api/usuarios/:id', verificarSesion, (req, res) => {
  const { nombre, apellidos, fotoPerfil, idGeneracion } = req.body;
  const esAdmin = req.usuario.esAdmin === 1;
  const esMismoUsuario = req.usuario.id === req.params.id;

  if (!esMismoUsuario && !esAdmin) return res.status(403).json({ error: 'Sin permisos.' });

  const campos = [];
  const valores = [];

  if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
  if (apellidos !== undefined) { campos.push('apellidos = ?'); valores.push(apellidos); }
  if (fotoPerfil !== undefined) { campos.push('fotoPerfil = ?'); valores.push(fotoPerfil); }
  if (idGeneracion !== undefined && esAdmin) { campos.push('idGeneracion = ?'); valores.push(idGeneracion); }

  if (campos.length === 0) return res.json({ error: 'Nada que actualizar.' });

  valores.push(req.params.id);
  db.run(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

app.get('/api/generaciones', (req, res) => {
  db.all('SELECT * FROM generaciones', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/generaciones', verificarSesion, (req, res) => {
  if (!req.usuario.esAdmin) return res.status(403).json({ error: 'Sin permisos.' });
  const { nombre } = req.body;
  if (!nombre) return res.json({ error: 'El nombre es obligatorio.' });

  db.get('SELECT id FROM generaciones WHERE nombre = ?', [nombre], (err, existe) => {
    if (existe) return res.json({ error: 'Ya existe una generación con ese nombre.' });

    const id = generarId();
    db.run('INSERT INTO generaciones (id, nombre) VALUES (?, ?)', [id, nombre], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id });
    });
  });
});

app.delete('/api/generaciones/:id', verificarSesion, (req, res) => {
  if (!req.usuario.esAdmin) return res.status(403).json({ error: 'Sin permisos.' });

  db.run('UPDATE fotos SET idGeneracion = NULL WHERE idGeneracion = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('UPDATE usuarios SET idGeneracion = NULL WHERE idGeneracion = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('DELETE FROM generaciones WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true });
      });
    });
  });
});

app.get('/api/fotos', verificarSesion, (req, res) => {
  const { idGeneracion, idUsuario, texto } = req.query;
  let query = `
    SELECT f.*, u.nombre || ' ' || u.apellidos AS autorNombre, g.nombre AS generacionNombre
    FROM fotos f
    LEFT JOIN usuarios u ON f.idUsuario = u.id
    LEFT JOIN generaciones g ON f.idGeneracion = g.id
    WHERE 1=1
  `;
  const params = [];

  if (idGeneracion) { query += ' AND f.idGeneracion = ?'; params.push(idGeneracion); }
  if (idUsuario) { query += ' AND f.idUsuario = ?'; params.push(idUsuario); }
  if (texto) { query += ' AND LOWER(f.descripcion) LIKE ?'; params.push('%' + texto.toLowerCase() + '%'); }

  query += ' ORDER BY f.fecha DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/fotos/:id', verificarSesion, (req, res) => {
  db.get(`
    SELECT f.*, u.nombre || ' ' || u.apellidos AS autorNombre, g.nombre AS generacionNombre
    FROM fotos f
    LEFT JOIN usuarios u ON f.idUsuario = u.id
    LEFT JOIN generaciones g ON f.idGeneracion = g.id
    WHERE f.id = ?
  `, [req.params.id], (err, foto) => {
    if (err || !foto) return res.json({ error: 'Foto no encontrada.' });

    db.all('SELECT idUsuario FROM reacciones WHERE idFoto = ?', [req.params.id], (err, likes) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...foto, likes });
    });
  });
});

app.post('/api/fotos', verificarSesion, (req, res) => {
  const { descripcion, idGeneracion, dataUrl } = req.body;
  if (!descripcion || !dataUrl) return res.json({ error: 'Faltan datos obligatorios.' });

  const id = generarId();
  db.run(
    'INSERT INTO fotos (id, descripcion, idUsuario, idGeneracion, dataUrl, esExternal, fecha) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [id, descripcion, req.usuario.id, idGeneracion || null, dataUrl, new Date().toISOString()],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id });
    }
  );
});

app.put('/api/fotos/:id', verificarSesion, (req, res) => {
  db.get('SELECT * FROM fotos WHERE id = ?', [req.params.id], (err, foto) => {
    if (err || !foto) return res.json({ error: 'Foto no encontrada.' });

    const esAutorOAdmin = foto.idUsuario === req.usuario.id || req.usuario.esAdmin === 1;
    if (!esAutorOAdmin) return res.status(403).json({ error: 'Sin permisos.' });

    const { descripcion } = req.body;
    if (!descripcion) return res.json({ error: 'La descripción no puede estar vacía.' });

    db.run('UPDATE fotos SET descripcion = ? WHERE id = ?', [descripcion, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  });
});

app.delete('/api/fotos/:id', verificarSesion, (req, res) => {
  db.get('SELECT * FROM fotos WHERE id = ?', [req.params.id], (err, foto) => {
    if (err || !foto) return res.json({ error: 'Foto no encontrada.' });

    const esAutorOAdmin = foto.idUsuario === req.usuario.id || req.usuario.esAdmin === 1;
    if (!esAutorOAdmin) return res.status(403).json({ error: 'Sin permisos.' });

    db.run('DELETE FROM comentarios WHERE idFoto = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('DELETE FROM reacciones WHERE idFoto = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run('DELETE FROM reportes WHERE idFoto = ?', [req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          db.run('DELETE FROM fotos WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true });
          });
        });
      });
    });
  });
});

app.get('/api/comentarios', verificarSesion, (req, res) => {
  const { idFoto } = req.query;
  if (!idFoto) return res.json([]);

  db.all(`
    SELECT c.*, u.nombre AS autorNombre
    FROM comentarios c
    LEFT JOIN usuarios u ON c.idUsuario = u.id
    WHERE c.idFoto = ?
    ORDER BY c.fecha ASC
  `, [idFoto], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/comentarios', verificarSesion, (req, res) => {
  const { idFoto, contenido } = req.body;
  if (!idFoto || !contenido) return res.json({ error: 'Faltan datos.' });

  const id = generarId();
  db.run(
    'INSERT INTO comentarios (id, idFoto, idUsuario, contenido, fecha) VALUES (?, ?, ?, ?, ?)',
    [id, idFoto, req.usuario.id, contenido, new Date().toISOString()],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id });
    }
  );
});

app.post('/api/reacciones', verificarSesion, (req, res) => {
  const { idFoto } = req.body;
  if (!idFoto) return res.json({ error: 'Falta idFoto.' });

  db.get('SELECT id FROM reacciones WHERE idFoto = ? AND idUsuario = ?', [idFoto, req.usuario.id], (err, existe) => {
    if (err) return res.status(500).json({ error: err.message });

    if (existe) {
      db.run('DELETE FROM reacciones WHERE idFoto = ? AND idUsuario = ?', [idFoto, req.usuario.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get('SELECT COUNT(*) as c FROM reacciones WHERE idFoto = ?', [idFoto], (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ liked: false, total: row.c });
        });
      });
    } else {
      db.run(
        'INSERT INTO reacciones (id, idFoto, idUsuario, tipo, fecha) VALUES (?, ?, ?, ?, ?)',
        [generarId(), idFoto, req.usuario.id, 'like', new Date().toISOString()],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          db.get('SELECT COUNT(*) as c FROM reacciones WHERE idFoto = ?', [idFoto], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ liked: true, total: row.c });
          });
        }
      );
    }
  });
});

app.post('/api/reportes', verificarSesion, (req, res) => {
  const { idFoto, motivo } = req.body;
  if (!idFoto || !motivo) return res.json({ error: 'Faltan datos.' });

  db.get('SELECT id FROM reportes WHERE idFoto = ? AND idUsuario = ?', [idFoto, req.usuario.id], (err, yaReporto) => {
    if (err) return res.status(500).json({ error: err.message });
    if (yaReporto) return res.json({ error: 'Ya has reportado esta publicación anteriormente.' });

    db.run(
      'INSERT INTO reportes (id, idFoto, idUsuario, motivo, fecha) VALUES (?, ?, ?, ?, ?)',
      [generarId(), idFoto, req.usuario.id, motivo, new Date().toISOString()],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true });
      }
    );
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SierraPics servidor corriendo en http://localhost:${PORT}`);
});