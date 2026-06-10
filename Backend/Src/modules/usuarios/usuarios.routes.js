const express = require('express')
const { getUsuarios, updateUsuarioRol, getRoles, updateUsuarioEstado, updatePreferencias, getPreferencias } = require('./usuarios.controller')
const { verificarToken, verificarRol } = require('../auth/auth.middleware')
const { validate } = require('../../middleware/validate')
const { updateRolSchema, updateEstadoSchema, updatePreferenciasSchema } = require('./usuarios.schema')

const router = express.Router()

// Obtener preferencias y localidad del usuario
router.get('/preferencias', verificarToken, getPreferencias)

// Actualizar preferencias y localidad de usuario
router.put('/preferencias', verificarToken, validate(updatePreferenciasSchema), updatePreferencias)

// Obtener todos los roles
router.get('/roles', verificarToken, verificarRol('admin'), getRoles)

// Obtener todos los usuarios
router.get('/', verificarToken, verificarRol('admin'), getUsuarios)

// Actualizar rol de un usuario
router.put('/:id/rol', verificarToken, verificarRol('admin'), validate(updateRolSchema), updateUsuarioRol)

// Actualizar estado (activo/inactivo) de un usuario
router.put('/:id/estado', verificarToken, verificarRol('admin'), validate(updateEstadoSchema), updateUsuarioEstado)

module.exports = router
