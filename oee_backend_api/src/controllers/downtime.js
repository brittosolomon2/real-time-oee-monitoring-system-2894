const { createDowntimeEvent, getProductionRunById } = require('../db/repositories');

class DowntimeController {
  async create(req, res) {
    const { run_id, reason, started_at, ended_at } = req.body || {};
    if (!run_id || !started_at) {
      return res.status(400).json({
        status: 'error',
        message: 'run_id and started_at are required',
      });
    }

    const run = await getProductionRunById(run_id);
    if (!run) {
      return res.status(404).json({ status: 'error', message: 'Run not found' });
    }

    const evt = await createDowntimeEvent({ run_id, reason, started_at, ended_at });
    return res.status(201).json({ data: evt });
  }
}

module.exports = new DowntimeController();
