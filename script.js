// Configuración Inicial
const API = 'http://localhost:3000/api';

function sesionActual() {
  return JSON.parse(localStorage.getItem('sierrapics_sesion') || 'null');
}

async function apiFetch(ruta, opciones = {}) {
  const sesion = sesionActual();
  const headers = { 'Content-Type': 'application/json' };
  if (sesion) headers['x-usuario-id'] = sesion.id;
  const res = await fetch(API + ruta, { ...opciones, headers });
  return res.json();
}

// SECCIÓN: AUTENTICACIÓN
function switchTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-registro').classList.toggle('hidden', tab !== 'registro');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-registro').classList.toggle('active', tab === 'registro');
  ocultarMensajes();
}

// Valida correo institucional, busca el usuario en localStorage
// y compara la contraseña antes de conceder acceso
async function iniciarSesion() {
  const correo = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  if (!correo || !pass) { mostrarError(errEl, 'Por favor llena todos los campos.'); return; }
  if (!correo.endsWith('@unisierra.edu.mx')) {
    mostrarError(errEl, 'Debes usar un correo institucional @unisierra.edu.mx'); return;
  }

  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo, pass })
  });

  if (data.error) { mostrarError(errEl, data.error); return; }

  localStorage.setItem('sierrapics_sesion', JSON.stringify({ id: data.id, esAdmin: data.esAdmin }));
  cargarApp();
}

// Registrar Usuario - Valida todos los campos, verifica dominio institucional,
// coincidencia de contraseñas y que el correo no esté duplicado
async function registrarUsuario() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const apellidos = document.getElementById('reg-apellidos').value.trim();
  const correo = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const errEl = document.getElementById('reg-error');
  const okEl = document.getElementById('reg-ok');

  if (!nombre || !apellidos || !correo || !pass || !pass2) {
    mostrarError(errEl, 'Todos los campos son obligatorios.'); return;
  }
  if (!correo.endsWith('@unisierra.edu.mx')) {
    mostrarError(errEl, 'El correo debe pertenecer al dominio @unisierra.edu.mx'); return;
  }
  if (pass !== pass2) { mostrarError(errEl, 'Las contraseñas no coinciden.'); return; }
  if (pass.length < 6) { mostrarError(errEl, 'La contraseña debe tener al menos 6 caracteres.'); return; }

  const data = await apiFetch('/usuarios', {
    method: 'POST',
    body: JSON.stringify({ nombre, apellidos, correo, pass })
  });

  if (data.error) { mostrarError(errEl, data.error); return; }

  errEl.classList.add('hidden');
  mostrarOk(okEl, '¡Cuenta creada! Ya puedes iniciar sesión.');
  ['reg-nombre', 'reg-apellidos', 'reg-email', 'reg-pass', 'reg-pass2']
    .forEach(id => document.getElementById(id).value = '');
}

// Cierra la sesión del usuario eliminando los datos de autenticación
// del localStorage para evitar acceso no autorizado.
// Limpia los campos al salir de tu cuenta.
function cerrarSesion() {
  localStorage.removeItem('sierrapics_sesion');
  document.getElementById('main-header').classList.remove('hidden');
  document.getElementById('login-pass').value = '';
  document.getElementById('login-email').value = '';
  document.getElementById('screen-app').style.display = 'none';
  document.getElementById('screen-auth').style.display = 'block';
  switchTab('login');
}

// Obtiene el usuario actualmente autenticado desde localStorage
// Se usa para validar acciones como subir fotos, comentar o dar like
async function usuarioActual() {
  const sesion = sesionActual();
  if (!sesion) return null;
  const data = await apiFetch('/usuarios/' + sesion.id);
  return data.error ? null : data;
}

// SECCIÓN: NAVEGACIÓN
function cargarApp() {
  document.getElementById('main-header').classList.add('hidden');
  document.getElementById('screen-auth').style.display = 'none';
  document.getElementById('screen-app').style.display = 'block';
  cargarSelectoresGeneraciones();

  const sesion = sesionActual();
  document.querySelectorAll('.nav-btn-usuarios').forEach(b => {
    b.style.display = (sesion && sesion.esAdmin) ? '' : 'none';
  });
  mostrarSeccion('feed');
}

