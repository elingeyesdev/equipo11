const { Router } = require('express')
const { registerController, loginController, forgotPasswordController, resetPasswordController } = require('./auth.controller')

const router = Router()

router.post('/register', registerController)
router.post('/login',    loginController)
router.post('/forgot-password', forgotPasswordController)
router.post('/reset-password', resetPasswordController)

module.exports = router
