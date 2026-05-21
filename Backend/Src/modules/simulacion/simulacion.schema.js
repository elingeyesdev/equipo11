const { z } = require('zod');

const simulateRangeSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  intervalMinutes: z.number().int().min(1).max(1440),
});

const simulateRangeParamsSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  intervalMinutes: z.coerce.number().int().min(1).max(1440),
});

module.exports = { simulateRangeSchema, simulateRangeParamsSchema };
