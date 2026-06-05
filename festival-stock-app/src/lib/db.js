import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://efykrzdxlfwbyhkcezaq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeWtyemR4bGZ3Ynloa2NlemFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTU3ODEsImV4cCI6MjA5NTYzMTc4MX0.WyibUUER93V2KaAlr7L0DFUUbW8MsRhB1Rm2py3NpS8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const TABLE_MAP = {
  bars: 'bars',
  products: 'products',
  stockReports: 'stock_reports',
  offeredItems: 'offered_items',
  posSales: 'pos_sales',
  productPrices: 'product_prices',
  festivalSettings: 'festival_settings',
  festivals: 'festivals',
  appUsers: 'app_users',
}

function createEntity(collectionName) {
  const table = TABLE_MAP[collectionName] || collectionName

  return {
    list: async (sortField, limit) => {
      let query = supabase.from(table).select('*')
      if (sortField) {
        const desc = sortField.startsWith('-')
        const field = desc ? sortField.slice(1) : sortField
        query = query.order(field, { ascending: !desc })
      } else {
        query = query.order('created_date', { ascending: false })
      }
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) { console.error(error); return [] }
      return data || []
    },

    get: async (id) => {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
      if (error) { console.error(error); return null }
      return data
    },

    create: async (payload) => {
      const { data, error } = await supabase.from(table).insert([{
        ...payload,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      }]).select().single()
      if (error) { console.error(error); return null }
      return data
    },

    update: async (id, payload) => {
      const { data, error } = await supabase.from(table).update({
        ...payload,
        updated_date: new Date().toISOString(),
      }).eq('id', id).select().single()
      if (error) { console.error(error); return null }
      return data
    },

    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) { console.error(error); return false }
      return true
    },

    filter: async (query) => {
      let q = supabase.from(table).select('*')
      Object.entries(query).forEach(([k, v]) => { q = q.eq(k, v) })
      const { data, error } = await q
      if (error) { console.error(error); return [] }
      return data || []
    },

    filterByFestival: async (festivalId, sortField) => {
      let q = supabase.from(table).select('*').eq('festival_id', festivalId)
      if (sortField) {
        const desc = sortField.startsWith('-')
        const field = desc ? sortField.slice(1) : sortField
        q = q.order(field, { ascending: !desc })
      } else {
        q = q.order('created_date', { ascending: false })
      }
      const { data, error } = await q
      if (error) { console.error(error); return [] }
      return data || []
    },
  }
}

export const db = {
  Bar: createEntity('bars'),
  Product: createEntity('products'),
  StockReport: createEntity('stockReports'),
  OfferedItems: createEntity('offeredItems'),
  POSSales: createEntity('posSales'),
  ProductPrice: createEntity('productPrices'),
  FestivalSettings: createEntity('festivalSettings'),
  Festival: createEntity('festivals'),
  AppUser: createEntity('appUsers'),
}

export default db