function mostrarSeccion(sec) {
  // Mapa de sección
  const navTextos = {
    feed: 'Publicaciones',
    galeria: 'Galería',
    subir: 'Subir',
    usuarios: 'Usuarios',
    perfil: 'Perfil'
  };

  // Ocultar sección Usuarios para usuarios sin privilegios
  const sesion = sesionActual();
  if (sec === 'usuarios' && (!sesion || !sesion.esAdmin)) {
    alert('Solo los administradores pueden gestionar usuarios.');
    return;
  }

  // Ocultar todas las secciones y mostrar solo la seleccionada con display directo
  document.querySelectorAll('.seccion').forEach(s => s.style.display = 'none');
  document.getElementById('sec-' + sec).style.display = 'block';

  // Marcar el botón de navegación correcto como activo
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const textoActivo = navTextos[sec];
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.textContent.trim() === textoActivo) b.classList.add('active');
  });

  // Cargar el contenido de la sección
  if (sec === 'feed') cargarFeed();
  if (sec === 'galeria') cargarGaleria();
  if (sec === 'usuarios') cargarUsuarios();
  if (sec === 'perfil') cargarPerfil();
  if (sec === 'subir') cargarSelectoresGeneraciones();
}

function toggleMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}

// SECCIÓN: FOTOGRAFÍAS

// Se valida el tipo (JPEG/PNG) y el tamaño máximo (5 MB)
// antes de mostrar la vista previa y permitir la subida
function previsualizarFoto() {
  const archivo = document.getElementById('foto-archivo').files[0];
  const errEl = document.getElementById('subir-error');
  const wrap = document.getElementById('foto-preview-wrap');
  const preview = document.getElementById('foto-preview');

  if (!archivo) return;

  if (!['image/jpeg', 'image/png'].includes(archivo.type)) {
    mostrarError(errEl, 'Solo se permiten imágenes en formato JPEG o PNG.');
    document.getElementById('foto-archivo').value = '';
    wrap.classList.add('hidden'); return;
  }

  if (archivo.size > 5 * 1024 * 1024) {
    mostrarError(errEl, 'La imagen no debe superar los 5 MB.');
    document.getElementById('foto-archivo').value = '';
    wrap.classList.add('hidden'); return;
  }

  errEl.classList.add('hidden');
  const reader = new FileReader();
  // FileReader convierte la imagen a Base64 (dataUrl)
  // para poder almacenarla directamente en localStorage
  reader.onload = e => { preview.src = e.target.result; wrap.classList.remove('hidden'); };
  reader.readAsDataURL(archivo);
}

// Crea el objeto foto con todos sus datos
// y lo guarda en localStorage asociado a una generación
async function subirFoto() {
  const archivo = document.getElementById('foto-archivo').files[0];
  const desc = document.getElementById('foto-desc').value.trim();
  const idGen = document.getElementById('foto-gen').value;
  const errEl = document.getElementById('subir-error');
  const okEl = document.getElementById('subir-ok');

  if (!archivo) { mostrarError(errEl, 'Selecciona una imagen para publicar.'); return; }
  if (!desc) { mostrarError(errEl, 'Escribe una descripción para la fotografía.'); return; }

  const dataUrl = document.getElementById('foto-preview').src;

  const data = await apiFetch('/fotos', {
    method: 'POST',
    body: JSON.stringify({ descripcion: desc, idGeneracion: idGen || null, dataUrl })
  });

  if (data.error) { mostrarError(errEl, data.error); return; }

  document.getElementById('foto-archivo').value = '';
  document.getElementById('foto-desc').value = '';
  document.getElementById('foto-gen').value = '';
  document.getElementById('foto-preview-wrap').classList.add('hidden');
  errEl.classList.add('hidden');
  mostrarOk(okEl, '¡Fotografía publicada con éxito! Redirigiendo al feed...');
  setTimeout(() => { mostrarSeccion('feed'); okEl.classList.add('hidden'); }, 1500);
}

// Ordena todas las fotos por fecha descendente (la más reciente primero)
async function cargarFeed() {
  const fotos = await apiFetch('/fotos');
  renderizarFotos('feed-container', fotos);
}

async function cargarGaleria() {
  const idGen = document.getElementById('galeria-gen').value;
  const contenedor = document.getElementById('galeria-container');

  if (!idGen) {
    contenedor.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;color:var(--color-text-muted)">
      <div style="font-size:3rem;margin-bottom:1rem">🎓</div>
      <p>Selecciona una generación</p></div>`;
    return;
  }

  const fotos = await apiFetch('/fotos?idGeneracion=' + idGen);
  if (fotos.length === 0) {
    const gens = await apiFetch('/generaciones');
    const gen = gens.find(g => g.id === idGen);
    contenedor.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;color:var(--color-text-muted)">
      <div style="font-size:3rem;margin-bottom:1rem">📷</div>
      <p>Sin fotografías aún</p>
      <p>La generación <strong>${gen ? gen.nombre : ''}</strong> no tiene publicaciones.</p></div>`;
    return;
  }
  renderizarFotos('galeria-container', fotos);
}

