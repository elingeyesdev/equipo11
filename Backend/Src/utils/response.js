function success(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

function error(res, message, status = 400) {
  res.status(status).json({ ok: false, error: message });
}

module.exports = { success, error };
