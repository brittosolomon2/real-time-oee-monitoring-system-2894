const { listShifts } = require('../db/repositories');

class ShiftsController {
  list(req, res) {
    const shifts = listShifts();
    return res.status(200).json({ data: shifts });
  }
}

module.exports = new ShiftsController();