// Filtra en tiempo real por texto en descripción y/o generación seleccionada
async function buscarFotos() {
  const texto = document.getElementById('search-input').value.toLowerCase().trim();
  const idGen = document.getElementById('search-gen').value;

  let url = '/fotos?';
  if (texto) url += 'texto=' + encodeURIComponent(texto) + '&';
  if (idGen) url += 'idGeneracion=' + idGen;

  const fotos = await apiFetch(url);
  renderizarFotos('feed-container', fotos);
}

function renderizarFotos(contenedorId, fotos) {
  const contenedor = document.getElementById(contenedorId);

  if (!fotos || fotos.length === 0) {
    contenedor.innerHTML =
      '<p style="color:var(--color-text-muted);grid-column:1/-1">No hay fotografías para mostrar.</p>';
    return;
  }

  contenedor.innerHTML = fotos.map(foto => `
    <div class="foto-card" onclick="abrirModal('${foto.id}')">
      <img src="${foto.dataUrl}" alt="${foto.descripcion}" loading="lazy" />
      <div class="foto-card-body">
        <p class="foto-card-desc">${foto.descripcion}</p>
        <p class="foto-card-meta">
          📷 ${foto.autorNombre || 'Usuario'}
          ${foto.generacionNombre ? ' · ' + foto.generacionNombre : ''}
        </p>
        <p class="foto-card-meta">
          🗓 ${new Date(foto.fecha).toLocaleDateString('es-MX')}
        </p>
      </div>
      <div class="foto-card-footer">
        <span style="color:var(--color-like);font-size:0.85rem">
          ♡ ${(foto.likes || []).length || 0}
        </span>
      </div>
    </div>
  `).join('');
}

// SECCIÓN: MODAL DE DETALLE

let fotoActualId = null;

