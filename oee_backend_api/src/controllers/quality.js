const { createQualityEvent, getProductionRunById } = require('../db/repositories');

class QualityController {
  async create(req, res) {
    const { run_id, good_count, reject_count, occurred_at } = req.body || {};
    if (!run_id || !occurred_at) {
      return res.status(400).json({
        status: 'error',
        message: 'run_id and occurred_at are required',
      });
    }

    const run = await getProductionRunById(run_id);
    if (!run) {
      return res.status(404).json({ status: 'error', message: 'Run not found' });
    }

    const evt = await createQualityEvent({
      run_id,
      good_count: Number(good_count || 0),
      reject_count: Number(reject_count || 0),
      occurred_at,
    });
    return res.status(201).json({ data: evt });
  }
}

module.exports = new QualityController();
