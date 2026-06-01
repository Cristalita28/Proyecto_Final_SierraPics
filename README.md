# SierraPics

Plataforma web para compartir y preservar recuerdos académicos mediante fotografías organizadas por generaciones, desarrollada para la Universidad de la Sierra.

**Alumna:** Arvayo Cota Cristal Alejandra  
**Materia:** Programación Web II  
**Profesor:** Dr. Jesús Miguel García Gorrostieta  

**Sitio en producción:** https://cristalita28.github.io/Proyecto_Final_SierraPics/

## Tecnologías utilizadas

- HTML, CSS, JavaScript (frontend)
- Node.js + Express (backend)
- SQLite3 (base de datos)

## Rutas adicionales del API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Iniciar sesión |
| POST | /api/usuarios | Registrar usuario |
| GET | /api/usuarios | Listar usuarios (admin) |
| GET | /api/usuarios/:id | Obtener perfil |
| PUT | /api/usuarios/:id | Editar perfil |
| GET | /api/comentarios?idFoto=X | Obtener comentarios de una foto |
| POST | /api/comentarios | Agregar comentario |
| POST | /api/reacciones | Dar o quitar like |
| POST | /api/reportes | Reportar una foto |

## Formularios del sistema

1. **Registro de usuario** — nombre, apellidos, correo institucional y contraseña
2. **Subir fotografía** — imagen, descripción y generación asociada
3. **Editar perfil** — nombre, apellidos y foto de perfil
4. **Crear generación** — nombre de la generación académica

## Estructura del proyecto
SierraPics/
├── index.html
├── style.css
├── script.js
├── app.js
├── package.json
├── package-lock.json
├── sierrapics.db
├── logoSierraPics.png
└── README.md
