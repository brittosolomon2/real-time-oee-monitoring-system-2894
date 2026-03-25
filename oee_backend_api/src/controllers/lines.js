const { listLines } = require('../db/repositories');

class LinesController {
  check(req, res) {
    const lines = listLines();
    return res.status(200).json({ data: lines });
  }
}

module.exports = new LinesController();
