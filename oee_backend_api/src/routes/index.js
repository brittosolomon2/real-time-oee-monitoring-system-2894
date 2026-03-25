const express = require('express');
const healthController = require('../controllers/health');
const linesController = require('../controllers/lines');
const shiftsController = require('../controllers/shifts');
const runsController = require('../controllers/runs');
const downtimeController = require('../controllers/downtime');
const qualityController = require('../controllers/quality');
const oeeController = require('../controllers/oee');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: Service health and basic checks
 *   - name: Reference
 *     description: Reference data such as lines and shifts
 *   - name: Runs
 *     description: Production runs lifecycle
 *   - name: Events
 *     description: Downtime and quality events
 *   - name: OEE
 *     description: OEE calculation and live metrics
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

/**
 * @swagger
 * /api/lines:
 *   get:
 *     summary: List production lines
 *     tags: [Reference]
 *     responses:
 *       200:
 *         description: Lines list
 */
router.get('/api/lines', linesController.check.bind(linesController));

/**
 * @swagger
 * /api/shifts:
 *   get:
 *     summary: List shifts
 *     tags: [Reference]
 *     responses:
 *       200:
 *         description: Shifts list
 */
router.get('/api/shifts', shiftsController.list.bind(shiftsController));

/**
 * @swagger
 * /api/runs:
 *   post:
 *     summary: Create a production run
 *     tags: [Runs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [line_id, started_at]
 *             properties:
 *               id:
 *                 type: string
 *               line_id:
 *                 type: string
 *               shift_id:
 *                 type: string
 *               product_code:
 *                 type: string
 *               started_at:
 *                 type: string
 *                 format: date-time
 *               ended_at:
 *                 type: string
 *                 format: date-time
 *               planned_production_seconds:
 *                 type: integer
 *                 example: 28800
 *               ideal_cycle_time_seconds:
 *                 type: number
 *                 example: 1.2
 *     responses:
 *       201:
 *         description: Created run
 */
router.post('/api/runs', runsController.create.bind(runsController));

/**
 * @swagger
 * /api/runs/{runId}:
 *   get:
 *     summary: Get a production run
 *     tags: [Runs]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Run
 *       404:
 *         description: Not found
 */
router.get('/api/runs/:runId', runsController.get.bind(runsController));

/**
 * @swagger
 * /api/runs/{runId}/end:
 *   post:
 *     summary: End a production run
 *     tags: [Runs]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ended_at]
 *             properties:
 *               ended_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Updated run
 *       404:
 *         description: Not found
 */
router.post('/api/runs/:runId/end', runsController.end.bind(runsController));

/**
 * @swagger
 * /api/events/downtime:
 *   post:
 *     summary: Log a downtime event
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [run_id, started_at]
 *             properties:
 *               run_id:
 *                 type: string
 *               reason:
 *                 type: string
 *               started_at:
 *                 type: string
 *                 format: date-time
 *               ended_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Created downtime event
 *       404:
 *         description: Run not found
 */
router.post('/api/events/downtime', downtimeController.create.bind(downtimeController));

/**
 * @swagger
 * /api/events/quality:
 *   post:
 *     summary: Log a quality event (good/reject counts)
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [run_id, occurred_at]
 *             properties:
 *               run_id:
 *                 type: string
 *               good_count:
 *                 type: integer
 *                 example: 10
 *               reject_count:
 *                 type: integer
 *                 example: 1
 *               occurred_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Created quality event
 *       404:
 *         description: Run not found
 */
router.post('/api/events/quality', qualityController.create.bind(qualityController));

/**
 * @swagger
 * /api/oee/runs/{runId}:
 *   get:
 *     summary: Get calculated OEE for a run (uses live now() if run not ended)
 *     tags: [OEE]
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OEE breakdown
 *       404:
 *         description: Run not found
 */
router.get('/api/oee/runs/:runId', oeeController.getForRun.bind(oeeController));

module.exports = router;
