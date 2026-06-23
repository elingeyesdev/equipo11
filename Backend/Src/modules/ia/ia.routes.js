const express = require('express')
const { analizarClima } = require('./ia.controller')

const router = express.Router()

// POST /api/ia/analisis-clima
router.post('/analisis-clima', analizarClima)

module.exports = router
