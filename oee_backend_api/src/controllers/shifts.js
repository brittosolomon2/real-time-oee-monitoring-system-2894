const { listShifts } = require('../db/repositories');

class ShiftsController {
  async list(req, res) {
    const shifts = await listShifts();
    return res.status(200).json({ data: shifts });
  }
}

module.exports = new ShiftsController();
