import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

/**
 * GET /api/products
 * Returns products with per-location quantities and total quantity.
 * Supports ?search=<sku or name> and ?category_id=<uuid>
 */
router.get('/', async (req, res) => {
  try {
    const { search, category_id } = req.query;

    let query = supabaseAdmin
      .from('products')
      .select(
        `id, name, sku, unit_of_measure, created_at,
         category:product_categories(id, name),
         stock_levels(current_quantity, location:locations(id, name))`
      )
      .order('name', { ascending: true });

    if (category_id) query = query.eq('category_id', category_id);
    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const products = (data || []).map((p) => {
      const byLocation = (p.stock_levels || []).map((s) => ({
        locationId: s.location?.id,
        locationName: s.location?.name,
        quantity: s.current_quantity,
      }));
      const totalQuantity = byLocation.reduce((sum, s) => sum + s.quantity, 0);
      const { stock_levels, ...rest } = p;
      return { ...rest, totalQuantity, byLocation };
    });

    res.json({ products });
  } catch (err) {
    console.error('[products/list]', err.message);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

/**
 * POST /api/products
 * Creates a new product. Body: { name, sku, category_id, unit_of_measure }
 */
router.post('/', async (req, res) => {
  try {
    const { name, sku, category_id, unit_of_measure } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ error: 'name and sku are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        name,
        sku,
        category_id: category_id || null,
        unit_of_measure: unit_of_measure || 'unit',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `SKU "${sku}" already exists` });
      }
      throw error;
    }

    res.status(201).json({ product: data });
  } catch (err) {
    console.error('[products/create]', err.message);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/** GET /api/products/categories — for filter dropdowns */
router.get('/categories', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('product_categories').select('*').order('name');
  if (error) return res.status(500).json({ error: 'Failed to load categories' });
  res.json({ categories: data });
});

/** GET /api/products/locations — for filter dropdowns / warehouse selector */
router.get('/locations', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('locations').select('*').order('name');
  if (error) return res.status(500).json({ error: 'Failed to load locations' });
  res.json({ locations: data });
});

export default router;
