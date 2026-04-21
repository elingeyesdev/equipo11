/**
 * Plantilla HTML básica para los correos electrónicos.
 * Se utiliza para enviar notificaciones responsivas y con buen diseño.
 * 
 * @param {string} title Título del correo
 * @param {string} message Mensaje principal o cuerpo del correo
 * @param {string} actionText (Opcional) Texto del botón de acción
 * @param {string} actionUrl (Opcional) URL del botón de acción
 * @returns {string} String con el código HTML
 */
const getBasicEmailTemplate = (title, message, actionText = '', actionUrl = '') => {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
          body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f7fa;
              margin: 0;
              padding: 0;
          }
          .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
          }
          .header {
              background-color: #2e86de;
              color: #ffffff;
              padding: 20px;
              text-align: center;
          }
          .header h1 {
              margin: 0;
              font-size: 24px;
          }
          .content {
              padding: 30px;
              color: #333333;
              line-height: 1.6;
          }
          .content p {
              margin: 0 0 15px 0;
          }
          .btn-container {
              text-align: center;
              margin-top: 25px;
          }
          .btn {
              display: inline-block;
              background-color: #10ac84;
              color: #ffffff;
              text-decoration: none;
              padding: 12px 25px;
              border-radius: 4px;
              font-weight: bold;
          }
          .footer {
              background-color: #f1f2f6;
              color: #747d8c;
              text-align: center;
              padding: 15px;
              font-size: 12px;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>Enviro Sense</h1>
          </div>
          <div class="content">
              <h2>${title}</h2>
              <p>${message}</p>
              
              ${actionText && actionUrl ? `
              <div class="btn-container">
                  <a href="${actionUrl}" class="btn">${actionText}</a>
              </div>
              ` : ''}

              <p style="margin-top: 30px;">Si tienes dudas o no solicitaste este correo, puedes ignorarlo de manera segura.</p>
          </div>
          <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Enviro Sense. Todos los derechos reservados.</p>
          </div>
      </div>
  </body>
  </html>
  `;
};

module.exports = {
  getBasicEmailTemplate
};
