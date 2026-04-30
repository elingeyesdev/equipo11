const express = require('express')
const { getUsuarios, updateUsuarioRol, getRoles, updateUsuarioEstado } = require('./usuarios.controller')
const { verificarToken, verificarRol } = require('../auth/auth.middleware')

const router = express.Router()

// Obtener todos los roles
router.get('/roles', verificarToken, verificarRol('admin'), getRoles)

// Obtener todos los usuarios
router.get('/', verificarToken, verificarRol('admin'), getUsuarios)

// Actualizar rol de un usuario
router.put('/:id/rol', verificarToken, verificarRol('admin'), updateUsuarioRol)

// Actualizar estado (activo/inactivo) de un usuario
router.put('/:id/estado', verificarToken, verificarRol('admin'), updateUsuarioEstado)

module.exports = router