async function abrirModal(idFoto) {
  fotoActualId = idFoto;
  const sesion = sesionActual();

  const foto = await apiFetch('/fotos/' + idFoto);
  if (foto.error) return;

  document.getElementById('modal-img').src = foto.dataUrl;
  document.getElementById('modal-desc').textContent = foto.descripcion;
  document.getElementById('modal-autor').textContent = '👤 ' + foto.autorNombre;
  document.getElementById('modal-fecha').textContent = '🗓 ' + new Date(foto.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('modal-gen').textContent = foto.generacionNombre ? '🎓 Generación: ' + foto.generacionNombre : '';

  const yaLeDioLike = foto.likes.some(r => r.idUsuario === sesion?.id);
  const btnLike = document.getElementById('btn-like');
  btnLike.innerHTML = `${yaLeDioLike ? '♥' : '♡'} <span id="like-count">${foto.likes.length}</span>`;
  btnLike.className = 'btn-like' + (yaLeDioLike ? ' liked' : '');

  const esAutorOAdmin = sesion && (foto.idUsuario === sesion.id || sesion.esAdmin);
  document.getElementById('btn-editar').style.display = esAutorOAdmin ? '' : 'none';
  document.getElementById('btn-eliminar').style.display = esAutorOAdmin ? '' : 'none';
  document.getElementById('edit-wrap').classList.add('hidden');

  cargarComentarios(idFoto);
  document.getElementById('modal-foto').classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('modal-foto').classList.add('hidden');
  fotoActualId = null;
}

// Agrega o quita el like del usuario actual.
// Usa findIndex para detectar si ya existe y hacer toggle
async function reaccionar() {
  const sesion = sesionActual();
  if (!sesion || !fotoActualId) return;

  const data = await apiFetch('/reacciones', {
    method: 'POST',
    body: JSON.stringify({ idFoto: fotoActualId })
  });

  const btnLike = document.getElementById('btn-like');
  btnLike.innerHTML = `${data.liked ? '♥' : '♡'} <span id="like-count">${data.total}</span>`;
  btnLike.className = 'btn-like' + (data.liked ? ' liked' : '');
}

async function mostrarEdicion() {
  const foto = await apiFetch('/fotos/' + fotoActualId);

  if (foto.error) return;

  document.getElementById('edit-desc').value = foto.descripcion;
  document.getElementById('edit-wrap').classList.remove('hidden');
}

// Antes de guardar, verifica que el usuario sea autor o admin
async function guardarEdicion() {
  const nuevaDesc = document.getElementById('edit-desc').value.trim();
  if (!nuevaDesc) { alert('La descripción no puede estar vacía.'); return; }

  const data = await apiFetch('/fotos/' + fotoActualId, {
    method: 'PUT',
    body: JSON.stringify({ descripcion: nuevaDesc })
  });

  if (data.error) { alert(data.error); return; }

  document.getElementById('modal-desc').textContent = nuevaDesc;
  cancelarEdicion();
}

function cancelarEdicion() {
  document.getElementById('edit-wrap').classList.add('hidden');
}

// Verifica permisos, elimina la foto y en cascada
// sus comentarios y reacciones asociados en localStorage
async function eliminarFoto() {
  if (!fotoActualId) return;
  if (!confirm('¿Seguro que deseas eliminar esta fotografía? Esta acción no se puede deshacer.')) return;

  const data = await apiFetch('/fotos/' + fotoActualId, { method: 'DELETE' });
  if (data.error) { alert(data.error); return; }

  cerrarModal();
  cargarFeed();
}

// Evita reportes duplicados del mismo usuario para la misma foto
async function reportarFoto() {
  if (!fotoActualId) return;
  const motivo = prompt('¿Por qué deseas reportar esta publicación?');
  if (!motivo || !motivo.trim()) return;

  const data = await apiFetch('/reportes', {
    method: 'POST',
    body: JSON.stringify({ idFoto: fotoActualId, motivo: motivo.trim() })
  });

  if (data.error) { alert(data.error); return; }
  alert('Reporte enviado. Gracias por ayudarnos a mantener la comunidad segura.');
}

// SECCIÓN: COMENTARIOS

// Obtiene y muestra los comentarios asociados a una fotografía
// Filtra los comentarios usando el índice de la imagen
async function cargarComentarios(idFoto) {
  const comentarios = await apiFetch('/comentarios?idFoto=' + idFoto);
  const lista = document.getElementById('lista-comentarios');

  if (comentarios.length === 0) {
    lista.innerHTML = '<li style="color:var(--color-text-muted);font-size:0.85rem">Sé el primero en comentar.</li>';
    return;
  }

  lista.innerHTML = comentarios.map(c => `
    <li>
      <strong>${c.autorNombre}</strong>: ${c.contenido}
      <span style="color:var(--color-text-muted);font-size:0.75rem;float:right">
        ${new Date(c.fecha).toLocaleDateString('es-MX')}
      </span>
    </li>`).join('');
}

// Permite agregar un comentario a una fotografía específica
// Verifica que el usuario esté autenticado antes de guardar
async function agregarComentario() {
  const input = document.getElementById('nuevo-comentario');
  const texto = input.value.trim();
  if (!texto) { alert('Escribe un comentario primero.'); return; }

  const data = await apiFetch('/comentarios', {
    method: 'POST',
    body: JSON.stringify({ idFoto: fotoActualId, contenido: texto })
  });

  if (data.error) { alert(data.error); return; }

  input.value = '';
  cargarComentarios(fotoActualId);
}

// SECCIÓN: GENERACIONES Y USUARIOS

// Valida que no exista una generación con el mismo nombre antes de guardarla
async function crearGeneracion() {
  const nombre = document.getElementById('gen-nombre').value.trim();
  const errEl = document.getElementById('gen-error');
  const okEl = document.getElementById('gen-ok');

  if (!nombre) { mostrarError(errEl, 'Escribe un nombre para la generación.'); return; }

  const data = await apiFetch('/generaciones', {
    method: 'POST',
    body: JSON.stringify({ nombre })
  });

  if (data.error) { mostrarError(errEl, data.error); return; }

  document.getElementById('gen-nombre').value = '';
  errEl.classList.add('hidden');
  mostrarOk(okEl, 'Generación creada con éxito.');
  cargarSelectoresGeneraciones();
  renderizarListaGeneraciones();
}

async function eliminarGeneracion(id) {
  if (!confirm('¿Eliminar esta generación? Las fotos asociadas quedarán sin generación.')) return;

  await apiFetch('/generaciones/' + id, { method: 'DELETE' });
  cargarSelectoresGeneraciones();
  renderizarListaGeneraciones();
}

// Actualiza el campo idGeneracion del usuario seleccionado en localStorage
async function asignarGeneracion(idUsuario) {
  const idGen = document.getElementById('sel-gen-' + idUsuario).value;

  const data = await apiFetch('/usuarios/' + idUsuario, {
    method: 'PUT',
    body: JSON.stringify({ idGeneracion: idGen || null })
  });

  if (data.error) { alert(data.error); return; }
  mostrarOk(document.getElementById('gen-ok'), 'Generación asignada correctamente.');
}

async function cargarUsuarios() {
  await renderizarTablaUsuarios();
  await renderizarListaGeneraciones();
}

async function renderizarTablaUsuarios() {
  const usuarios = await apiFetch('/usuarios');
  const generaciones = await apiFetch('/generaciones');
  const tbody = document.getElementById('tbody-usuarios');

  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--color-text-muted)">No hay usuarios registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map(u => {
    const genActual = generaciones.find(g => g.id === u.idGeneracion);
    const opciones = generaciones.map(g =>
      `<option value="${g.id}" ${u.idGeneracion === g.id ? 'selected' : ''}>${g.nombre}</option>`
    ).join('');
    return `<tr>
      <td>${u.nombre} ${u.apellidos} ${u.esAdmin ? '<span style="color:var(--color-accent);font-size:0.75rem">(Admin)</span>' : ''}</td>
      <td>${u.correo}</td>
      <td>${genActual ? genActual.nombre : '—'}</td>
      <td><select id="sel-gen-${u.id}"><option value="">Sin generación</option>${opciones}</select></td>
      <td><button class="btn-secondary" onclick="asignarGeneracion('${u.id}')">Asignar</button></td>
    </tr>`;
  }).join('');
}

