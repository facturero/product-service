import amqp from 'amqplib';
import type { ConsumeMessage } from 'amqplib';
import { z } from 'zod';
import { config } from '../config.js';
import { ProcessedEventModel, TaxRateModel } from '../persistence/models.js';
import { sequelize } from '../persistence/sequelize.js';

const taxRateEventSchema = z.object({
  id: z.string(),
  countryCode: z.string(),
  code: z.string(),
  name: z.string().optional().nullable(),
  percentage: z.string(),
  kind: z.enum(['vat', 'withholding_iva', 'withholding_rent', 'special']),
  isDefault: z.boolean().optional(),
});

type TaxRateEvent = z.infer<typeof taxRateEventSchema>;

export async function startConsumers(): Promise<void> {
  if (!config.RABBITMQ_URL) {
    console.log('[product-service] RABBITMQ_URL no configurado, consumidores desactivados.');
    return;
  }

  try {
    const connection = await amqp.connect(config.RABBITMQ_URL);
    const channel = await connection.createChannel();

    const exchange = 'crm.events';
    const queue = 'product-service.tax-rates';

    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, 'tax.tax_rate.upserted');

    await channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const eventId = msg.properties.messageId || msg.properties.correlationId;
        if (eventId) {
          const exists = await ProcessedEventModel.findByPk(eventId);
          if (exists) {
            channel.ack(msg);
            return;
          }
        }

        const raw = JSON.parse(msg.content.toString());
        const payload: TaxRateEvent = taxRateEventSchema.parse(raw);
        await sequelize.transaction(async (tx) => {
          await TaxRateModel.upsert(
            {
              id: payload.id,
              country_code: payload.countryCode,
              code: payload.code,
              name: payload.name ?? null,
              percentage: payload.percentage,
              kind: payload.kind,
              is_default: payload.isDefault ?? false,
              created_at: new Date(),
              updated_at: new Date(),
            },
            { transaction: tx },
          );

          if (eventId) {
            await ProcessedEventModel.findOrCreate({
              where: { event_id: eventId },
              defaults: { event_id: eventId, processed_at: new Date() },
              transaction: tx,
            });
          }
        });

        channel.ack(msg);
      } catch (err) {
        console.error('[product-service] Error procesando evento tax.tax_rate.upserted:', err);
        channel.nack(msg, false, true);
      }
    });

    console.log('[product-service] Consumidor de tax.tax_rate.upserted iniciado.');
  } catch (err) {
    console.error('[product-service] Error al conectar con RabbitMQ:', err);
  }
}
