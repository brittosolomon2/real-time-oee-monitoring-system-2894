const { listLines } = require('../db/repositories');

class LinesController {
  async check(req, res) {
    const lines = await listLines();
    return res.status(200).json({ data: lines });
  }
}

module.exports = new LinesController();