async function renderizarListaGeneraciones() {
  const generaciones = await apiFetch('/generaciones');
  const lista = document.getElementById('lista-generaciones');

  if (generaciones.length === 0) {
    lista.innerHTML = '<li style="color:var(--color-text-muted)">No hay generaciones registradas.</li>';
    return;
  }

  lista.innerHTML = generaciones.map(g =>
    `<li>🎓 ${g.nombre} <button onclick="eliminarGeneracion('${g.id}')">✕ Eliminar</button></li>`
  ).join('');
}

async function cargarSelectoresGeneraciones() {
  const generaciones = await apiFetch('/generaciones');
  const opciones = generaciones.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');

  const elGaleria = document.getElementById('galeria-gen');
  if (elGaleria) elGaleria.innerHTML = '<option value="">— Selecciona una generación —</option>' + opciones;

  const elFotoGen = document.getElementById('foto-gen');
  if (elFotoGen) elFotoGen.innerHTML = '<option value="">Sin generación</option>' + opciones;

  const elSearch = document.getElementById('search-gen');
  if (elSearch) elSearch.innerHTML = '<option value="">Todas las generaciones</option>' + opciones;
}

// SECCIÓN: PERFIL
async function cargarPerfil() {
  const sesion = sesionActual();
  if (!sesion) return;

  const usuario = await apiFetch('/usuarios/' + sesion.id);
  if (usuario.error) return;

  const misfotos = await apiFetch('/fotos?idUsuario=' + sesion.id);

  const badgeAdmin = usuario.esAdmin ? '<span class="badge-admin">Admin</span>' : '';
  document.getElementById('perfil-nombre').innerHTML = usuario.nombre + ' ' + usuario.apellidos + badgeAdmin;
  document.getElementById('perfil-correo').textContent = usuario.correo;
  document.getElementById('perfil-gen').textContent = usuario.generacionNombre || 'Sin generación asignada';

  const fotoEl = document.getElementById('perfil-foto');
  const inicialEl = document.getElementById('perfil-inicial');
  if (usuario.fotoPerfil) {
    fotoEl.src = usuario.fotoPerfil;
    fotoEl.classList.remove('hidden');
    inicialEl.textContent = '';
  } else {
    fotoEl.classList.add('hidden');
    fotoEl.src = '';
    inicialEl.textContent = usuario.nombre.charAt(0).toUpperCase();
  }

  const h3Perfil = document.querySelector('#sec-perfil .form-card h3');
  if (h3Perfil) h3Perfil.textContent = `Mis publicaciones (${misfotos.length})`;
  renderizarFotos('mis-fotos', misfotos);
}

// SECCIÓN: EDITAR PERFIL
// Permite cambiar nombre, apellidos y foto de perfil

// Variable temporal para la nueva foto mientras el usuario no guarda
let nuevaFotoPerfilDataUrl = null;
let fotoPerfilEliminada = false;

