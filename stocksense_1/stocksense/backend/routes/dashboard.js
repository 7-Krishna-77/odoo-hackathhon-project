import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 10);

/**
 * GET /api/dashboard/kpis
 * Returns: totalStockUnits, lowStockCount, outOfStockCount,
 *          pendingDocuments, upcomingTransfers
 */
router.get('/kpis', async (req, res) => {
  try {
    const [stockLevelsRes, pendingRes, transfersRes] = await Promise.all([
      supabaseAdmin.from('stock_levels').select('current_quantity, product_id'),
      supabaseAdmin
        .from('stock_ledger')
        .select('id', { count: 'exact', head: true })
        .in('status', ['Draft', 'Waiting', 'Ready']),
      supabaseAdmin
        .from('stock_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('document_type', 'Internal')
        .in('status', ['Waiting', 'Ready']),
    ]);

    if (stockLevelsRes.error) throw stockLevelsRes.error;
    if (pendingRes.error) throw pendingRes.error;
    if (transfersRes.error) throw transfersRes.error;

    const levels = stockLevelsRes.data || [];

    const totalStockUnits = levels.reduce((sum, r) => sum + r.current_quantity, 0);

    // Aggregate quantity per product across all locations to evaluate low-stock
    const perProduct = new Map();
    for (const row of levels) {
      perProduct.set(row.product_id, (perProduct.get(row.product_id) || 0) + row.current_quantity);
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const qty of perProduct.values()) {
      if (qty === 0) outOfStockCount += 1;
      else if (qty <= LOW_STOCK_THRESHOLD) lowStockCount += 1;
    }

    res.json({
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      pendingDocuments: pendingRes.count || 0,
      upcomingTransfers: transfersRes.count || 0,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    });
  } catch (err) {
    console.error('[dashboard/kpis]', err.message);
    res.status(500).json({ error: 'Failed to compute KPIs' });
  }
});

/**
 * GET /api/dashboard/activity
 * Recent ledger documents for the "activity stream" table, with optional
 * filters: ?document_type=Receipt&status=Done&location_id=...&category_id=...
 */
router.get('/activity', async (req, res) => {
  try {
    const { document_type, status, location_id, limit = 25 } = req.query;

    let query = supabaseAdmin
      .from('stock_ledger')
      .select(
        `id, document_type, status, reference, source_location_id, destination_location_id,
         created_at, validated_at,
         source:locations!stock_ledger_source_location_id_fkey(name),
         destination:locations!stock_ledger_destination_location_id_fkey(name),
         ledger_items(id, quantity, counted_quantity, product_id, products(name, sku))`
      )
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (document_type) query = query.eq('document_type', document_type);
    if (status) query = query.eq('status', status);
    if (location_id) {
      query = query.or(
        `source_location_id.eq.${location_id},destination_location_id.eq.${location_id}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ activity: data });
  } catch (err) {
    console.error('[dashboard/activity]', err.message);
    res.status(500).json({ error: 'Failed to load activity stream' });
  }
});

export default router;
