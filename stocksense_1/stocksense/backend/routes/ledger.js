import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

const DOC_PREFIX = {
  Receipt: 'RCPT',
  Delivery: 'DLVY',
  Internal: 'INTL',
  Adjustment: 'ADJ',
};

function generateReference(documentType) {
  const prefix = DOC_PREFIX[documentType] || 'DOC';
  const stamp = Date.now().toString().slice(-8);
  return `${prefix}-${stamp}`;
}

/**
 * POST /api/operations/ledger
 * Creates a new movement document + its line items, in 'Draft' status.
 * Body: {
 *   document_type: 'Receipt' | 'Delivery' | 'Internal' | 'Adjustment',
 *   source_location_id, destination_location_id,
 *   items: [{ product_id, quantity, counted_quantity? }]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      document_type,
      source_location_id = null,
      destination_location_id = null,
      items = [],
      status = 'Draft',
    } = req.body;

    if (!document_type || !DOC_PREFIX[document_type]) {
      return res.status(400).json({ error: 'Invalid or missing document_type' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }
    if (!source_location_id && !destination_location_id) {
      return res.status(400).json({ error: 'A source and/or destination location is required' });
    }

    const { data: ledger, error: ledgerError } = await supabaseAdmin
      .from('stock_ledger')
      .insert({
        document_type,
        status, // typically 'Draft' or 'Waiting'
        reference: generateReference(document_type),
        source_location_id,
        destination_location_id,
        created_by: req.user?.id || null,
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    const rows = items.map((it) => ({
      ledger_id: ledger.id,
      product_id: it.product_id,
      quantity: it.quantity,
      counted_quantity: it.counted_quantity ?? null,
    }));

    const { data: lineItems, error: itemsError } = await supabaseAdmin
      .from('ledger_items')
      .insert(rows)
      .select();

    if (itemsError) {
      // Roll back the header if line items fail, keeping data consistent
      await supabaseAdmin.from('stock_ledger').delete().eq('id', ledger.id);
      throw itemsError;
    }

    res.status(201).json({ ledger: { ...ledger, ledger_items: lineItems } });
  } catch (err) {
    console.error('[ledger/create]', err.message);
    res.status(500).json({ error: 'Failed to create movement document' });
  }
});

/**
 * PUT /api/operations/ledger/:id/status
 * Moves a document through its workflow states (Draft -> Waiting -> Ready)
 * without triggering stock effects. Body: { status }
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['Draft', 'Waiting', 'Ready', 'Canceled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
    }

    const { data, error } = await supabaseAdmin
      .from('stock_ledger')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ ledger: data });
  } catch (err) {
    console.error('[ledger/status]', err.message);
    res.status(500).json({ error: 'Failed to update document status' });
  }
});

/**
 * PUT /api/operations/ledger/:id/validate
 * Transitions a document to 'Done'. The PL/pgSQL trigger
 * (trg_process_ledger_validation) does the actual stock math atomically;
 * if it raises (e.g. insufficient stock), Supabase returns a Postgres error
 * which we surface as a 409.
 */
router.put('/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('stock_ledger')
      .update({ status: 'Done' })
      .eq('id', id)
      .select(
        `*, ledger_items(id, quantity, counted_quantity, product_id, products(name, sku))`
      )
      .single();

    if (error) {
      // Postgres raise exception (e.g. insufficient stock) surfaces here
      const message = error.message || 'Validation failed';
      const isBusinessRuleError = /Insufficient stock|require/i.test(message);
      return res.status(isBusinessRuleError ? 409 : 500).json({ error: message });
    }

    res.json({ ledger: data });
  } catch (err) {
    console.error('[ledger/validate]', err.message);
    res.status(500).json({ error: 'Failed to validate document' });
  }
});

/**
 * GET /api/operations/ledger
 * List documents with optional filters (mirrors dashboard/activity but
 * scoped under /operations for the Operational Hub views).
 */
router.get('/', async (req, res) => {
  try {
    const { document_type, status } = req.query;

    let query = supabaseAdmin
      .from('stock_ledger')
      .select(
        `*, source:locations!stock_ledger_source_location_id_fkey(name),
         destination:locations!stock_ledger_destination_location_id_fkey(name),
         ledger_items(id, quantity, counted_quantity, product_id, products(name, sku))`
      )
      .order('created_at', { ascending: false });

    if (document_type) query = query.eq('document_type', document_type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ documents: data });
  } catch (err) {
    console.error('[ledger/list]', err.message);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

export default router;