async function abrirModalEditarPerfil() {
  const usuario = await usuarioActual();
  if (!usuario) return;

  // Prellenar campos con datos actuales
  document.getElementById('edit-perfil-nombre').value = usuario.nombre;
  document.getElementById('edit-perfil-apellidos').value = usuario.apellidos;
  document.getElementById('edit-perfil-error').classList.add('hidden');
  document.getElementById('edit-perfil-ok').classList.add('hidden');
  document.getElementById('input-foto-perfil').value = '';

  // Resetear estado temporal de foto
  nuevaFotoPerfilDataUrl = null;
  fotoPerfilEliminada = false;

  // Mostrar foto actual en el preview del modal
  actualizarPreviewModal(usuario.fotoPerfil || null);

  document.getElementById('modal-editar-perfil').classList.remove('hidden');
}

function cerrarModalEditarPerfil() {
  document.getElementById('modal-editar-perfil').classList.add('hidden');
  nuevaFotoPerfilDataUrl = null;
  fotoPerfilEliminada = false;
}

// Actualiza el avatar preview dentro del modal
function actualizarPreviewModal(dataUrl) {
  const imgEl = document.getElementById('modal-avatar-img');
  const inicialEl = document.getElementById('modal-avatar-inicial');
  const btnQuitar = document.getElementById('btn-quitar-foto');

  if (dataUrl) {
    imgEl.src = dataUrl;
    imgEl.classList.remove('hidden');
    inicialEl.textContent = '';
    btnQuitar.classList.remove('hidden');
  } else {
    imgEl.classList.add('hidden');
    imgEl.src = '';

    const nombrePerfil =
      document.getElementById('edit-perfil-nombre').value || '?';

    inicialEl.textContent = nombrePerfil.charAt(0).toUpperCase();

    btnQuitar.classList.add('hidden');
  }
}

// Previsualiza la foto elegida antes de guardar
function previsualizarFotoPerfil() {
  const archivo = document.getElementById('input-foto-perfil').files[0];
  if (!archivo) return;

  if (!['image/jpeg', 'image/png'].includes(archivo.type)) {
    mostrarError(document.getElementById('edit-perfil-error'), 'Solo se permiten imágenes JPEG o PNG.');
    return;
  }
  if (archivo.size > 5 * 1024 * 1024) {
    mostrarError(document.getElementById('edit-perfil-error'), 'La imagen no debe superar los 5 MB.');
    return;
  }

  document.getElementById('edit-perfil-error').classList.add('hidden');
  const reader = new FileReader();
  reader.onload = e => {
    nuevaFotoPerfilDataUrl = e.target.result;
    fotoPerfilEliminada = false;
    actualizarPreviewModal(nuevaFotoPerfilDataUrl);
  };
  reader.readAsDataURL(archivo);
}

// Quita la foto del preview (no guarda hasta presionar "Guardar")
function quitarFotoPerfil() {
  nuevaFotoPerfilDataUrl = null;
  fotoPerfilEliminada = true;
  document.getElementById('input-foto-perfil').value = '';
  actualizarPreviewModal(null);
}

// Guarda los cambios de nombre, apellidos y foto en localStorage
async function guardarEditarPerfil() {
  const nombre = document.getElementById('edit-perfil-nombre').value.trim();
  const apellidos = document.getElementById('edit-perfil-apellidos').value.trim();
  const errEl = document.getElementById('edit-perfil-error');
  const okEl = document.getElementById('edit-perfil-ok');

  if (!nombre || !apellidos) {
    mostrarError(errEl, 'El nombre y los apellidos no pueden estar vacíos.'); return;
  }

  const sesion = sesionActual();
  if (!sesion) return;

  const body = { nombre, apellidos };
  if (nuevaFotoPerfilDataUrl) body.fotoPerfil = nuevaFotoPerfilDataUrl;
  if (fotoPerfilEliminada) body.fotoPerfil = null;

  const data = await apiFetch('/usuarios/' + sesion.id, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  if (data.error) { mostrarError(errEl, data.error); return; }

  errEl.classList.add('hidden');
  mostrarOk(okEl, '¡Perfil actualizado correctamente!');
  setTimeout(() => { cerrarModalEditarPerfil(); cargarPerfil(); }, 1200);
}

// SECCIÓN: UTILIDADES DE UI
function mostrarError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function mostrarOk(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function ocultarMensajes() {
  ['login-error', 'reg-error', 'reg-ok'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

// SECCIÓN: INICIALIZACIÓN
// Carga datos iniciales y verifica la sesión activa
(function init() {
  if (sesionActual()) cargarApp();
})();